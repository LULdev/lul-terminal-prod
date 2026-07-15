/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { assertMimeMatchesBuffer } from './imageMime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_ROOT = path.join(__dirname, '..', 'data', 'image-host');
export const FILES_DIR = path.join(DATA_ROOT, 'files');
export const META_DIR = path.join(DATA_ROOT, 'meta');
export const STATS_FILE = path.join(DATA_ROOT, 'stats.json');

export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
]);

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

export function extFromMime(mime) {
  return MIME_EXT[mime] ?? 'bin';
}

export function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

export function isValidId(id) {
  return /^[a-f0-9]{16}$/.test(id);
}

async function ensureDirs() {
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.mkdir(META_DIR, { recursive: true });
}

export async function readStats() {
  await ensureDirs();
  try {
    await fs.access(STATS_FILE);
  } catch {
    return { imagesHosted: 0, imageViewsTotal: 0 };
  }
  try {
    const raw = await fs.readFile(STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      imagesHosted: parsed.imagesHosted ?? 0,
      imageViewsTotal: parsed.imageViewsTotal ?? 0,
    };
  } catch (err) {
    console.error('[image-host] CRITICAL: stats.json unreadable', err);
    throw new Error('Image hosting stats unavailable');
  }
}

async function writeStats(stats) {
  const tmp = `${STATS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(stats, null, 2), 'utf8');
  await fs.rename(tmp, STATS_FILE);
}

let imageWriteChain = Promise.resolve();

function withImageWrite(task) {
  const run = imageWriteChain.then(() => task());
  imageWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function saveImage({ name, mime, size, width, height, buffer, userId, source }) {
  if (!ALLOWED_MIME.has(mime)) throw new Error('Invalid file type');
  if (size > MAX_BYTES || buffer.length > MAX_BYTES) throw new Error('File too large (max 10 MB)');
  if (!buffer?.length) throw new Error('Empty file');
  assertMimeMatchesBuffer(mime, buffer);

  return withImageWrite(async () => {
    await ensureDirs();
    const id = generateId();
    const ext = extFromMime(mime);
    const filename = `${id}.${ext}`;
    const filePath = path.join(FILES_DIR, filename);
    const metaPath = path.join(META_DIR, `${id}.json`);

    const meta = {
      id,
      filename,
      name: String(name).slice(0, 200),
      mime,
      size: buffer.length,
      width: width || undefined,
      height: height || undefined,
      createdAt: Date.now(),
      views: 0,
      userId: userId ? String(userId).slice(0, 32) : undefined,
      favorite: false,
      tags: [],
      ...(source === 'meme' ? { source: 'meme' } : {}),
    };

    const fileTmp = `${filePath}.tmp`;
    await fs.writeFile(fileTmp, buffer);
    await fs.rename(fileTmp, filePath);
    const metaTmp = `${metaPath}.tmp`;
    await fs.writeFile(metaTmp, JSON.stringify(meta, null, 2), 'utf8');
    await fs.rename(metaTmp, metaPath);

    const stats = await readStats();
    stats.imagesHosted += 1;
    await writeStats(stats);

    return meta;
  });
}

export async function getMeta(id) {
  if (!isValidId(id)) return null;
  try {
    const raw = await fs.readFile(path.join(META_DIR, `${id}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getFilePath(id) {
  const meta = await getMeta(id);
  if (!meta) return null;
  const filePath = path.join(FILES_DIR, meta.filename);
  try {
    await fs.access(filePath);
    return { filePath, meta };
  } catch {
    return null;
  }
}

export async function recordView(id) {
  return withImageWrite(async () => {
    const meta = await getMeta(id);
    if (!meta) return null;

    meta.views = (meta.views ?? 0) + 1;
    const metaPath = path.join(META_DIR, `${id}.json`);
    const tmp = `${metaPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(meta, null, 2), 'utf8');
    await fs.rename(tmp, metaPath);

    const stats = await readStats();
    stats.imageViewsTotal += 1;
    await writeStats(stats);

    return { views: meta.views, imageViewsTotal: stats.imageViewsTotal };
  });
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 12);
}

export async function listAllMeta() {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(META_DIR, f), 'utf8');
      out.push(JSON.parse(raw));
    } catch { /* skip corrupt */ }
  }
  return out;
}

export async function listImagesByUser(userId) {
  if (!userId) return [];
  const uid = String(userId).slice(0, 32);
  const all = await listAllMeta();
  return all.filter((m) => String(m.userId) === uid);
}

export async function computeUserGalleryStats(userId) {
  const images = await listImagesByUser(userId);
  const totalViews = images.reduce((s, m) => s + (m.views ?? 0), 0);
  const totalBytes = images.reduce((s, m) => s + (m.size ?? 0), 0);
  const favorites = images.filter((m) => m.favorite).length;
  const byMime = {};
  for (const m of images) {
    const key = m.mime ?? 'unknown';
    byMime[key] = (byMime[key] ?? 0) + 1;
  }
  const topViewed = [...images].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] ?? null;
  return {
    count: images.length,
    totalViews,
    totalBytes,
    favorites,
    avgViews: images.length ? Math.round((totalViews / images.length) * 10) / 10 : 0,
    byMime,
    topViewedId: topViewed?.id ?? null,
    topViewedViews: topViewed?.views ?? 0,
    storageLimitBytes: MAX_BYTES * 50,
  };
}

export async function updateImageRecord(id, userId, patch = {}) {
  return withImageWrite(async () => {
    const meta = await getMeta(id);
    if (!meta) throw new Error('Image not found');
    if (!userId || String(meta.userId) !== String(userId).slice(0, 32)) {
      throw new Error('Permission denied');
    }

    if (patch.name !== undefined) {
      meta.name = String(patch.name).trim().slice(0, 200) || meta.name;
    }
    if (patch.favorite !== undefined) {
      meta.favorite = Boolean(patch.favorite);
    }
    if (patch.tags !== undefined) {
      meta.tags = normalizeTags(patch.tags);
    }

    meta.updatedAt = Date.now();
    const metaPath = path.join(META_DIR, `${id}.json`);
    const metaTmp = `${metaPath}.tmp`;
    await fs.writeFile(metaTmp, JSON.stringify(meta, null, 2), 'utf8');
    await fs.rename(metaTmp, metaPath);
    return meta;
  });
}

export async function deleteImageRecord(id, userId) {
  return withImageWrite(async () => {
    const meta = await getMeta(id);
    if (!meta) throw new Error('Image not found');
    if (!userId || String(meta.userId) !== String(userId).slice(0, 32)) {
      throw new Error('Permission denied');
    }
    return removeImageFiles(id, meta);
  });
}

export async function adminDeleteImage(id) {
  return withImageWrite(async () => {
    const meta = await getMeta(id);
    if (!meta) throw new Error('Image not found');
    return removeImageFiles(id, meta);
  });
}

async function removeImageFiles(id, meta) {
  const filePath = path.join(FILES_DIR, meta.filename);
  await Promise.allSettled([
    fs.unlink(filePath),
    fs.unlink(path.join(META_DIR, `${id}.json`)),
  ]);

  const stats = await readStats();
  stats.imagesHosted = Math.max(0, (stats.imagesHosted ?? 0) - 1);
  await writeStats(stats);

  return { ok: true, id };
}

export async function adminListImages({ limit = 120, q, sort = 'newest' } = {}) {
  const cap = Math.min(300, Math.max(1, Number(limit) || 120));
  let list = await listAllMeta();

  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (m) =>
        (m.name ?? '').toLowerCase().includes(needle) ||
        (m.id ?? '').toLowerCase().includes(needle) ||
        (m.userId ?? '').toLowerCase().includes(needle) ||
        (m.mime ?? '').toLowerCase().includes(needle),
    );
  }

  if (sort === 'views') {
    list.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  } else if (sort === 'size') {
    list.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
  } else if (sort === 'oldest') {
    list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  } else {
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  const images = list.slice(0, cap).map((m) => ({
    id: m.id,
    name: m.name,
    mime: m.mime,
    size: m.size ?? 0,
    width: m.width ?? null,
    height: m.height ?? null,
    views: m.views ?? 0,
    userId: m.userId ?? null,
    favorite: Boolean(m.favorite),
    tags: m.tags ?? [],
    createdAt: m.createdAt ?? null,
    updatedAt: m.updatedAt ?? null,
    url: `/hosting/${m.id}`,
  }));

  const totalBytes = list.reduce((s, m) => s + (m.size ?? 0), 0);

  return {
    images,
    total: list.length,
    stats: {
      onDisk: list.length,
      totalBytes,
      totalViews: list.reduce((s, m) => s + (m.views ?? 0), 0),
    },
  };
}