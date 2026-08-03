/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

let cachedVaultKey = null;

function vaultKey() {
  if (cachedVaultKey) return cachedVaultKey;
  const secret = process.env.PREMIUM_VAULT_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PREMIUM_VAULT_KEY must be set in production');
    }
    cachedVaultKey = crypto.scryptSync('lul-terminal-dev-vault-key-change-me', 'lul-premium-vault', 32);
    return cachedVaultKey;
  }
  cachedVaultKey = crypto.scryptSync(secret, 'lul-premium-vault', 32);
  return cachedVaultKey;
}

/**
 * Encrypt vault plaintext. Always produces a new ciphertext.
 * Never treat client-supplied `enc:v1:…` as already sealed (would poison hydrate).
 * Use `reSealIfNeeded` only for internal already-sealed storage rows.
 */
export function encryptPassword(plain) {
  const text = String(plain ?? '');
  if (!text) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`;
}

/** Skip encrypt only when value is already a valid sealed payload (internal re-seal). */
export function reSealIfNeeded(value) {
  const s = String(value ?? '');
  if (!s) return s;
  if (s.startsWith(PREFIX) && isValidSealedPayload(s)) return s;
  return encryptPassword(s);
}

function isValidSealedPayload(s) {
  if (!s.startsWith(PREFIX)) return false;
  const parts = s.slice(PREFIX.length).split(':');
  if (parts.length !== 3) return false;
  try {
    Buffer.from(parts[0], 'base64url');
    Buffer.from(parts[1], 'base64url');
    Buffer.from(parts[2], 'base64url');
    return parts[0].length > 0 && parts[1].length > 0 && parts[2].length > 0;
  } catch {
    return false;
  }
}

export function decryptPassword(stored) {
  const s = String(stored ?? '');
  if (!s.startsWith(PREFIX)) return s;
  const parts = s.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted password payload');
  const [ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = crypto.createDecipheriv(ALGO, vaultKey(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Failed to decrypt password');
  }
}