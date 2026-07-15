/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractPublicGameStats } from '../gameStatsConfig.mjs';
import { normalizeProfileCustomization } from '../profileCustomization.mjs';
import { normalizeActivity } from '../auth/achievements.mjs';

const INDEXED_KEYS = new Set([
  'id', 'username', 'email', 'role', 'passwordHash', 'active',
]);

export function userToStorageRow(user) {
  const payload = {};
  for (const [key, value] of Object.entries(user)) {
    if (!INDEXED_KEYS.has(key)) payload[key] = value;
  }
  return {
    id: String(user.id),
    username: String(user.username),
    email: String(user.email),
    role: String(user.role),
    password_hash: String(user.passwordHash ?? ''),
    active: user.active === false ? 0 : 1,
    payload: JSON.stringify(payload),
  };
}

export function storageRowToUser(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload || '{}');
  } catch {
    payload = {};
  }
  const u = {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
    active: Boolean(row.active),
    ...payload,
  };
  return normalizeUserRecord(u);
}

export function normalizeUserRecord(u) {
  return {
    ...u,
    verified: Boolean(u.verified),
    profileViews: Number(u.profileViews) || 0,
    website: String(u.website ?? ''),
    socialLinks: Array.isArray(u.socialLinks) ? u.socialLinks : [],
    achievements: Array.isArray(u.achievements) ? u.achievements : [],
    coinLedger: Array.isArray(u.coinLedger)
      ? u.coinLedger
        .filter((e) => e && typeof e === 'object')
        .map((e) => ({
          id: String(e.id ?? ''),
          kind: String(e.kind ?? 'credit').slice(0, 24),
          amount: Math.max(0, Number(e.amount) || 0),
          label: String(e.label ?? '').slice(0, 140),
          icon: String(e.icon ?? '🪙').slice(0, 8),
          at: Number(e.at) || 0,
          meta: e.meta && typeof e.meta === 'object' ? e.meta : undefined,
        }))
        .filter((e) => e.id && e.amount > 0)
      : [],
    referralCode: String(u.referralCode ?? ''),
    referredBy: u.referredBy ?? null,
    referralsCount: Math.max(0, Number(u.referralsCount) || 0),
    imagesUploaded: Math.max(0, Number(u.imagesUploaded) || 0),
    memesCreated: Math.max(0, Number(u.memesCreated) || 0),
    pastesCreated: Math.max(0, Number(u.pastesCreated) || 0),
    pasteViewsTotal: Math.max(0, Number(u.pasteViewsTotal) || 0),
    lulCoins: u.lulCoins != null ? Math.max(0, Number(u.lulCoins) || 0) : 1000,
    ...extractPublicGameStats(u),
    gameJackpotsWon: Math.max(0, Number(u.gameJackpotsWon) || 0),
    gameTotalWon: Math.max(0, Number(u.gameTotalWon) || 0),
    gameTotalLost: Math.max(0, Number(u.gameTotalLost) || 0),
    gameRpsMoves: {
      rock: Math.max(0, Number(u.gameRpsMoves?.rock) || 0),
      paper: Math.max(0, Number(u.gameRpsMoves?.paper) || 0),
      scissors: Math.max(0, Number(u.gameRpsMoves?.scissors) || 0),
    },
    gameLastDailyBonus: u.gameLastDailyBonus ? Number(u.gameLastDailyBonus) : null,
    chatBanned: Boolean(u.chatBanned),
    chatMutedUntil: u.chatMutedUntil ? Number(u.chatMutedUntil) : null,
    abuseWarnings: Math.max(0, Number(u.abuseWarnings) || 0),
    onlineMinutes: Math.max(0, Number(u.onlineMinutes) || 0),
    lastSeenAt: u.lastSeenAt ? Number(u.lastSeenAt) : null,
    profileCustomization: normalizeProfileCustomization(u.profileCustomization),
    activity: normalizeActivity(u.activity),
  };
}

const SESSION_INDEXED = new Set(['token', 'userId', 'remember', 'expiresAt', 'createdAt']);

export function sessionToStorageRow(session) {
  const payload = {};
  for (const [key, value] of Object.entries(session)) {
    if (!SESSION_INDEXED.has(key)) payload[key] = value;
  }
  return {
    token: String(session.token),
    user_id: String(session.userId),
    remember: session.remember ? 1 : 0,
    expires_at: Number(session.expiresAt) || 0,
    created_at: Number(session.createdAt) || Date.now(),
    payload: JSON.stringify(payload),
  };
}

export function storageRowToSession(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload || '{}');
  } catch {
    payload = {};
  }
  return {
    token: row.token,
    userId: row.user_id,
    remember: Boolean(row.remember),
    expiresAt: Number(row.expires_at) || 0,
    createdAt: Number(row.created_at) || 0,
    ...payload,
  };
}