/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_ROOT = path.join(__dirname, '..', 'data', 'paste');
export const META_DIR = path.join(DATA_ROOT, 'meta');
export const CONTENT_DIR = path.join(DATA_ROOT, 'content');
export const STATS_FILE = path.join(DATA_ROOT, 'stats.json');

export const MAX_BYTES = 512 * 1024;
export const ID_PATTERN = /^[A-Za-z0-9_-]{10,14}$/;

const EXPIRY_MS = {
  '10m': 10 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  never: null,
};

export function isValidId(id) {
  // Accept 6–32 chars so older/shorter IDs still load; generateId still emits 12.
  return typeof id === 'string' && /^[A-Za-z0-9_-]{6,32}$/.test(id);
}

export function generateId() {
  return crypto.randomBytes(8).toString('base64url').slice(0, 12);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** @typedef {'public' | 'private' | 'protected'} PasteVisibility */

export function normalizeStoredVisibility(meta) {
  if (!meta) return meta;
  if (meta.visibility === 'protected') return meta;
  if (meta.visibility === 'unlisted') return { ...meta, visibility: 'private' };
  if (meta.visibility === 'private' && meta.passwordHash) {
    return { ...meta, visibility: 'protected' };
  }
  if (meta.visibility === 'public' || meta.visibility === 'private') return meta;
  return { ...meta, visibility: 'public' };
}

export function normalizeVisibilityInput(visibility, password) {
  let vis = 'public';
  if (visibility === 'private' || visibility === 'protected' || visibility === 'public') {
    vis = visibility;
  } else if (visibility === 'unlisted') {
    vis = 'private';
  }
  const trimmed = String(password ?? '').trim();
  if (vis === 'protected') {
    if (!trimmed) throw new Error('Password required for protected pastes');
    return { visibility: 'protected', passwordHash: hashPassword(trimmed) };
  }
  return { visibility: vis, passwordHash: null };
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

function resolveExpiry(expiry) {
  if (!expiry || expiry === 'never') return null;
  const ms = EXPIRY_MS[expiry];
  if (!ms) return Date.now() + EXPIRY_MS['1d'];
  return Date.now() + ms;
}

async function ensureDirs() {
  await fs.mkdir(META_DIR, { recursive: true });
  await fs.mkdir(CONTENT_DIR, { recursive: true });
}

export async function readStats() {
  await ensureDirs();
  try {
    await fs.access(STATS_FILE);
  } catch {
    return { pastesCreated: 0, pasteViewsTotal: 0, activePastes: 0 };
  }
  try {
    const raw = await fs.readFile(STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      pastesCreated: parsed.pastesCreated ?? 0,
      pasteViewsTotal: parsed.pasteViewsTotal ?? 0,
      activePastes: parsed.activePastes ?? 0,
    };
  } catch (err) {
    console.error('[paste] CRITICAL: stats.json unreadable', err);
    throw new Error('Paste stats unavailable');
  }
}

async function writeStats(stats) {
  const tmp = `${STATS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(stats, null, 2), 'utf8');
  await fs.rename(tmp, STATS_FILE);
}

async function writeMetaAtomic(id, meta) {
  const metaPath = path.join(META_DIR, `${id}.json`);
  const tmp = `${metaPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(meta, null, 2), 'utf8');
  await fs.rename(tmp, metaPath);
}

async function writeContentAtomic(id, text) {
  const contentPath = path.join(CONTENT_DIR, `${id}.txt`);
  const tmp = `${contentPath}.tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, contentPath);
}

let pasteWriteChain = Promise.resolve();

function withPasteWrite(task) {
  const run = pasteWriteChain.then(() => task());
  pasteWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function countActivePastes() {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  let count = 0;
  const now = Date.now();
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(META_DIR, file), 'utf8'));
      if (meta.expiresAt && meta.expiresAt <= now) continue;
      count += 1;
    } catch { /* skip */ }
  }
  return count;
}

export async function getMeta(id) {
  if (!isValidId(id)) return null;
  try {
    const raw = await fs.readFile(path.join(META_DIR, `${id}.json`), 'utf8');
    return normalizeStoredVisibility(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getContent(id) {
  if (!isValidId(id)) return null;
  try {
    return await fs.readFile(path.join(CONTENT_DIR, `${id}.txt`), 'utf8');
  } catch {
    return null;
  }
}

async function deletePasteFiles(id) {
  await Promise.allSettled([
    fs.unlink(path.join(META_DIR, `${id}.json`)),
    fs.unlink(path.join(CONTENT_DIR, `${id}.txt`)),
  ]);
}

async function purgeIfExpiredInner(meta) {
  if (!meta) return null;
  if (!meta.expiresAt || meta.expiresAt > Date.now()) return meta;
  const fresh = await getMeta(meta.id);
  if (!fresh?.expiresAt || fresh.expiresAt > Date.now()) return fresh;
  await deletePasteFiles(fresh.id);
  const stats = await readStats();
  stats.activePastes = await countActivePastes();
  await writeStats(stats);
  return null;
}

/** @param {{ inWrite?: boolean }} [opts] Pass inWrite:true when already inside withPasteWrite to avoid deadlock. */
export async function purgeIfExpired(meta, opts = {}) {
  if (!meta) return null;
  if (!meta.expiresAt || meta.expiresAt > Date.now()) return meta;
  if (opts.inWrite) return purgeIfExpiredInner(meta);
  return withPasteWrite(() => purgeIfExpiredInner(meta));
}

/** Read-only expiry filter for list endpoints — avoids purge side-effects outside write lock. */
export function filterAliveMeta(meta) {
  if (!meta) return null;
  if (!meta.expiresAt || meta.expiresAt > Date.now()) return meta;
  return null;
}

export async function savePaste({
  title,
  content,
  language,
  visibility,
  password,
  expiry,
  burnAfterRead,
  userId,
  username,
}) {
  return withPasteWrite(async () => {
    const text = String(content ?? '');
    const bytes = Buffer.byteLength(text, 'utf8');
    if (!text.trim()) throw new Error('Paste content is empty');
    if (bytes > MAX_BYTES) throw new Error(`Paste too large (max ${MAX_BYTES / 1024} KB)`);

    await ensureDirs();
    const id = generateId();
    const now = Date.now();
    const { visibility: vis, passwordHash } = normalizeVisibilityInput(visibility, password);

    const meta = {
      id,
      title: String(title || 'Untitled Paste').slice(0, 120),
      language: String(language || 'plaintext').slice(0, 32),
      visibility: vis,
      passwordHash,
      expiresAt: resolveExpiry(expiry),
      burnAfterRead: Boolean(burnAfterRead),
      createdAt: now,
      updatedAt: now,
      views: 0,
      userId: userId ? String(userId).slice(0, 32) : null,
      username: username ? String(username).slice(0, 48) : null,
      size: bytes,
      lineCount: text.split('\n').length,
      pinned: false,
      ratingVotes: {},
      ratingSum: 0,
      ratingCount: 0,
      ratingAvg: 0,
    };

    await writeContentAtomic(id, text);
    await writeMetaAtomic(id, meta);

    const stats = await readStats();
    stats.pastesCreated += 1;
    stats.activePastes = await countActivePastes();
    await writeStats(stats);

    return meta;
  });
}

export async function recordView(id, { consumeBurn = true } = {}) {
  return withPasteWrite(async () => {
    const meta = await purgeIfExpired(await getMeta(id), { inWrite: true });
    if (!meta) return null;

    let content = null;
    try {
      content = await fs.readFile(path.join(CONTENT_DIR, `${id}.txt`), 'utf8');
    } catch { /* content may already be gone */ }

    meta.views = (meta.views ?? 0) + 1;
    meta.updatedAt = Date.now();

    const stats = await readStats();
    stats.pasteViewsTotal += 1;

    if (meta.burnAfterRead && consumeBurn) {
      await deletePasteFiles(id);
      stats.activePastes = await countActivePastes();
      await writeStats(stats);
      return { meta, burned: true, content };
    }

    const metaPath = path.join(META_DIR, `${id}.json`);
    const tmp = `${metaPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(meta, null, 2), 'utf8');
    await fs.rename(tmp, metaPath);
    await writeStats(stats);
    return { meta, burned: false, content };
  });
}

export function sortPastes(pastes, sort = 'newest') {
  const list = [...pastes];
  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    case 'views':
      return list.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    case 'size':
      return list.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    case 'title':
      return list.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
    case 'pinned':
      return list.sort((a, b) => {
        const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        if (pinDiff !== 0) return pinDiff;
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
    case 'newest':
    default:
      return list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
}

export async function listByUser(userId, sort = 'newest') {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  const out = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(META_DIR, file), 'utf8'));
      const alive = filterAliveMeta(meta);
      if (!alive || String(alive.userId) !== String(userId)) continue;
      out.push(alive);
    } catch { /* skip */ }
  }
  return sortPastes(out, sort);
}

export async function computeUserPasteStats(userId) {
  const pastes = await listByUser(userId, 'newest');
  const totalViews = pastes.reduce((s, m) => s + (m.views ?? 0), 0);
  const totalBytes = pastes.reduce((s, m) => s + (m.size ?? 0), 0);
  const totalLines = pastes.reduce((s, m) => s + (m.lineCount ?? 0), 0);
  const pinned = pastes.filter((m) => m.pinned).length;
  const byVisibility = {};
  const byLanguage = {};
  let burnAfterRead = 0;
  let protectedCount = 0;
  for (const m of pastes) {
    const vis = m.visibility ?? 'public';
    byVisibility[vis] = (byVisibility[vis] ?? 0) + 1;
    const lang = m.language ?? 'plaintext';
    byLanguage[lang] = (byLanguage[lang] ?? 0) + 1;
    if (m.burnAfterRead) burnAfterRead += 1;
    if (m.visibility === 'protected') protectedCount += 1;
  }
  const topViewed = [...pastes].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] ?? null;
  return {
    count: pastes.length,
    totalViews,
    totalBytes,
    totalLines,
    pinned,
    burnAfterRead,
    protectedCount,
    avgViews: pastes.length ? Math.round((totalViews / pastes.length) * 10) / 10 : 0,
    byVisibility,
    byLanguage,
    topViewedId: topViewed?.id ?? null,
    topViewedTitle: topViewed?.title ?? null,
    topViewedViews: topViewed?.views ?? 0,
  };
}

export async function listPublicArchive(limit = 40) {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  const out = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(META_DIR, file), 'utf8'));
      const alive = filterAliveMeta(meta);
      if (!alive || alive.visibility !== 'public') continue;
      out.push(alive);
    } catch { /* skip */ }
  }
  return out
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit);
}

export async function listTrendingPublic(limit = 12) {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  const out = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(META_DIR, file), 'utf8'));
      const alive = filterAliveMeta(meta);
      if (!alive || alive.visibility !== 'public') continue;
      out.push(alive);
    } catch { /* skip */ }
  }
  return out
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit);
}

async function applyPastePatch(meta, patch) {
  if (patch.title !== undefined) meta.title = String(patch.title).slice(0, 120);
  if (patch.language !== undefined) meta.language = String(patch.language).slice(0, 32);
  if (patch.visibility !== undefined) {
    if (patch.visibility === 'protected') {
      const pw = String(patch.password ?? '').trim();
      if (!pw && !meta.passwordHash) throw new Error('Password required for protected pastes');
      meta.visibility = 'protected';
      if (pw) meta.passwordHash = hashPassword(pw);
    } else if (patch.visibility === 'private' || patch.visibility === 'public') {
      meta.visibility = patch.visibility;
      meta.passwordHash = null;
    }
  } else if (patch.password !== undefined && meta.visibility === 'protected') {
    const pw = String(patch.password).trim();
    if (!pw) throw new Error('Password required for protected pastes');
    meta.passwordHash = hashPassword(pw);
  }
  if (patch.expiry !== undefined) meta.expiresAt = resolveExpiry(patch.expiry);
  if (patch.burnAfterRead !== undefined) meta.burnAfterRead = Boolean(patch.burnAfterRead);
  if (patch.pinned !== undefined) meta.pinned = Boolean(patch.pinned);

  if (patch.content !== undefined) {
    const text = String(patch.content);
    const bytes = Buffer.byteLength(text, 'utf8');
    if (!text.trim()) throw new Error('Paste content is empty');
    if (bytes > MAX_BYTES) throw new Error(`Paste too large (max ${MAX_BYTES / 1024} KB)`);
    await writeContentAtomic(meta.id, text);
    meta.size = bytes;
    meta.lineCount = text.split('\n').length;
  }

  meta.updatedAt = Date.now();
  await writeMetaAtomic(meta.id, meta);
  return meta;
}

export async function updatePaste(id, userId, patch) {
  return withPasteWrite(async () => {
    const meta = await purgeIfExpired(await getMeta(id), { inWrite: true });
    if (!meta) throw new Error('Paste not found');
    if (String(meta.userId) !== String(userId)) throw new Error('Not allowed');
    return applyPastePatch(meta, patch);
  });
}

export async function adminUpdatePaste(id, patch) {
  return withPasteWrite(async () => {
    const meta = await purgeIfExpired(await getMeta(id), { inWrite: true });
    if (!meta) throw new Error('Paste not found');
    return applyPastePatch(meta, patch);
  });
}

export async function adminDeletePaste(id) {
  return withPasteWrite(async () => {
    const meta = await getMeta(id);
    if (!meta) throw new Error('Paste not found');
    await deletePasteFiles(id);
    const stats = await readStats();
    stats.activePastes = await countActivePastes();
    await writeStats(stats);
    return { ok: true, id };
  });
}

export async function listAllPastes({
  q,
  visibility,
  sort = 'newest',
  limit = 100,
  offset = 0,
} = {}) {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  const out = [];
  const needle = q ? String(q).trim().toLowerCase() : '';
  const visFilter = visibility && visibility !== 'all' ? String(visibility) : null;

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(META_DIR, file), 'utf8'));
      const alive = filterAliveMeta(meta);
      if (!alive) continue;
      if (visFilter && alive.visibility !== visFilter) continue;
      if (needle) {
        const hay = `${alive.title ?? ''} ${alive.id ?? ''} ${alive.username ?? ''} ${alive.userId ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      out.push(alive);
    } catch { /* skip */ }
  }

  const sorted = sortPastes(out, sort);
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  return {
    pastes: sorted.slice(safeOffset, safeOffset + safeLimit),
    total: sorted.length,
  };
}

export async function computeAdminPasteStats() {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  const byVisibility = {};
  let total = 0;
  let burnAfterRead = 0;
  let protectedCount = 0;
  let totalViews = 0;
  let totalBytes = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(META_DIR, file), 'utf8'));
      const m = filterAliveMeta(meta);
      if (!m) continue;
      total += 1;
      const vis = m.visibility ?? 'public';
      byVisibility[vis] = (byVisibility[vis] ?? 0) + 1;
      if (m.burnAfterRead) burnAfterRead += 1;
      if (m.visibility === 'protected') protectedCount += 1;
      totalViews += m.views ?? 0;
      totalBytes += m.size ?? 0;
    } catch { /* skip */ }
  }
  return {
    total,
    byVisibility,
    burnAfterRead,
    protectedCount,
    totalViews,
    totalBytes,
  };
}

export async function ratePaste(id, userId, stars) {
  return withPasteWrite(async () => {
    const meta = await purgeIfExpired(await getMeta(id), { inWrite: true });
    if (!meta) throw new Error('Paste not found');
    const uid = String(userId).slice(0, 32);
    const raw = Number(stars);
    if (!Number.isFinite(raw)) throw new Error('Invalid rating');
    const value = Math.min(5, Math.max(1, Math.round(raw)));
    if (!meta.ratingVotes || typeof meta.ratingVotes !== 'object') meta.ratingVotes = {};
    const prev = meta.ratingVotes[uid];
    let sum = Number(meta.ratingSum) || 0;
    let count = Number(meta.ratingCount) || 0;
    if (prev) {
      sum = sum - prev + value;
    } else {
      sum += value;
      count += 1;
    }
    meta.ratingVotes[uid] = value;
    meta.ratingSum = sum;
    meta.ratingCount = count;
    meta.ratingAvg = count ? Math.round((sum / count) * 10) / 10 : 0;
    meta.updatedAt = Date.now();
    await writeMetaAtomic(id, meta);
    return {
      ratingAvg: meta.ratingAvg,
      ratingCount: meta.ratingCount,
      userRating: value,
    };
  });
}

export function getUserPasteRating(meta, userId) {
  if (!meta?.ratingVotes || !userId) return null;
  const v = meta.ratingVotes[String(userId).slice(0, 32)];
  return v ? Number(v) : null;
}

export async function deletePaste(id, userId) {
  return withPasteWrite(async () => {
    const meta = await getMeta(id);
    if (!meta) throw new Error('Paste not found');
    if (String(meta.userId) !== String(userId)) throw new Error('Not allowed');
    await deletePasteFiles(id);
    const stats = await readStats();
    stats.activePastes = await countActivePastes();
    await writeStats(stats);
    return { ok: true, id };
  });
}