/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'feeds');
const NEWS_FILE = path.join(ROOT, 'news.json');

const SEED_ARTICLES = [
  {
    id: 'anomaly-sector-14',
    category: 'CRITICAL EMERGENCY BULLETIN',
    title: 'Anomaly localized in sector 14',
    body: 'A dynamic gravity-folding entities have breached primary sandbox buffers. System alert code orange is active.',
    icon: '🚨',
    highlight: true,
    publishedAt: '2026-07-04T06:14:04.000Z',
    authorId: 'system',
    authorName: 'LUL Terminal',
  },
  {
    id: 'password-lasanga',
    category: 'NETWORK SYS ANNOUNCEMENT',
    title: 'Password "Lasanga" verified',
    body: "Secure database hashes updated. Members must provide 'Lasanga' values to gain dashboard grid authority.",
    icon: '🔐',
    highlight: false,
    publishedAt: '2026-07-03T12:00:00.000Z',
    authorId: 'system',
    authorName: 'LUL Terminal',
  },
];

const EMPTY = { version: 1, feedVersion: '0.0.0', updatedAt: null, articles: [] };

function sanitizeId(id) {
  return String(id ?? '').trim().slice(0, 48).replace(/[^a-zA-Z0-9._-]/g, '');
}

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

function bumpFeedVersion(db) {
  db.feedVersion = new Date().toISOString().slice(0, 19);
  return db.feedVersion;
}

function normalizeArticle(raw) {
  const now = new Date().toISOString();
  const id = sanitizeId(raw.id) || newId();
  return {
    id,
    title: String(raw.title ?? '').trim().slice(0, 160),
    body: String(raw.body ?? '').trim().slice(0, 8000),
    category: String(raw.category ?? 'BULLETIN').trim().slice(0, 80) || 'BULLETIN',
    icon: String(raw.icon ?? '📰').trim().slice(0, 8) || '📰',
    highlight: Boolean(raw.highlight),
    active: raw.active !== false,
    publishedAt: raw.publishedAt ? String(raw.publishedAt) : now,
    createdAt: raw.createdAt ? String(raw.createdAt) : now,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : now,
    authorId: String(raw.authorId ?? 'system').slice(0, 32),
    authorName: String(raw.authorName ?? 'LUL Terminal').trim().slice(0, 64) || 'LUL Terminal',
  };
}

function sortArticles(list) {
  return [...list].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

async function ensureStore() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    await fs.access(NEWS_FILE);
  } catch {
    const now = new Date().toISOString();
    const articles = SEED_ARTICLES.map((a) =>
      normalizeArticle({ ...a, active: true, createdAt: now, updatedAt: now }),
    );
    const db = {
      version: 1,
      feedVersion: '1.0.0',
      updatedAt: now,
      articles,
    };
    const tmp = `${NEWS_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(tmp, NEWS_FILE);
  }
}

async function readDb() {
  await ensureStore();
  try {
    const raw = await fs.readFile(NEWS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      version: 1,
      feedVersion: String(data.feedVersion ?? '0.0.0').slice(0, 32),
      updatedAt: data.updatedAt ?? null,
      articles: Array.isArray(data.articles) ? data.articles.map(normalizeArticle) : [],
    };
  } catch (err) {
    console.error('[news] CRITICAL: news.json unreadable', err);
    throw new Error('News feed unavailable');
  }
}

async function writeDb(db) {
  await ensureStore();
  db.updatedAt = new Date().toISOString();
  const tmp = `${NEWS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, NEWS_FILE);
}

let newsWriteChain = Promise.resolve();

function withNewsWrite(task) {
  const run = newsWriteChain.then(() => task());
  newsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function getNewsFeedVersion() {
  const db = await readDb();
  return db.feedVersion;
}

export async function listPublishedArticles() {
  const db = await readDb();
  return {
    feedVersion: db.feedVersion,
    articles: sortArticles(db.articles.filter((a) => a.active)),
  };
}

export async function listAllArticles() {
  const db = await readDb();
  return {
    feedVersion: db.feedVersion,
    articles: sortArticles(db.articles),
  };
}

export async function getArticleById(id) {
  const postId = sanitizeId(id);
  if (!postId) return null;
  const db = await readDb();
  return db.articles.find((a) => a.id === postId) ?? null;
}

export async function createArticle(payload, author) {
  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  if (!title || !body) throw new Error('Title and body required');

  return withNewsWrite(async () => {
    const now = new Date().toISOString();
    const db = await readDb();
    const article = normalizeArticle({
      id: payload.id ? sanitizeId(payload.id) : newId(),
      title,
      body,
      category: payload.category,
      icon: payload.icon,
      highlight: payload.highlight,
      active: payload.active !== false,
      publishedAt: payload.publishedAt ?? now,
      createdAt: now,
      updatedAt: now,
      authorId: author?.id ?? 'system',
      authorName: author?.displayName ?? author?.username ?? 'Admin',
    });

    if (db.articles.some((a) => a.id === article.id)) throw new Error('Article ID already taken');
    db.articles.push(article);
    bumpFeedVersion(db);
    await writeDb(db);
    return article;
  });
}

export async function updateArticle(id, payload) {
  const postId = sanitizeId(id);
  if (!postId) throw new Error('Invalid ID');

  return withNewsWrite(async () => {
    const db = await readDb();
    const idx = db.articles.findIndex((a) => a.id === postId);
    if (idx < 0) throw new Error('Article not found');

    const prev = db.articles[idx];
    const now = new Date().toISOString();
    const next = normalizeArticle({
      ...prev,
      title: payload.title !== undefined ? payload.title : prev.title,
      body: payload.body !== undefined ? payload.body : prev.body,
      category: payload.category !== undefined ? payload.category : prev.category,
      icon: payload.icon !== undefined ? payload.icon : prev.icon,
      highlight: payload.highlight !== undefined ? payload.highlight : prev.highlight,
      active: payload.active !== undefined ? payload.active : prev.active,
      publishedAt: payload.publishedAt !== undefined ? payload.publishedAt : prev.publishedAt,
      updatedAt: now,
    });

    if (!next.title.trim() || !next.body.trim()) throw new Error('Title and body required');
    db.articles[idx] = next;
    bumpFeedVersion(db);
    await writeDb(db);
    return next;
  });
}

export async function deleteArticle(id) {
  const postId = sanitizeId(id);
  if (!postId) throw new Error('Invalid ID');

  return withNewsWrite(async () => {
    const db = await readDb();
    const before = db.articles.length;
    db.articles = db.articles.filter((a) => a.id !== postId);
    if (db.articles.length === before) throw new Error('Article not found');
    bumpFeedVersion(db);
    await writeDb(db);
    return { ok: true };
  });
}