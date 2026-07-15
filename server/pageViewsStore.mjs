/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'analytics');
const VIEWS_FILE = path.join(ROOT, 'page-views.json');

const EMPTY = { version: 1, updatedAt: null, pages: {} };

export function sanitizePageId(id) {
  return String(id ?? '').trim().slice(0, 24).replace(/[^a-z0-9_-]/gi, '');
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
      pages: data.pages && typeof data.pages === 'object' ? { ...data.pages } : {},
    };
  } catch (err) {
    console.error('[page-views] CRITICAL: page-views.json unreadable', err);
    throw new Error('Page views database unavailable');
  }
}

async function writeDb(db) {
  await ensureStore();
  db.updatedAt = new Date().toISOString();
  const tmp = `${VIEWS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, VIEWS_FILE);
}

let pageViewsWriteChain = Promise.resolve();

function withPageViewsWrite(task) {
  const run = pageViewsWriteChain.then(() => task());
  pageViewsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function getAllPageViews() {
  const db = await readDb();
  return { pages: db.pages, updatedAt: db.updatedAt };
}

export async function getPageViews(pageId) {
  const id = sanitizePageId(pageId);
  if (!id) return 0;
  const db = await readDb();
  return Math.max(0, Number(db.pages[id]) || 0);
}

export async function recordPageView(pageId) {
  const id = sanitizePageId(pageId);
  if (!id) return null;
  return withPageViewsWrite(async () => {
    const db = await readDb();
    db.pages[id] = Math.max(0, Number(db.pages[id]) || 0) + 1;
    await writeDb(db);
    return { pageId: id, views: db.pages[id] };
  });
}