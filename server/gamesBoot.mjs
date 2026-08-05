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
import { hasJackpotPendingCredited, logJackpotCredit } from './coinLedger.mjs';

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
    // Durable idempotency: jackpotCreditedPendingIds survives coinLedger rotation
    if (hasJackpotPendingCredited(user, {
      pendingId: pending.id,
      matchId: pending.matchId,
      amount: pending.amount,
    })) {
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

/** Live recovery (sweep) — same settle rules as boot, including pending.userId. */
export async function recoverJackpotPendingLive() {
  return recoverJackpotPendingOnBoot(settlePendingJackpotOnBoot);
}

/**
 * Refund persisted escrows once, recover incomplete jackpot payouts, start sweep.
 * Safe to call multiple times — single-flight.
 */
export function ensureGamesBootstrapped() {
  if (ready) return Promise.resolve();
  if (!bootPromise) {
    bootPromise = (async () => {
      // Register all matchmakers then hydrate durable queue/match state BEFORE escrow refund
      try {
        await import('./gameRegistry.mjs');
        const { hydrateAllMatchmakers } = await import('./gamesMatchmakerStore.mjs');
        // hard: fail closed on partial hydrate so boot refund cannot mint over live disk sessions
        const nMm = await hydrateAllMatchmakers({ hard: true });
        if (nMm > 0) console.log(`[games] Hydrated ${nMm} durable matchmaker(s)`);
      } catch (e) {
        console.error('[games] Matchmaker hydrate failed — skipping boot escrow refund', e);
        // Still mark ready below so API can serve; residual refunds retry on logout/lifecycle
      }
      try {
        const n = await refundAllEscrowsOnBoot();
        if (n > 0) console.log(`[games] Refunded ${n} orphan escrow(s) after restart`);
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
