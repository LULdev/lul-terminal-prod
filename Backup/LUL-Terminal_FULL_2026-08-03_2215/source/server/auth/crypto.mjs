/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;
/** Cap before scrypt — prevents CPU DoS from multi-MB password bodies. */
export const MAX_PASSWORD_LENGTH = 128;

function normalizePasswordInput(password) {
  const s = String(password ?? '');
  if (s.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password too long (max ${MAX_PASSWORD_LENGTH} characters)`);
  }
  return s;
}

export async function hashPassword(password) {
  const plain = normalizePasswordInput(password);
  const salt = crypto.randomBytes(SALT_LEN);
  const derived = await scrypt(plain, salt, KEY_LEN);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored?.startsWith('scrypt:')) return false;
  const plain = String(password ?? '');
  // Reject huge inputs without scrypt cost
  if (plain.length > MAX_PASSWORD_LENGTH) return false;
  const [, saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const derived = await scrypt(plain, salt, KEY_LEN);
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}