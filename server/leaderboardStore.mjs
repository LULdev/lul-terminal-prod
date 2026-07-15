/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNC_FILE = path.join(__dirname, '..', 'data', 'leaderboard-sync.json');

export const SYNC_INTERVAL_MS = 5 * 60 * 1000;

let syncWriteChain = Promise.resolve();

export function withLeaderboardWrite(task) {
  const run = syncWriteChain.then(() => task());
  syncWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readLastSync() {
  if (!(await fileExists(SYNC_FILE))) return 0;
  try {
    const raw = await fs.readFile(SYNC_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Number(parsed.lastSyncAt) || 0;
  } catch (err) {
    console.error('[leaderboard] CRITICAL: leaderboard-sync.json unreadable', err);
    throw new Error('Leaderboard sync state unavailable');
  }
}

export async function writeLastSync(ts = Date.now()) {
  return withLeaderboardWrite(async () => {
    await fs.mkdir(path.dirname(SYNC_FILE), { recursive: true });
    const tmp = `${SYNC_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ lastSyncAt: ts }, null, 2), 'utf8');
    await fs.rename(tmp, SYNC_FILE);
  });
}