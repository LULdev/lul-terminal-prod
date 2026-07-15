/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const derived = await scrypt(String(password), salt, KEY_LEN);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored?.startsWith('scrypt:')) return false;
  const [, saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const derived = await scrypt(String(password), salt, KEY_LEN);
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}