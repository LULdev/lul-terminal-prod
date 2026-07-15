/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Production bootstrap for the auth database.
 * On first start (empty DB): creates Administrator + system bot only.
 * No demo / VIP test / fake users.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { hashPassword } from '../auth/crypto.mjs';
import { AUTH_DB_DIR } from './authDatabase.mjs';

/** Written once on first bootstrap. Gitignored. Do not commit. */
export const ADMIN_CREDENTIALS_FILE = path.join(AUTH_DB_DIR, 'admin-credentials.json');

export const ADMIN_USERNAME = 'Administrator';
export const BOT_USERNAME = 'bot';

const MIN_PASSWORD_LEN = 12;

/**
 * Prefer SEED_ADMIN_PASSWORD from env; otherwise generate a strong random password.
 */
export function resolveAdminPassword() {
  const fromEnv = String(process.env.SEED_ADMIN_PASSWORD ?? '').trim();
  if (fromEnv.length >= MIN_PASSWORD_LEN) {
    return { password: fromEnv, source: 'env' };
  }
  if (fromEnv.length > 0 && fromEnv.length < MIN_PASSWORD_LEN) {
    console.warn(
      `[bootstrap] SEED_ADMIN_PASSWORD is shorter than ${MIN_PASSWORD_LEN} chars — generating a secure password instead.`,
    );
  }
  // 24 chars base64url ≈ 144 bits entropy
  const password = crypto.randomBytes(18).toString('base64url');
  return { password, source: 'generated' };
}

function newUserId() {
  return crypto.randomBytes(8).toString('hex');
}

function baseUser(overrides) {
  const now = Date.now();
  return {
    id: newUserId(),
    role: 'user',
    active: true,
    verified: false,
    profileViews: 0,
    website: '',
    socialLinks: [],
    achievements: [],
    referralCode: '',
    referredBy: null,
    referralsCount: 0,
    imagesUploaded: 0,
    memesCreated: 0,
    pastesCreated: 0,
    pasteViewsTotal: 0,
    lulCoins: 1000,
    chatBanned: false,
    chatMutedUntil: null,
    abuseWarnings: 0,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    ...overrides,
  };
}

/**
 * Build production initial users: admin + bot only.
 * @returns {{ users: object[], credentials: object }}
 */
export async function buildBootstrapUsers() {
  const now = Date.now();
  const { password: adminPassword, source: passwordSource } = resolveAdminPassword();
  const adminHash = await hashPassword(adminPassword);
  // Bot cannot log in with a known password
  const botHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

  const adminEmail =
    String(process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase() ||
    'administrator@lul.terminal';

  const users = [
    baseUser({
      username: ADMIN_USERNAME,
      email: adminEmail,
      passwordHash: adminHash,
      role: 'admin',
      displayName: 'Administrator',
      bio: 'System administrator account.',
      avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=Administrator',
      coverUrl: 'linear-gradient(135deg,#1e1b4b,#312e81,#0f172a)',
      verified: true,
      lulCoins: 5000,
    }),
    baseUser({
      username: BOT_USERNAME,
      email: 'bot@lul.terminal',
      passwordHash: botHash,
      role: 'bot',
      displayName: 'BOT',
      bio: 'Automated system announcements.',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=bot',
      coverUrl: 'linear-gradient(135deg,#0c4a6e,#0369a1,#0f172a)',
      verified: true,
      achievements: [{ id: 'bot_supreme_nerd', earnedAt: now }],
    }),
  ];

  const credentials = {
    generatedAt: new Date().toISOString(),
    passwordSource,
    notice:
      'Store these credentials securely. Change the admin password after first login. This file is gitignored.',
    admin: {
      login: ADMIN_USERNAME,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    },
  };

  return { users, credentials };
}

/** @deprecated Use buildBootstrapUsers — kept for any external import name. */
export async function buildDefaultAuthUsers() {
  return buildBootstrapUsers();
}

/**
 * Persist bootstrap credentials outside the database (plain text, host-local only).
 */
export async function writeAdminCredentials(credentials) {
  await fs.mkdir(AUTH_DB_DIR, { recursive: true });
  const payload = `${JSON.stringify(credentials, null, 2)}\n`;
  await fs.writeFile(ADMIN_CREDENTIALS_FILE, payload, { encoding: 'utf8', mode: 0o600 });
  return ADMIN_CREDENTIALS_FILE;
}

/** @deprecated */
export async function writeDemoCredentials(credentials) {
  return writeAdminCredentials(credentials);
}
