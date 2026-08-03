/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Runs daily proxy health checks (once per calendar day).
 */

import { loadDatabase } from './proxyDatabaseStore.mjs';
import { isDailyCheckDue, runDailyCheck } from './proxyDatabaseService.mjs';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let started = false;

async function tick() {
  try {
    const db = await loadDatabase();
    if (!isDailyCheckDue(db)) return;
    const result = await runDailyCheck();
    if (!result.skipped) {
      console.log(
        `[proxy-db] Daily check: ${result.checked} checked, ${result.working} working, ${result.offline} offline, ${result.removed} removed`,
      );
    }
  } catch (e) {
    console.error('[proxy-db] Daily check failed:', e instanceof Error ? e.message : e);
  }
}

export function startProxyDatabaseScheduler() {
  if (started) return;
  started = true;

  setTimeout(tick, 15000);
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log('[proxy-db] Daily scheduler active (checks once per day)');
}