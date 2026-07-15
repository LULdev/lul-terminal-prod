/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { logQueueRefund } from './coinLedger.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';

export function addGameEscrow(user, { gameId, chatLabel, amount }) {
  if (!user || user.role === 'bot') return;
  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) return;
  if (!Array.isArray(user.gameEscrows)) user.gameEscrows = [];
  user.gameEscrows.push({
    id: crypto.randomBytes(6).toString('hex'),
    gameId: gameId ?? 'arcade',
    chatLabel: chatLabel ?? 'Arcade',
    amount: amt,
    at: Date.now(),
  });
}

function releaseEscrowAt(user, index, amt) {
  const e = user.gameEscrows[index];
  if (e.amount === amt) {
    user.gameEscrows.splice(index, 1);
    return true;
  }
  e.amount -= amt;
  if (e.amount <= 0) user.gameEscrows.splice(index, 1);
  return true;
}

export function releaseGameEscrow(user, { gameId, amount }) {
  if (!user?.gameEscrows?.length) return false;
  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) return false;
  const gid = gameId ?? 'arcade';
  const candidates = user.gameEscrows
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.gameId === gid && e.amount >= amt);
  if (!candidates.length) return false;
  candidates.sort((a, b) => (a.e.at ?? 0) - (b.e.at ?? 0));
  return releaseEscrowAt(user, candidates[0].i, amt);
}

/** Oldest escrow row amount for a game (queue sweep orphan recovery). */
export function oldestGameEscrowAmount(user, gameId) {
  if (!user?.gameEscrows?.length) return 0;
  const gid = gameId ?? 'arcade';
  const rows = user.gameEscrows.filter((e) => e.gameId === gid);
  if (!rows.length) return 0;
  rows.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  return Math.floor(Number(rows[0].amount) || 0);
}

/** Fallback when gameId mismatches but escrow row exists (expire/sweep recovery). */
export function releaseAnyGameEscrow(user, amount) {
  if (!user?.gameEscrows?.length) return false;
  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) return false;
  const candidates = user.gameEscrows
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.amount >= amt);
  if (!candidates.length) return false;
  candidates.sort((a, b) => (a.e.at ?? 0) - (b.e.at ?? 0));
  return releaseEscrowAt(user, candidates[0].i, amt);
}

/** Refund persisted escrows after restart — queue/match state is RAM-only. */
export async function refundAllEscrowsOnBoot() {
  return runCoinTransaction(async () => {
  const db = await loadUsersDb();
  let refunded = 0;
  for (const user of db.users) {
    if (user.role === 'bot' || !user.gameEscrows?.length) continue;
    for (const e of user.gameEscrows) {
      logQueueRefund(user, {
        gameId: e.gameId,
        chatLabel: e.chatLabel,
        bet: e.amount,
        amount: e.amount,
      });
      user.updatedAt = Date.now();
      refunded += 1;
    }
    user.gameEscrows = [];
  }
  if (refunded > 0) await saveUsersDb(db);
  return refunded;
  });
}

/** Refund persisted escrows for one user when arcade cleanup cannot complete. */
export async function refundUserEscrows(userId) {
  if (!userId) return 0;
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user || user.role === 'bot' || !user.gameEscrows?.length) return 0;
    let refunded = 0;
    for (const e of user.gameEscrows) {
      logQueueRefund(user, {
        gameId: e.gameId,
        chatLabel: e.chatLabel,
        bet: e.amount,
        amount: e.amount,
      });
      refunded += 1;
    }
    user.gameEscrows = [];
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return refunded;
  });
}