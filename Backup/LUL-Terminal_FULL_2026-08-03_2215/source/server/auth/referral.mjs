/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { resolvePublicOrigin } from '../resolvePublicOrigin.mjs';

export function generateReferralCode() {
  return `LUL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function normalizeReferralCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

export function ensureUniqueReferralCode(db, user) {
  if (user.referralCode) return user.referralCode;
  let code = generateReferralCode();
  let attempts = 0;
  while (db.users.some((u) => u.id !== user.id && u.referralCode === code) && attempts < 24) {
    code = generateReferralCode();
    attempts += 1;
  }
  user.referralCode = code;
  return code;
}

export function findReferrer(db, code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized || !normalized.startsWith('LUL-')) return null;
  return db.users.find((u) => u.active !== false && u.referralCode?.toUpperCase() === normalized) ?? null;
}

export function buildInviteUrl(req, code) {
  return `${resolvePublicOrigin(req)}/?ref=${encodeURIComponent(code)}`;
}