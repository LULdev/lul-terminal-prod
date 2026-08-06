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
/** True only after hydrate+orphan refund completed (not merely attempted). */
let bootMoneyOk = false;

/** True after games boot finished enough to accept traffic. */
export function isGamesBootReady() {
  return ready;
}

/** True when orphan escrow refund at boot succeeded (ops/metrics). */
export function isGamesBootMoneyOk() {
  return bootMoneyOk;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
 * P1: retries hydrate+orphan refund before marking ready; schedules background residual if still failed.
 */
export function ensureGamesBootstrapped() {
  if (ready) return Promise.resolve();
  if (!bootPromise) {
    bootPromise = (async () => {
      bootMoneyOk = false;
      try {
        await import('./gameRegistry.mjs');
      } catch (e) {
        console.error('[games] gameRegistry import failed', e);
      }

      // Retry hydrate + orphan refund (multi-worker lock contention at restart)
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const { hydrateAllMatchmakers } = await import('./gamesMatchmakerStore.mjs');
          const nMm = await hydrateAllMatchmakers({ hard: true });
          if (nMm > 0 && attempt === 1) {
            console.log(`[games] Hydrated ${nMm} durable matchmaker(s)`);
          }
          const n = await refundAllEscrowsOnBoot();
          if (n > 0) console.log(`[games] Refunded ${n} orphan escrow(s) after restart`);
          bootMoneyOk = true;
          break;
        } catch (e) {
          console.error(`[games] Boot hydrate/refund attempt ${attempt}/${maxAttempts} failed`, e);
          if (attempt < maxAttempts) await sleep(500 * attempt);
        }
      }
      if (!bootMoneyOk) {
        console.error('[games] CRITICAL: orphan escrow refund incomplete after retries — scheduling residual');
      }

      try {
        const rec = await recoverJackpotPendingOnBoot(settlePendingJackpotOnBoot);
        if (rec) {
          console.log(`[games] Jackpot pending recovery: ${rec.outcome} ${rec.amount} → ${rec.winner}`);
        }
      } catch (e) {
        console.error('[games] Jackpot pending recovery failed', e);
      }

      // Open traffic after best-effort money path (retries exhausted); residual keeps running if needed
      ready = true;
      startMatchExpirySweep();

      if (!bootMoneyOk) {
        // Background residual: re-try orphan refund every 30s for ~10 minutes
        let residualAttempts = 0;
        const residual = async () => {
          if (bootMoneyOk || residualAttempts >= 20) return;
          residualAttempts += 1;
          try {
            const { hydrateAllMatchmakers } = await import('./gamesMatchmakerStore.mjs');
            await hydrateAllMatchmakers({ hard: true });
            const n = await refundAllEscrowsOnBoot();
            if (n > 0) console.log(`[games] Residual boot refunded ${n} orphan escrow(s)`);
            bootMoneyOk = true;
            console.log('[games] Residual orphan escrow path OK');
          } catch (e) {
            console.warn('[games] Residual boot refund attempt failed', e);
            setTimeout(residual, 30_000);
          }
        };
        setTimeout(residual, 5_000);
      }
    })().catch((e) => {
      console.error('[games] Boot crashed', e);
      ready = true;
      startMatchExpirySweep();
    });
  }
  return bootPromise;
}
