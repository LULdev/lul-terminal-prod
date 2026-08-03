/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { assertMimeMatchesBuffer } from './imageMime.mjs';
import { sanitizeSvgBuffer } from './svgSanitize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'chat', 'emotes');
const META_FILE = path.join(DATA_DIR, 'emotes.json');

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);
const MAX_BYTES = 3 * 1024 * 1024;

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const PLACEHOLDER_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#f43f5e', '#10b981'];

export function normalizeEmoteCode(raw) {
  const code = String(raw ?? '').trim().replace(/^:+|:+$/g, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(code)) {
    throw new Error('Code must start with a letter and use only letters, numbers, underscore (max 24 chars)');
  }
  return code;
}

function newEmoteId() {
  return crypto.randomBytes(6).toString('hex');
}

function placeholderSvg(label, color, code) {
  const safe = String(label).slice(0, 16).replace(/[<>&"]/g, '');
  const safeCode = String(code).slice(0, 12);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${color}" opacity="0.25"/>
  <rect x="4" y="4" width="56" height="56" rx="10" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="32" y="28" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="${color}">${safeCode}</text>
  <text x="32" y="44" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="8" fill="#e2e8f0">${safe}</text>
</svg>`;
}

function publicEmote(row) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    url: row.url,
    enabled: row.enabled !== false,
    isPlaceholder: Boolean(row.isPlaceholder),
  };
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(META_FILE);
  } catch {
    const empty = { version: 1, updatedAt: null, emotes: [] };
    const tmp = `${META_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(empty, null, 2), 'utf8');
    await fs.rename(tmp, META_FILE);
  }
}

export async function loadEmotesDb() {
  await ensureStore();
  try {
    const raw = await fs.readFile(META_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      version: data.version ?? 1,
      updatedAt: data.updatedAt ?? null,
      emotes: Array.isArray(data.emotes) ? data.emotes : [],
    };
  } catch (err) {
    console.error('[chat-emotes] CRITICAL: emotes.json unreadable', err);
    throw new Error('Emotes database unavailable');
  }
}

async function writeEmoteFile(filename, payload) {
  const safe = path.basename(filename);
  const filePath = path.join(DATA_DIR, safe);
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, payload);
  await fs.rename(tmp, filePath);
}

async function saveEmotesDb(db) {
  db.updatedAt = new Date().toISOString();
  const tmp = `${META_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, META_FILE);
}

let emotesWriteChain = Promise.resolve();

export function withEmotesWrite(task) {
  const run = emotesWriteChain.then(() => task());
  emotesWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function seedDefaultEmotesIfEmpty() {
  return withEmotesWrite(async () => {
  const db = await loadEmotesDb();
  if (db.emotes.length) return db;

  const seeds = [
    { code: 'Emote1', label: 'LUL Wave' },
    { code: 'Emote2', label: 'GG' },
    { code: 'Emote3', label: 'Hype' },
    { code: 'Emote4', label: 'Rip' },
    { code: 'Emote5', label: 'Cool' },
  ];

  const now = Date.now();
  for (let i = 0; i < seeds.length; i += 1) {
    const id = newEmoteId();
    const ext = 'svg';
    const filename = `${id}.${ext}`;
    const svg = placeholderSvg(seeds[i].label, PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length], seeds[i].code);
    await writeEmoteFile(filename, svg);
    db.emotes.push({
      id,
      code: seeds[i].code,
      label: seeds[i].label,
      filename,
      mime: 'image/svg+xml',
      url: `/api/chat/emotes/files/${filename}`,
      enabled: true,
      isPlaceholder: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  await saveEmotesDb(db);
  return db;
  });
}

export async function listPublicEmotes() {
  const db = await seedDefaultEmotesIfEmpty();
  return {
    updatedAt: db.updatedAt,
    emotes: db.emotes.filter((e) => e.enabled !== false).map(publicEmote),
  };
}

export async function listAdminEmotes() {
  const db = await seedDefaultEmotesIfEmpty();
  return {
    updatedAt: db.updatedAt,
    emotes: db.emotes.map((e) => ({
      ...publicEmote(e),
      mime: e.mime,
      filename: e.filename,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
  };
}

export async function getEmoteMap() {
  const db = await seedDefaultEmotesIfEmpty();
  const map = new Map();
  for (const row of db.emotes) {
    if (row.enabled === false) continue;
    map.set(row.code.toLowerCase(), publicEmote(row));
  }
  return map;
}

export async function getEmoteFile(filename) {
  const safe = path.basename(filename);
  if (!/^[a-f0-9]{12}\.(png|jpg|jpeg|gif|webp|svg)$/i.test(safe)) return null;
  const db = await loadEmotesDb();
  const row = db.emotes.find((e) => e.filename === safe);
  if (!row || row.enabled === false) return null;
  const filePath = path.join(DATA_DIR, safe);
  try {
    let buf = await fs.readFile(filePath);
    const ext = safe.split('.').pop()?.toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
          : ext === 'webp' ? 'image/webp'
            : ext === 'svg' ? 'image/svg+xml'
              : 'application/octet-stream';
    if (mime === 'image/svg+xml') {
      buf = sanitizeSvgBuffer(buf);
    }
    return { buf, mime, filename: safe };
  } catch {
    return null;
  }
}

async function removeEmoteFile(filename) {
  if (!filename) return;
  try {
    await fs.unlink(path.join(DATA_DIR, path.basename(filename)));
  } catch { /* ignore */ }
}

export async function createEmote({ code, label, mime, buffer, enabled = true }) {
  return withEmotesWrite(async () => {
  const normalizedCode = normalizeEmoteCode(code);
  const db = await loadEmotesDb();
  if (db.emotes.some((e) => e.code.toLowerCase() === normalizedCode.toLowerCase())) {
    throw new Error('Emote code already exists');
  }
  if (!ALLOWED_MIME.has(mime)) throw new Error('Only PNG, JPEG, GIF, WebP or SVG allowed');
  if (!buffer?.length || buffer.length > MAX_BYTES) throw new Error('Image max 3 MB');

  let payload = buffer;
  if (mime === 'image/svg+xml') {
    payload = sanitizeSvgBuffer(buffer);
  } else {
    assertMimeMatchesBuffer(mime, buffer);
  }

  const id = newEmoteId();
  const ext = EXT_BY_MIME[mime] ?? 'png';
  const filename = `${id}.${ext}`;
  await writeEmoteFile(filename, payload);

  const now = Date.now();
  const row = {
    id,
    code: normalizedCode,
    label: String(label ?? normalizedCode).trim().slice(0, 48) || normalizedCode,
    filename,
    mime,
    url: `/api/chat/emotes/files/${filename}`,
    enabled: Boolean(enabled),
    isPlaceholder: false,
    createdAt: now,
    updatedAt: now,
  };
  db.emotes.push(row);
  await saveEmotesDb(db);
  return row;
  });
}

export async function updateEmote(id, patch) {
  return withEmotesWrite(async () => {
  const db = await loadEmotesDb();
  const row = db.emotes.find((e) => e.id === id);
  if (!row) throw new Error('Emote not found');

  if (patch.code != null) {
    const normalizedCode = normalizeEmoteCode(patch.code);
    if (db.emotes.some((e) => e.id !== id && e.code.toLowerCase() === normalizedCode.toLowerCase())) {
      throw new Error('Emote code already exists');
    }
    row.code = normalizedCode;
  }
  if (patch.label != null) row.label = String(patch.label).trim().slice(0, 48) || row.code;
  if (patch.enabled != null) row.enabled = Boolean(patch.enabled);
  row.updatedAt = Date.now();
  await saveEmotesDb(db);
  return row;
  });
}

export async function replaceEmoteImage(id, { mime, buffer }) {
  return withEmotesWrite(async () => {
  const db = await loadEmotesDb();
  const row = db.emotes.find((e) => e.id === id);
  if (!row) throw new Error('Emote not found');
  if (!ALLOWED_MIME.has(mime)) throw new Error('Only PNG, JPEG, GIF, WebP or SVG allowed');
  if (!buffer?.length || buffer.length > MAX_BYTES) throw new Error('Image max 3 MB');

  let payload = buffer;
  if (mime === 'image/svg+xml') {
    payload = sanitizeSvgBuffer(buffer);
  } else {
    assertMimeMatchesBuffer(mime, buffer);
  }

  const ext = EXT_BY_MIME[mime] ?? 'png';
  const filename = `${row.id}.${ext}`;
  await writeEmoteFile(filename, payload);
  if (row.filename && row.filename !== filename) await removeEmoteFile(row.filename);

  row.filename = filename;
  row.mime = mime;
  row.url = `/api/chat/emotes/files/${filename}`;
  row.isPlaceholder = false;
  row.updatedAt = Date.now();
  await saveEmotesDb(db);
  return row;
  });
}

export async function deleteEmote(id) {
  return withEmotesWrite(async () => {
  const db = await loadEmotesDb();
  const row = db.emotes.find((e) => e.id === id);
  if (!row) throw new Error('Emote not found');
  await removeEmoteFile(row.filename);
  db.emotes = db.emotes.filter((e) => e.id !== id);
  await saveEmotesDb(db);
  return { ok: true };
  });
}