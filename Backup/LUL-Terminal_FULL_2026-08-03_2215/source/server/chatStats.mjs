/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { ONLINE_WINDOW_MS } from './profileStats.mjs';

const TOUCH_THROTTLE_MS = 60_000;
/** Gaps longer than this are treated as offline — no minutes accrued across the gap. */
const SESSION_CONTINUITY_MS = 10 * 60 * 1000;

function minutesBetween(from, to) {
  const gap = to - from;
  if (gap <= 0) return 0;
  return Math.max(1, Math.round(gap / 60_000));
}

function accrueOnlineMinutes(user, now) {
  const prev = Number(user.lastSeenAt) || 0;
  user.onlineMinutes = Math.max(0, Number(user.onlineMinutes) || 0);

  if (user.role === 'bot') {
    if (prev > 0) {
      user.onlineMinutes += minutesBetween(prev, now);
    } else {
      user.onlineMinutes += 1;
    }
    return;
  }

  if (!prev) return;

  const gap = now - prev;
  if (gap > 0 && gap <= SESSION_CONTINUITY_MS) {
    user.onlineMinutes += minutesBetween(prev, now);
  } else if (gap > SESSION_CONTINUITY_MS && gap <= ONLINE_WINDOW_MS) {
    user.onlineMinutes += 5;
  }
}

export async function touchUserLastSeen(userId, { force = false } = {}) {
  if (!userId) return;
  const { runCoinTransaction } = await import('./gamesCoinLock.mjs');
  await runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user || user.active === false) return;
    const now = Date.now();
    if (!force && user.lastSeenAt && now - user.lastSeenAt < TOUCH_THROTTLE_MS) return;

    const prevMinutes = Math.max(0, Number(user.onlineMinutes) || 0);
    accrueOnlineMinutes(user, now);
    user.lastSeenAt = now;
    user.updatedAt = now;
    if (user.onlineMinutes !== prevMinutes && user.role !== 'bot') {
      const { syncAchievementsOnLoadedUser } = await import('./auth/authService.mjs');
      await syncAchievementsOnLoadedUser(user, db);
    }
    await saveUsersDb(db);
  });
}

export async function incrementAbuseWarnings(userId, amount = 1) {
  if (!userId) return;
  const { runCoinTransaction } = await import('./gamesCoinLock.mjs');
  await runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return;
    user.abuseWarnings = Math.max(0, (Number(user.abuseWarnings) || 0) + amount);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
  });
}