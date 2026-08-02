/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { hashPassword } from './crypto.mjs';
import {
  AUTH_DB_DIR,
  clearAuthDatabase,
  getAuthDatabase,
  readSessionsDbShape,
  readUsersDbShape,
  writeSessionsDbShape,
  writeUsersDbShape,
} from '../db/authDatabase.mjs';
import {
  BOT_USERNAME,
  buildBootstrapUsers,
  writeAdminCredentials,
} from '../db/seedAuthUsers.mjs';

export { BOT_USERNAME };

export function newUserId() {
  return crypto.randomBytes(8).toString('hex');
}

export async function ensureAuthStore() {
  getAuthDatabase();
}

export async function loadUsersDb() {
  try {
    const store = usersWriteAls.getStore();
    if (store?.db) return store.db;
    const db = readUsersDbShape();
    if (store) store.db = db;
    return db;
  } catch (err) {
    console.error('[auth] CRITICAL: SQLite user store unreadable', err);
    throw new Error('User database unavailable');
  }
}

export async function saveUsersDb(db) {
  writeUsersDbShape(db);
  const store = usersWriteAls.getStore();
  if (store) store.db = db;
}

let usersWriteChain = Promise.resolve();
/**
 * Re-entrant withUsersWrite context.
 * Holds a single shared users DB snapshot so nested settle/expire/join
 * cannot load a second copy and clobber earlier credits on save.
 */
const usersWriteAls = new AsyncLocalStorage();

/**
 * Serialize user DB read-modify-write to prevent registration/account races.
 * Re-entrant: nested calls (e.g. settleMatch inside submitMove) run inline
 * instead of deadlocking the promise chain.
 */
export function withUsersWrite(task) {
  if (usersWriteAls.getStore()) {
    return Promise.resolve().then(() => task());
  }
  const ctx = { db: null };
  const run = usersWriteChain.then(() => usersWriteAls.run(ctx, () => task()));
  usersWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

let sessionsWriteChain = Promise.resolve();
const sessionsWriteAls = new AsyncLocalStorage();

export async function loadSessionsDb() {
  try {
    const store = sessionsWriteAls.getStore();
    if (store?.db) return store.db;
    const db = readSessionsDbShape();
    if (store) store.db = db;
    return db;
  } catch (err) {
    console.error('[auth] CRITICAL: SQLite session store unreadable', err);
    throw new Error('Session database unavailable');
  }
}


/** Serialize session DB read-modify-write to prevent login/logout races. Re-entrant. */
export function withSessionsWrite(task) {
  if (sessionsWriteAls.getStore()) {
    return Promise.resolve().then(() => task());
  }
  const ctx = { db: null };
  const run = sessionsWriteChain.then(() => sessionsWriteAls.run(ctx, () => task()));
  sessionsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function saveSessionsDb(db) {
  writeSessionsDbShape(db);
  const store = sessionsWriteAls.getStore();
  if (store) store.db = db;
}

async function ensureBotUserInDb(db) {
  const existing = db.users.find((u) => u.username.toLowerCase() === BOT_USERNAME);
  if (existing) {
    let changed = false;
    if (existing.role !== 'bot') {
      existing.role = 'bot';
      existing.displayName = 'BOT';
      changed = true;
    }
    if (!Array.isArray(existing.achievements)) existing.achievements = [];
    if (!existing.achievements.some((a) => a.id === 'bot_supreme_nerd')) {
      existing.achievements.push({ id: 'bot_supreme_nerd', earnedAt: Date.now() });
      changed = true;
    }
    if (changed) {
      existing.updatedAt = Date.now();
      await saveUsersDb(db);
    }
    return existing;
  }

  const now = Date.now();
  const botHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
  const bot = {
    id: newUserId(),
    username: BOT_USERNAME,
    email: 'bot@lul.terminal',
    passwordHash: botHash,
    role: 'bot',
    active: true,
    displayName: 'BOT',
    bio: 'Automated system announcements.',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=bot',
    coverUrl: 'linear-gradient(135deg,#0c4a6e,#0369a1,#0f172a)',
    verified: true,
    profileViews: 0,
    website: '',
    socialLinks: [],
    achievements: [{ id: 'bot_supreme_nerd', earnedAt: now }],
    referralCode: '',
    referredBy: null,
    referralsCount: 0,
    imagesUploaded: 0,
    memesCreated: 0,
    pastesCreated: 0,
    pasteViewsTotal: 0,
    chatBanned: false,
    chatMutedUntil: null,
    abuseWarnings: 0,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  db.users.push(bot);
  await saveUsersDb(db);
  return bot;
}

export async function ensureBotUser() {
  return withUsersWrite(async () => {
    const db = await loadUsersDb();
    return ensureBotUserInDb(db);
  });
}

/**
 * Wipe auth DB and re-run production bootstrap (admin + bot only).
 * Credentials are written to data/auth/admin-credentials.json.
 */
export async function resetAuthDatabase() {
  return withUsersWrite(async () => {
    clearAuthDatabase();
    const { users, credentials } = await buildBootstrapUsers();
    const db = { version: 2, updatedAt: null, users };
    await saveUsersDb(db);
    const credPath = await writeAdminCredentials(credentials);
    console.warn(`[bootstrap] Auth database reset. Admin credentials: ${credPath}`);
    console.warn(`[bootstrap] Login: ${credentials.admin.login}  (password in credentials file)`);
    return db;
  });
}

/**
 * Auto-initialize auth on first start when the user table is empty.
 * Creates Administrator + system bot only — no demo or placeholder users.
 * Called automatically from initAuth() on every server start.
 */
export async function seedDefaultUsersIfEmpty() {
  return withUsersWrite(async () => {
    const db = await loadUsersDb();
    if (db.users.length > 0) {
      await ensureBotUserInDb(db);
      return db;
    }

    const { users, credentials } = await buildBootstrapUsers();
    db.users = users;
    await saveUsersDb(db);
    const credPath = await writeAdminCredentials(credentials);
    console.warn('[bootstrap] First-run auth initialization complete.');
    console.warn(`[bootstrap] Admin account: ${credentials.admin.login}`);
    console.warn(`[bootstrap] Admin email:   ${credentials.admin.email}`);
    console.warn(`[bootstrap] Password source: ${credentials.passwordSource}`);
    console.warn(`[bootstrap] Credentials file (store securely, never commit): ${credPath}`);
    if (credentials.passwordSource === 'generated') {
      console.warn('[bootstrap] Set SEED_ADMIN_PASSWORD in .env before first start to choose your own password.');
    }
    return db;
  });
}

export { AUTH_DB_DIR };