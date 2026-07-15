/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'feeds');
const VIEWS_FILE = path.join(ROOT, 'post-views.json');

const EMPTY = { version: 1, updatedAt: null, changelog: {}, news: {} };

export function sanitizePostId(id) {
  return String(id ?? '').trim().slice(0, 48).replace(/[^a-zA-Z0-9._-]/g, '');
}

async function ensureStore() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    await fs.access(VIEWS_FILE);
  } catch {
    const tmp = `${VIEWS_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(EMPTY, null, 2), 'utf8');
    await fs.rename(tmp, VIEWS_FILE);
  }
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readDb() {
  await ensureStore();
  if (!(await fileExists(VIEWS_FILE))) return structuredClone(EMPTY);
  try {
    const raw = await fs.readFile(VIEWS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      version: 1,
      updatedAt: data.updatedAt ?? null,
      changelog: data.changelog && typeof data.changelog === 'object' ? { ...data.changelog } : {},
      news: data.news && typeof data.news === 'object' ? { ...data.news } : {},
    };
  } catch (err) {
    console.error('[post-views] CRITICAL: post-views.json unreadable', err);
    throw new Error('Post views database unavailable');
  }
}

async function writeDb(db) {
  await ensureStore();
  db.updatedAt = new Date().toISOString();
  const tmp = `${VIEWS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, VIEWS_FILE);
}

let viewsWriteChain = Promise.resolve();

function withViewsWrite(task) {
  const run = viewsWriteChain.then(() => task());
  viewsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function getAllPostViews() {
  const db = await readDb();
  return { changelog: db.changelog, news: db.news };
}

export async function recordPostView(type, id) {
  const postId = sanitizePostId(id);
  if (!postId) return null;
  const bucket = type === 'news' ? 'news' : 'changelog';
  return withViewsWrite(async () => {
    const db = await readDb();
    db[bucket][postId] = Math.max(0, Number(db[bucket][postId]) || 0) + 1;
    await writeDb(db);
    return { type: bucket, id: postId, views: db[bucket][postId] };
  });
}