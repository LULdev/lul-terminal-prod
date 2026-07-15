/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'proxy-database');
const DB_FILE = path.join(ROOT, 'db.json');

const EMPTY_DB = {
  version: 1,
  meta: {
    totalEverCollected: 0,
    totalRemovedStale: 0,
    lastDailyCheckAt: null,
    lastDailyCheckDay: null,
    lastUpsertAt: null,
  },
  proxies: [],
};

let proxyDbWriteChain = Promise.resolve();

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export function withProxyDbWrite(task) {
  const run = proxyDbWriteChain.then(() => task());
  proxyDbWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function ensureDatabase() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    const tmp = `${DB_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    await fs.rename(tmp, DB_FILE);
  }
}

export async function loadDatabase() {
  await ensureDatabase();
  if (!(await fileExists(DB_FILE))) return structuredClone(EMPTY_DB);
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      ...EMPTY_DB,
      ...data,
      meta: { ...EMPTY_DB.meta, ...data.meta },
      proxies: Array.isArray(data.proxies) ? data.proxies : [],
    };
  } catch (err) {
    console.error('[proxy-db] CRITICAL: db.json unreadable', err);
    throw new Error('Proxy database unavailable');
  }
}

export async function persistDatabase(db) {
  await ensureDatabase();
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
}

export async function saveDatabase(db) {
  return withProxyDbWrite(() => persistDatabase(db));
}