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
  // Prefer a single row that covers the full amount (FIFO among them)
  const full = user.gameEscrows
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.gameId === gid && Math.floor(Number(e.amount) || 0) >= amt);
  if (full.length) {
    full.sort((a, b) => (a.e.at ?? 0) - (b.e.at ?? 0));
    return releaseEscrowAt(user, full[0].i, amt);
  }
  // Fragmented rows: FIFO consume across same-game rows until amt is covered
  const sameGame = user.gameEscrows
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.gameId === gid);
  if (!sameGame.length) return false;
  sameGame.sort((a, b) => (a.e.at ?? 0) - (b.e.at ?? 0));
  const total = sameGame.reduce((s, { e }) => s + Math.floor(Number(e.amount) || 0), 0);
  if (total < amt) return false;
  let remaining = amt;
  // Release highest indices first so earlier indices stay valid
  const consume = [];
  for (const row of sameGame) {
    if (remaining <= 0) break;
    const rowAmt = Math.floor(Number(row.e.amount) || 0);
    const take = Math.min(rowAmt, remaining);
    consume.push({ i: row.i, take });
    remaining -= take;
  }
  if (remaining > 0) return false;
  consume.sort((a, b) => b.i - a.i);
  for (const { i, take } of consume) {
    releaseEscrowAt(user, i, take);
  }
  return true;
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

/**
 * Fallback when gameId mismatches but escrow row exists (expire/sweep recovery).
 * @param {{ preferGameId?: string }} [opts] — try this game first; refuse multi-game cross-steal.
 */
export function releaseAnyGameEscrow(user, amount, opts = {}) {
  if (!user?.gameEscrows?.length) return false;
  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) return false;
  const prefer = opts.preferGameId ?? opts.gameId ?? null;
  if (prefer && releaseGameEscrow(user, { gameId: prefer, amount: amt })) {
    return true;
  }
  // Refuse cross-game when multiple gameIds present (would steal another stake)
  const gameIds = new Set(user.gameEscrows.map((e) => e.gameId ?? 'arcade'));
  if (gameIds.size > 1) {
    console.warn('[games] releaseAnyGameEscrow refused — multi-game escrows present', {
      games: [...gameIds],
      amount: amt,
    });
    return false;
  }
  const candidates = user.gameEscrows
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => Math.floor(Number(e.amount) || 0) >= amt);
  if (!candidates.length) return false;
  candidates.sort((a, b) => (a.e.at ?? 0) - (b.e.at ?? 0));
  return releaseEscrowAt(user, candidates[0].i, amt);
}

/**
 * Refund persisted escrows after restart for users NOT in a live matchmaker session.
 * Matchmaker is durable (data/games/matchmaker/) — hydrate before calling.
 */
export async function refundAllEscrowsOnBoot() {
  const { userInAnyMatchmakerSession } = await import('./gamesMatchmakerStore.mjs');
  return runCoinTransaction(async () => {
  const db = await loadUsersDb();
  let refunded = 0;
  for (const user of db.users) {
    if (user.role === 'bot' || !user.gameEscrows?.length) continue;
    // Keep stakes for users still in queue/match after durable hydrate
    if (userInAnyMatchmakerSession(user.id)) continue;
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
    // Re-check under coin lock so a concurrent join cannot be stripped after it escrowed
    // (leaveAll then refund without lock was TOCTOU free-stake / double-pay risk).
    try {
      const { userHasActiveArcadeSession } = await import('./gamesService.mjs');
      if (await userHasActiveArcadeSession(userId)) {
        console.warn('[games] refundUserEscrows skipped — live arcade session under coin lock', { userId });
        return 0;
      }
    } catch (e) {
      console.warn('[games] refundUserEscrows live-session check failed — abort refund', userId, e);
      return 0;
    }
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