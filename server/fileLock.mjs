/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-process file lock via exclusive create (wx). Safe for PM2/cluster on one host.
 * Owner token prevents stale reclaim from unlinking a newer holder's lock.
 * Reclaim only when mtime is stale AND holder PID is dead (or token unreadable).
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

/** Stale lock reclaim threshold (crashed holder). */
const STALE_LOCK_MS = 20_000;

/** True if OS reports the process exists (signal 0). */
function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run task while holding an exclusive cross-process lock for key.
 * @param {string} key
 * @param {() => Promise<T>} task
 * @param {{ maxWaitMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withCrossProcessLock(key, task, { maxWaitMs = 4000 } = {}) {
  await fs.mkdir(LOCK_DIR, { recursive: true });
  const lockPath = lockFilePath(key);
  const start = Date.now();
  let handle = null;
  const token = `${process.pid}-${crypto.randomBytes(8).toString('hex')}-${Date.now()}`;

  while (Date.now() - start < maxWaitMs) {
    try {
      handle = await fs.open(lockPath, 'wx');
      break;
    } catch {
      try {
        const st = await fs.stat(lockPath);
        if (Date.now() - st.mtimeMs > STALE_LOCK_MS) {
          let holderAlive = false;
          try {
            const raw = await fs.readFile(lockPath, 'utf8');
            const parsed = JSON.parse(raw);
            // Live PID must not be reclaimed even if mtime lagged (heartbeat glitch)
            if (parsed?.pid && isPidAlive(parsed.pid)) {
              holderAlive = true;
            }
          } catch {
            // unreadable token — allow reclaim after second stale check
          }
          if (!holderAlive) {
            await new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 15)));
            const st2 = await fs.stat(lockPath).catch(() => null);
            if (st2 && Date.now() - st2.mtimeMs > STALE_LOCK_MS) {
              // Re-check PID after wait
              let stillAlive = false;
              try {
                const raw2 = await fs.readFile(lockPath, 'utf8');
                const p2 = JSON.parse(raw2);
                if (p2?.pid && isPidAlive(p2.pid)) stillAlive = true;
              } catch { /* unreadable */ }
              if (!stillAlive) {
                await fs.unlink(lockPath).catch(() => {});
              }
            }
          }
          continue;
        }
      } catch { /* gone */ }
      await new Promise((r) => setTimeout(r, 12 + Math.floor(Math.random() * 28)));
    }
  }

  if (!handle) throw new Error('File lock timeout');

  let heartbeat = null;
  try {
    // Must durable-write owner token before critical section (else silent dual holders)
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, at: Date.now() }), 'utf8');
    } catch (writeErr) {
      await handle.close().catch(() => {});
      await fs.unlink(lockPath).catch(() => {});
      throw writeErr instanceof Error ? writeErr : new Error('File lock token write failed');
    }
    heartbeat = setInterval(() => {
      fs.writeFile(lockPath, JSON.stringify({ pid: process.pid, token, at: Date.now() }), 'utf8').catch(() => {});
    }, Math.max(2000, Math.floor(STALE_LOCK_MS / 3)));
    if (typeof heartbeat.unref === 'function') heartbeat.unref();
    return await task();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    try {
      const raw = await fs.readFile(lockPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.token === token) {
        await fs.unlink(lockPath).catch(() => {});
      }
    } catch {
      /* already gone or unreadable */
    }
    await handle.close().catch(() => {});
  }
}
