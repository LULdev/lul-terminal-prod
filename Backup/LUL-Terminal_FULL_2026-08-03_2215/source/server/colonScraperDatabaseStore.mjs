/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'colon-scraper-database');
const DB_FILE = path.join(ROOT, 'entries.json');

const EMPTY_DB = {
  version: 1,
  updatedAt: null,
  count: 0,
  entries: [],
};

let cache = null;
let colonWriteChain = Promise.resolve();

export function withColonDbWrite(task) {
  const run = colonWriteChain.then(() => task());
  colonWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export function clearColonDbCache() {
  cache = null;
}

export function splitColonToken(value) {
  const raw = String(value ?? '').trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) return null;
  const idx = raw.indexOf(':');
  if (idx < 0) return null;
  const U = raw.slice(0, idx);
  const P = raw.slice(idx + 1);
  if (!U || !P) return null;
  return { U, P, sourceValue: raw };
}

export function entryKey(U, P, Website) {
  return `${U}\0${P}\0${Website}`.toLowerCase();
}

export async function ensureColonDb() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    const tmp = `${DB_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    await fs.rename(tmp, DB_FILE);
  }
}

export async function loadColonDb() {
  if (cache) return cache;
  await ensureColonDb();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    cache = {
      ...EMPTY_DB,
      ...data,
      entries: Array.isArray(data.entries) ? data.entries : [],
    };
    return cache;
  } catch (err) {
    console.error('[colon-db] CRITICAL: entries.json unreadable', err);
    throw new Error('Colon database unavailable');
  }
}

export async function saveColonDb(db) {
  await ensureColonDb();
  db.count = db.entries.length;
  db.updatedAt = new Date().toISOString();
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
  cache = db;
}

export async function getColonDbStats() {
  const db = await loadColonDb();
  const byWebsite = {};
  for (const e of db.entries) {
    byWebsite[e.Website] = (byWebsite[e.Website] ?? 0) + 1;
  }
  return {
    total: db.entries.length,
    updatedAt: db.updatedAt,
    websites: Object.keys(byWebsite).length,
    byWebsite,
  };
}

/**
 * Upsert colon tokens into database.
 * U = before first :, P = after first :, Website = site where found.
 */
export async function upsertColonEntries(items) {
  return withColonDbWrite(async () => {
  const db = await loadColonDb();
  cache = null;
  const index = new Map(db.entries.map((e) => [entryKey(e.U, e.P, e.Website), e]));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const split = splitColonToken(item.value);
    if (!split) {
      skipped++;
      continue;
    }

    const Website = String(item.website ?? item.Website ?? '').trim();
    if (!Website) {
      skipped++;
      continue;
    }

    const key = entryKey(split.U, split.P, Website);
    const now = new Date().toISOString();
    const existing = index.get(key);

    if (existing) {
      existing.updatedAt = now;
      existing.seenCount = (existing.seenCount ?? 1) + 1;
      if (item.sourceUrl) existing.sourceUrl = item.sourceUrl;
      if (split.sourceValue) existing.sourceValue = split.sourceValue;
      updated++;
      continue;
    }

    const row = {
      id: crypto.randomBytes(8).toString('hex'),
      U: split.U,
      P: split.P,
      Website,
      sourceValue: split.sourceValue,
      sourceUrl: item.sourceUrl ?? null,
      createdAt: now,
      updatedAt: now,
      seenCount: 1,
    };

    db.entries.push(row);
    index.set(key, row);
    added++;
  }

  await saveColonDb(db);

  return {
    added,
    updated,
    skipped,
    total: db.entries.length,
  };
  });
}

export async function deleteColonEntry(id) {
  const needle = String(id ?? '').trim();
  if (!needle) throw new Error('Entry id required');

  return withColonDbWrite(async () => {
  cache = null;
  const db = await loadColonDb();
  const before = db.entries.length;
  db.entries = db.entries.filter((e) => e.id !== needle);
  if (db.entries.length === before) throw new Error('Entry not found');

  await saveColonDb(db);
  return { ok: true, id: needle, total: db.entries.length };
  });
}