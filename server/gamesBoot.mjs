/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Awaitable games bootstrap: refund RAM-lost escrows + recover jackpot pending
 * before accepting arcade traffic.
 */

import { refundAllEscrowsOnBoot } from './gamesEscrow.mjs';
import { startMatchExpirySweep } from './gamesExpirySweep.mjs';
import { recoverJackpotPendingOnBoot } from './gamesStore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { logJackpotCredit } from './coinLedger.mjs';

let ready = false;
let bootPromise = null;

/** True after boot escrow refund has finished (success or failure). */
export function isGamesBootReady() {
  return ready;
}

async function settlePendingJackpotOnBoot(pending) {
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    let user = null;
    if (pending.userId) {
      user = db.users.find((u) => u.id === pending.userId && u.role !== 'bot') ?? null;
    }
    if (!user) {
      const uname = String(pending.winner ?? '').toLowerCase();
      user = db.users.find(
        (u) => u.role !== 'bot' && String(u.username ?? '').toLowerCase() === uname,
      ) ?? null;
    }
    if (!user) {
      // Unknown winner — put money back in the pool
      return 'restored';
    }
    // Idempotent: only skip when we can prove THIS pending payout was credited
    // (pendingId or exact matchId). Same amount + time window is NOT enough —
    // that caused silent coin loss when a second jackpot matched the first.
    const ledger = Array.isArray(user.coinLedger) ? user.coinLedger : [];
    const already = ledger.some((e) => {
      if (e.kind !== 'jackpot') return false;
      if (Number(e.amount) !== Number(pending.amount)) return false;
      if (pending.id && e.meta?.pendingId === pending.id) return true;
      if (pending.matchId && e.meta?.matchId === pending.matchId) return true;
      return false;
    });
    if (already) {
      return 'skipped';
    }
    logJackpotCredit(user, {
      gameId: pending.gameId ?? 'arcade',
      matchId: pending.matchId,
      bet: null,
      amount: pending.amount,
      pendingId: pending.id,
    });
    user.gameJackpotsWon = (Number(user.gameJackpotsWon) || 0) + 1;
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return 'credited';
  });
}

/**
 * Refund persisted escrows once, recover incomplete jackpot payouts, start sweep.
 * Safe to call multiple times — single-flight.
 */
export function ensureGamesBootstrapped() {
  if (ready) return Promise.resolve();
  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        const n = await refundAllEscrowsOnBoot();
        if (n > 0) console.log(`[games] Refunded ${n} escrow(s) after restart`);
      } catch (e) {
        console.error('[games] Boot escrow refund failed', e);
      }
      try {
        const rec = await recoverJackpotPendingOnBoot(settlePendingJackpotOnBoot);
        if (rec) {
          console.log(`[games] Jackpot pending recovery: ${rec.outcome} ${rec.amount} → ${rec.winner}`);
        }
      } catch (e) {
        console.error('[games] Jackpot pending recovery failed', e);
      } finally {
        ready = true;
        startMatchExpirySweep();
      }
    })();
  }
  return bootPromise;
}
