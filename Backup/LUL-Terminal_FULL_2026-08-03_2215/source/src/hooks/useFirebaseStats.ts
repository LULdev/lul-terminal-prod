/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { increment, onDisconnect, onValue, ref, runTransaction } from 'firebase/database';
import { db, hitsRef, onlineRef, uniqueRef } from '../lib/firebase';
import { SystemStats } from '../types';

const VISITED_KEY = 'lul_visited';

export function useFirebaseStats(): SystemStats {
  const [stats, setStats] = useState<SystemStats>({
    online: 0, hits: 0, unique: 0, registered: 0, imagesUploaded: 0, pastesCreated: 0, proxiesInDb: 0, premiumAccounts: 0, freeAccounts: 0,
  });
  const visitRecorded = useRef(false);
  const onlineCounted = useRef(false);

  useEffect(() => {
    let alive = true;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onValue(hitsRef, (snap) => {
        if (!alive) return;
        setStats((prev) => ({ ...prev, hits: snap.val() ?? 0 }));
      })
    );
    unsubs.push(
      onValue(uniqueRef, (snap) => {
        if (!alive) return;
        setStats((prev) => ({ ...prev, unique: snap.val() ?? 0 }));
      })
    );
    unsubs.push(
      onValue(onlineRef, (snap) => {
        if (!alive) return;
        setStats((prev) => ({ ...prev, online: snap.val() ?? 0 }));
      })
    );

    if (!visitRecorded.current) {
      visitRecorded.current = true;
      runTransaction(hitsRef, (current) => (current ?? 0) + 1);

      if (!localStorage.getItem(VISITED_KEY)) {
        runTransaction(uniqueRef, (current) => (current ?? 0) + 1);
        localStorage.setItem(VISITED_KEY, '1');
      }
    }

    const connectedRef = ref(db, '.info/connected');
    unsubs.push(
      onValue(connectedRef, (snap) => {
        if (snap.val() !== true || onlineCounted.current) return;

        onlineCounted.current = true;
        runTransaction(onlineRef, (current) => (current ?? 0) + 1);
        onDisconnect(onlineRef).set(increment(-1));
      })
    );

    return () => {
      alive = false;
      unsubs.forEach((unsub) => unsub());
      if (onlineCounted.current) {
        runTransaction(onlineRef, (current) => Math.max(0, (current ?? 0) - 1));
        onlineCounted.current = false;
      }
    };
  }, []);

  return stats;
}