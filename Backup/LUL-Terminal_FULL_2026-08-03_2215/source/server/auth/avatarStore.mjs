/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertMimeMatchesBuffer } from '../imageMime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.join(__dirname, '..', '..', 'data', 'avatars');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;

const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function saveUserAvatar(userId, { mime, buffer }) {
  if (!ALLOWED.has(mime)) throw new Error('Only JPEG, PNG, GIF or WebP');
  if (!buffer?.length || buffer.length > MAX_BYTES) throw new Error('Avatar max. 2 MB');
  assertMimeMatchesBuffer(mime, buffer);

  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const ext = EXT[mime] ?? 'png';
  const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
  const fileTmp = `${filePath}.tmp`;
  await fs.writeFile(fileTmp, buffer);
  await fs.rename(fileTmp, filePath);

  for (const other of Object.values(EXT)) {
    if (other === ext) continue;
    try { await fs.unlink(path.join(AVATAR_DIR, `${userId}.${other}`)); } catch { /* ignore */ }
  }

  return `/api/auth/avatars/${userId}.${ext}`;
}

export async function getAvatarFile(filename) {
  const safe = path.basename(filename);
  if (!/^[a-f0-9]+\.(jpg|png|gif|webp)$/.test(safe)) return null;
  const filePath = path.join(AVATAR_DIR, safe);
  try {
    const buf = await fs.readFile(filePath);
    const mime = safe.endsWith('.jpg') ? 'image/jpeg'
      : safe.endsWith('.png') ? 'image/png'
        : safe.endsWith('.gif') ? 'image/gif' : 'image/webp';
    return { buf, mime };
  } catch {
    return null;
  }
}