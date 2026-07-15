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
      await new Promise((r) => setTimeout(r, 12 + Math.floor(Math.random() * 28)));
    }
  }

  if (!handle) throw new Error('File lock timeout');

  try {
    return await task();
  } finally {
    await handle.close().catch(() => {});
    await fs.unlink(lockPath).catch(() => {});
  }
}