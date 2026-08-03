/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-process file lock via exclusive create (wx). Safe for PM2/cluster on one host.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCK_DIR = path.join(__dirname, '..', 'data', 'locks');

function lockFilePath(key) {
  const hash = crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
  return path.join(LOCK_DIR, `${hash}.lock`);
}

/**
 * Run task while holding an exclusive cross-process lock for key.
 * @param {string} key
 * @param {() => Promise<T>} task
 * @param {{ maxWaitMs?: number }} [opts]
 * @returns {Promise<T>}
 */
/** Stale lock reclaim threshold (crashed holder). */
const STALE_LOCK_MS = 20_000;

export async function withCrossProcessLock(key, task, { maxWaitMs = 4000 } = {}) {
  await fs.mkdir(LOCK_DIR, { recursive: true });
  const lockPath = lockFilePath(key);
  const start = Date.now();
  let handle = null;

  while (Date.now() - start < maxWaitMs) {
    try {
      handle = await fs.open(lockPath, 'wx');
      break;
    } catch {
      // Reclaim locks left by crashed processes (mtime older than STALE_LOCK_MS)
      try {
        const st = await fs.stat(lockPath);
        if (Date.now() - st.mtimeMs > STALE_LOCK_MS) {
          await fs.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch { /* gone */ }
      await new Promise((r) => setTimeout(r, 12 + Math.floor(Math.random() * 28)));
    }
  }

  if (!handle) throw new Error('File lock timeout');

  // Heartbeat: refresh mtime so long holders are not reclaimed as "stale"
  let heartbeat = null;
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, at: Date.now() }), 'utf8').catch(() => {});
    heartbeat = setInterval(() => {
      fs.utimes(lockPath, new Date(), new Date()).catch(() => {});
    }, Math.max(2000, Math.floor(STALE_LOCK_MS / 3)));
    if (typeof heartbeat.unref === 'function') heartbeat.unref();
    return await task();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await handle.close().catch(() => {});
    await fs.unlink(lockPath).catch(() => {});
  }
}