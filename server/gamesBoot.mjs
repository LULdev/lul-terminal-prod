/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Awaitable games bootstrap: refund RAM-lost escrows before accepting traffic.
 */

import { refundAllEscrowsOnBoot } from './gamesEscrow.mjs';
import { startMatchExpirySweep } from './gamesExpirySweep.mjs';

let ready = false;
let bootPromise = null;

/** True after boot escrow refund has finished (success or failure). */
export function isGamesBootReady() {
  return ready;
}

/**
 * Refund persisted escrows once, then start match expiry sweep.
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
      } finally {
        ready = true;
        startMatchExpirySweep();
      }
    })();
  }
  return bootPromise;
}
