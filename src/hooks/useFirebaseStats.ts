/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { increment, onDisconnect, onValue, ref, runTransaction } from 'firebase/database';
import { db, hitsRef, onlineRef, uniqueRef } from '../lib/firebase';
import { SystemStats } from '../types';

const VISITED_KEY = 'lul_visited';

/**
 * Module singleton: write side-effects (hits/online) must run once per page load.
 * Header + TerminalStatsPage both mount useFirebaseStats — without this, hits and
 * onlineUsers double-count.
 */
type SharedFirebaseStats = SystemStats;

const EMPTY_STATS: SharedFirebaseStats = {
  online: 0,
  hits: 0,
  unique: 0,
  registered: 0,
  imagesUploaded: 0,
  pastesCreated: 0,
  proxiesInDb: 0,
  premiumAccounts: 0,
  freeAccounts: 0,
};

let sharedStats: SharedFirebaseStats = { ...EMPTY_STATS };
const listeners = new Set<(s: SharedFirebaseStats) => void>();
let bootstrapStarted = false;
let writeSideEffectsDone = false;
let onlineCounted = false;
let bootstrapUnsubs: Array<() => void> = [];

function emit() {
  const snap = { ...sharedStats };
  for (const fn of listeners) fn(snap);
}

function ensureFirebaseStatsBootstrap() {
  if (bootstrapStarted) return;
  bootstrapStarted = true;

  bootstrapUnsubs.push(
    onValue(hitsRef, (snap) => {
      sharedStats = { ...sharedStats, hits: snap.val() ?? 0 };
      emit();
    }),
  );
  bootstrapUnsubs.push(
    onValue(uniqueRef, (snap) => {
      sharedStats = { ...sharedStats, unique: snap.val() ?? 0 };
      emit();
    }),
  );
  bootstrapUnsubs.push(
    onValue(onlineRef, (snap) => {
      sharedStats = { ...sharedStats, online: snap.val() ?? 0 };
      emit();
    }),
  );

  if (!writeSideEffectsDone) {
    writeSideEffectsDone = true;
    runTransaction(hitsRef, (current) => (current ?? 0) + 1).catch(() => {});

    try {
      if (!localStorage.getItem(VISITED_KEY)) {
        runTransaction(uniqueRef, (current) => (current ?? 0) + 1).catch(() => {});
        localStorage.setItem(VISITED_KEY, '1');
      }
    } catch {
      /* private mode */
    }
  }

  const connectedRef = ref(db, '.info/connected');
  bootstrapUnsubs.push(
    onValue(connectedRef, (snap) => {
      if (snap.val() !== true || onlineCounted) return;
      onlineCounted = true;
      runTransaction(onlineRef, (current) => (current ?? 0) + 1).catch(() => {});
      onDisconnect(onlineRef).set(increment(-1)).catch(() => {});
    }),
  );
}

export function useFirebaseStats(): SystemStats {
  const [stats, setStats] = useState<SystemStats>(() => ({ ...sharedStats }));

  useEffect(() => {
    ensureFirebaseStatsBootstrap();
    setStats({ ...sharedStats });
    listeners.add(setStats);
    return () => {
      listeners.delete(setStats);
      // Keep singleton subscriptions for the page lifetime (Header always mounted).
      // Do not tear down online presence on unmount of a secondary consumer.
    };
  }, []);

  return stats;
}
