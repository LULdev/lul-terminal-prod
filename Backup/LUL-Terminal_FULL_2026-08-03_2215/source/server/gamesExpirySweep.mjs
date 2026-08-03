/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  expireMatchWithRefund,
  sweepStaleConsumedRooms,
  sweepStaleDoneMatches,
  sweepStaleQueueEntries,
} from './gamesCore.mjs';

export async function sweepExpiredInMap(mm, expireMeta) {
  const activeMatches = mm?.activeMatches ?? mm;
  if (!activeMatches || !expireMeta) return 0;
  sweepStaleDoneMatches(activeMatches);
  if (mm?.consumedRooms) sweepStaleConsumedRooms(mm.consumedRooms);
  if (mm?.queue) await sweepStaleQueueEntries(mm, expireMeta);
  const expired = [...activeMatches.values()].filter(
    (m) => m.status !== 'done' && Date.now() > m.expiresAt,
  );
  for (const m of expired) {
    await expireMatchWithRefund(m, activeMatches, expireMeta);
  }
  return expired.length;
}

export async function sweepAllExpiredMatches() {
  const { GAME_REGISTRY, GAME_IDS } = await import('./gameRegistry.mjs');
  let total = 0;
  for (const id of GAME_IDS) {
    const handler = GAME_REGISTRY[id];
    if (handler?.sweepExpired) {
      total += await handler.sweepExpired();
    }
  }
  return total;
}

let sweepTimer = null;

export function startMatchExpirySweep(intervalMs = 60_000) {
  if (sweepTimer) return;
  const tick = () => {
    sweepAllExpiredMatches().catch((e) => {
      console.error('[games] expiry sweep failed:', e instanceof Error ? e.message : e);
    });
  };
  tick();
  sweepTimer = setInterval(tick, intervalMs);
  if (sweepTimer.unref) sweepTimer.unref();
}