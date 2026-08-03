/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { hashPassword } from './crypto.mjs';
import { sanitizeAvatarUrl, sanitizeCoverUrl } from './safeMediaUrl.mjs';
import { countActiveAdmins, ROLES, publicUser } from './permissions.mjs';
import {
  loadUsersDb,
  saveUsersDb,
  withUsersWrite,
  withSessionsWrite,
  loadSessionsDb,
  saveSessionsDb,
  newUserId,
} from './authStore.mjs';
import { ensureUniqueReferralCode } from './referral.mjs';

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export async function listUsers({ search, role, active } = {}) {
  const db = await loadUsersDb();
  let list = db.users.map(publicUser);
  const q = search?.trim().toLowerCase();

  if (q) {
    list = list.filter(
      (u) =>
        u.username.includes(q) ||
        u.email.includes(q) ||
        (u.displayName ?? '').toLowerCase().includes(q),
    );
  }
  if (role && ROLES.includes(role)) list = list.filter((u) => u.role === role);
  if (active === 'true') list = list.filter((u) => u.active !== false);
  if (active === 'false') list = list.filter((u) => u.active === false);

  list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { users: list, total: list.length };
}

export async function createUserAdmin(payload) {
  const email = normalizeEmail(payload.email);
  const username = normalizeUsername(payload.username || email.split('@')[0]);
  const password = String(payload.password ?? '');
  const role = ROLES.includes(payload.role) ? payload.role : 'user';

  if (!email.includes('@') || password.length < 6) throw new Error('Email and password (min. 6) required');

  return withUsersWrite(async () => {
  const db = await loadUsersDb();
  if (db.users.some((u) => u.email === email)) throw new Error('Email taken');
  if (db.users.some((u) => String(u.username).toLowerCase() === username)) throw new Error('Username taken');

  const now = Date.now();
  const user = {
    id: newUserId(),
    username,
    email,
    passwordHash: await hashPassword(password),
    role,
    active: payload.active !== false,
    displayName: String(payload.displayName ?? username).trim() || username,
    bio: String(payload.bio ?? '').trim(),
    avatarUrl: sanitizeAvatarUrl(payload.avatarUrl ?? `https://api.dicebear.com/7.x/notionists/svg?seed=${username}`),
    coverUrl: sanitizeCoverUrl(payload.coverUrl ?? 'linear-gradient(135deg,#0f172a,#1e293b,#020617)'),
    verified: Boolean(payload.verified),
    profileViews: 0,
    website: '',
    socialLinks: [],
    achievements: [],
    referralCode: '',
    referredBy: null,
    referralsCount: 0,
    imagesUploaded: 0,
    memesCreated: 0,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  db.users.push(user);
  ensureUniqueReferralCode(db, user);
  await saveUsersDb(db);
  return publicUser(user);
  });
}

export async function updateUserAdmin(id, payload) {
  const result = await withUsersWrite(async () => {
  const db = await loadUsersDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new Error('User not found');

  if (payload.username != null) {
    const username = normalizeUsername(payload.username);
    if (!username) throw new Error('Invalid username');
    if (db.users.some((u) => u.id !== id && String(u.username).toLowerCase() === username)) throw new Error('Username taken');
    user.username = username;
  }
  if (payload.email != null) {
    const email = normalizeEmail(payload.email);
    if (!email.includes('@')) throw new Error('Invalid email');
    if (db.users.some((u) => u.id !== id && u.email === email)) throw new Error('Email taken');
    user.email = email;
  }
  if (payload.role != null && ROLES.includes(payload.role)) {
    const demotingLastAdmin = user.role === 'admin' && payload.role !== 'admin'
      && countActiveAdmins(db.users) <= 1;
    if (demotingLastAdmin) throw new Error('Last admin cannot be demoted');
    const roleChanged = user.role !== payload.role;
    if (roleChanged && payload.role === 'bot') {
      const { leaveAllGameQueues } = await import('../gamesService.mjs');
      const cleanup = await leaveAllGameQueues(id);
      if (!cleanup.ok) {
        console.warn('[auth] bot role arcade cleanup incomplete', { userId: id, errors: cleanup.errors });
        throw new Error(`Cannot assign bot role: arcade cleanup failed (${cleanup.errors.map((e) => e.gameId).join(', ')})`);
      }
      const { revokeUserSessions } = await import('./authService.mjs');
      await revokeUserSessions(id);
    }
    user.role = payload.role;
  }
  if (payload.active != null) {
    const deactivatingLastAdmin = user.role === 'admin' && payload.active === false
      && countActiveAdmins(db.users) <= 1;
    if (deactivatingLastAdmin) throw new Error('Last admin cannot be deactivated');
    const wasActive = user.active !== false;
    const nextActive = Boolean(payload.active);
    if (wasActive && nextActive === false) {
      const { leaveAllGameQueues } = await import('../gamesService.mjs');
      const cleanup = await leaveAllGameQueues(id);
      if (!cleanup.ok) {
        console.warn('[auth] deactivate arcade cleanup incomplete', { userId: id, errors: cleanup.errors });
        throw new Error(`Cannot deactivate user: arcade cleanup failed (${cleanup.errors.map((e) => e.gameId).join(', ')})`);
      }
      const { refundOrphanEscrowsAfterCleanup } = await import('./authService.mjs');
      await refundOrphanEscrowsAfterCleanup(id, cleanup);
    }
    user.active = nextActive;
    if (wasActive && nextActive === false) {
      user.registrationBlocked = true;
      const { blockRegistrationSignalsForUser } = await import('./registrationRegistry.mjs');
      await blockRegistrationSignalsForUser(user);
      const { revokeUserSessions } = await import('./authService.mjs');
      await revokeUserSessions(id);
    }
    if (wasActive === false && nextActive === true) {
      user.registrationBlocked = false;
      const { unblockRegistrationSignalsForUser } = await import('./registrationRegistry.mjs');
      await unblockRegistrationSignalsForUser(user);
    }
  }
  if (payload.displayName != null) user.displayName = String(payload.displayName).trim().slice(0, 64);
  if (payload.bio != null) user.bio = String(payload.bio).trim().slice(0, 280);
  if (payload.avatarUrl != null) user.avatarUrl = sanitizeAvatarUrl(payload.avatarUrl);
  if (payload.coverUrl != null) user.coverUrl = sanitizeCoverUrl(payload.coverUrl);
  if (payload.verified != null) user.verified = Boolean(payload.verified);
  let passwordChanged = false;
  if (payload.password) {
    const pw = String(payload.password);
    if (pw.length < 6) throw new Error('Password min. 6 characters');
    user.passwordHash = await hashPassword(pw);
    passwordChanged = true;
  }

  user.updatedAt = Date.now();
  await saveUsersDb(db);
  return { user: publicUser(user), passwordChanged };
  });
  if (result.passwordChanged) {
    const { revokeUserSessions } = await import('./authService.mjs');
    await revokeUserSessions(id);
  }
  return result.user;
}

export async function deleteUserAdmin(id, actorId) {
  await withUsersWrite(async () => {
  const db = await loadUsersDb();
  const target = db.users.find((u) => u.id === id);
  if (!target) throw new Error('User not found');
  if (actorId && id === actorId) {
    throw new Error('Delete your own account via profile, not in the admin dashboard');
  }
  if (target.role === 'admin' && countActiveAdmins(db.users) <= 1) {
    throw new Error('Last admin cannot be deleted');
  }
  const { leaveAllGameQueues } = await import('../gamesService.mjs');
  const cleanup = await leaveAllGameQueues(id);
  if (!cleanup.ok) {
    console.warn('[auth] admin delete arcade cleanup incomplete', { userId: id, errors: cleanup.errors });
    throw new Error(`Cannot delete user: arcade cleanup failed (${cleanup.errors.map((e) => e.gameId).join(', ')})`);
  }
  const { refundOrphanEscrowsAfterCleanup } = await import('./authService.mjs');
  await refundOrphanEscrowsAfterCleanup(id, cleanup);
  const { refundUserEscrows } = await import('../gamesEscrow.mjs');
  await refundUserEscrows(id).catch((e) => {
    console.warn('[auth] final escrow refund before admin delete failed', id, e);
  });
  target.registrationBlocked = true;
  const { blockRegistrationSignalsForUser } = await import('./registrationRegistry.mjs');
  await blockRegistrationSignalsForUser(target);
  db.users = db.users.filter((u) => u.id !== id);
  await saveUsersDb(db);
  });

  await withSessionsWrite(async () => {
    const sessionsDb = await loadSessionsDb();
    sessionsDb.sessions = sessionsDb.sessions.filter((s) => s.userId !== id);
    await saveSessionsDb(sessionsDb);
  });
}