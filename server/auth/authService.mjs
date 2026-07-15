/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { hashPassword, verifyPassword, newSessionToken } from './crypto.mjs';
import { zeroGameStats } from '../gameStatsConfig.mjs';
import { ALL_MANAGEABLE_TAB_IDS } from '../accessControlStore.mjs';
import { countAccountsByCreator } from '../premiumAccountsService.mjs';
import { getAcceptedNotWorkingForCreator } from '../premiumAccountsReports.mjs';
import { saveUserAvatar } from './avatarStore.mjs';
import { buildUnlockPayload } from '../achievementCoinRewards.mjs';
import {
  ACHIEVEMENT_PROOF_INELIGIBLE_TABS,
  clearAchievementProofFlags,
  consumeAchievementProof,
  mintAchievementProof,
  TERMINAL_PROOF_ELIGIBLE_TABS,
} from './achievementProof.mjs';
import { applyActivityCtx, ensureActivity, grantFirstLogin, normalizeSocialLinks, syncAchievements } from './achievements.mjs';
import { sanitizeAvatarUrl, sanitizeCoverUrl, sanitizeExternalUrl } from './safeMediaUrl.mjs';
import { canAccessAdmin, countActiveAdmins, enrichUserForClient, isEffectivelyActive, publicProfileView } from './permissions.mjs';
import {
  loadUsersDb,
  saveUsersDb,
  withUsersWrite,
  withSessionsWrite,
  loadSessionsDb,
  saveSessionsDb,
  newUserId,
  seedDefaultUsersIfEmpty,
} from './authStore.mjs';
import { SESSION_REMEMBER_SEC, SESSION_SHORT_SEC } from './cookies.mjs';
import {
  buildInviteUrl,
  ensureUniqueReferralCode,
  findReferrer,
  normalizeReferralCode,
} from './referral.mjs';
import { postBotReferralJoined, postBotWelcomeMember, notifyBotAchievements } from '../chatBot.mjs';
import { runCoinTransaction } from '../gamesCoinLock.mjs';
import { checkRateLimit, isRateLimitError } from '../rateLimit.mjs';
import { refundUserEscrows } from '../gamesEscrow.mjs';
import { buildProfileStats } from '../profileStats.mjs';

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function findUserByUsername(users, rawUsername) {
  const needle = String(rawUsername ?? '').trim().toLowerCase();
  if (!needle) return null;
  return users.find((u) => String(u.username).toLowerCase() === needle) ?? null;
}

async function profileExtrasForUser(user) {
  const accountsSubmitted = await countAccountsByCreator(user.id);
  const reportedNotWorkingAccounts = await getAcceptedNotWorkingForCreator(user.id);
  const profileStats = await buildProfileStats(user);
  return { accountsSubmitted, reportedNotWorkingAccounts, profileStats };
}

export async function initAuth() {
  await seedDefaultUsersIfEmpty();
  const db = await loadUsersDb();
  const { rebuildRegistryFromUsers } = await import('./registrationRegistry.mjs');
  await rebuildRegistryFromUsers(db.users);
}

export async function resolveSession(token) {
  if (!token) return null;
  const [usersDb, sessionsDb] = await Promise.all([loadUsersDb(), loadSessionsDb()]);
  const session = sessionsDb.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  const user = usersDb.users.find((u) => u.id === session.userId);
  if (!isEffectivelyActive(user)) return null;
  return { user, session };
}

export async function registerUser(payload, req) {
  const email = normalizeEmail(payload.email);
  const username = normalizeUsername(payload.username || email.split('@')[0]);
  const password = String(payload.password ?? '');
  const displayName = String(payload.displayName ?? username).trim() || username;

  if (!email.includes('@') || password.length < 6) {
    throw new Error('Valid email and password (min. 6 characters) required');
  }
  if (!username) throw new Error('Invalid username');
  if (username === 'bot') throw new Error('This username is reserved');

  const { extractRegistrationSignals, assertRegistrationAllowed } = await import('./registrationGuard.mjs');
  const { recordRegistrationSignals } = await import('./registrationRegistry.mjs');
  const { canonicalEmail: canonEmail } = await import('./emailCanonical.mjs');
  const registrationSignals = extractRegistrationSignals({ ...payload, email }, req);

  return withUsersWrite(async () => {
  const db = await loadUsersDb();
  await assertRegistrationAllowed({ ...payload, email }, registrationSignals, db, req);

  if (db.users.some((u) => u.email === email) || findUserByUsername(db.users, username)) {
    throw new Error('Unable to create account — try a different email or username');
  }

  const now = Date.now();
  let referredBy = null;
  const refCode = normalizeReferralCode(payload.referralCode);
  if (refCode) {
    const referrer = findReferrer(db, refCode);
    if (referrer && referrer.email !== email) {
      referredBy = referrer.id;
      referrer.referralsCount = (Number(referrer.referralsCount) || 0) + 1;
      referrer.updatedAt = now;
    }
  }

  const user = {
    id: newUserId(),
    username,
    email,
    passwordHash: await hashPassword(password),
    role: 'user',
    active: true,
    displayName,
    bio: '',
    avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(username)}`,
    coverUrl: 'linear-gradient(135deg,#0f172a,#1e293b,#020617)',
    verified: false,
    profileViews: 0,
    website: '',
    socialLinks: [],
    achievements: [],
    referralCode: '',
    referredBy,
    referralsCount: 0,
    imagesUploaded: 0,
    memesCreated: 0,
    pastesCreated: 0,
    pasteViewsTotal: 0,
    lulCoins: 1000,
    ...zeroGameStats(),
    gameJackpotsWon: 0,
    gameTotalWon: 0,
    gameTotalLost: 0,
    gameRpsMoves: { rock: 0, paper: 0, scissors: 0 },
    gameLastDailyBonus: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    registrationSignals,
    registrationBlocked: false,
  };

  const lockToken = registrationSignals.compositeHash
    || registrationSignals.installId
    || registrationSignals.fingerprint;
  if (lockToken) {
    registrationSignals.regLockToken = lockToken;
    registrationSignals.regHintToken = lockToken;
  }
  if (email) registrationSignals.canonicalEmail = canonEmail(email);

  try {
    await recordRegistrationSignals(user.id, registrationSignals);
    db.users.push(user);
    ensureUniqueReferralCode(db, user);
    await saveUsersDb(db);
  } catch (err) {
    const { removeRegistrationSignals } = await import('./registrationRegistry.mjs');
    await removeRegistrationSignals(user.id, registrationSignals).catch(() => {});
    throw err;
  }
  postBotWelcomeMember(user.username).catch(() => {});
  if (referredBy) {
    const referrer = db.users.find((u) => u.id === referredBy);
    if (referrer?.username) {
      postBotReferralJoined({
        newUsername: user.username,
        referrerUsername: referrer.username,
      }).catch(() => {});
    }
  }
  const reportedNotWorkingAccounts = await getAcceptedNotWorkingForCreator(user.id);
  const profileStats = await buildProfileStats(user);
  return {
    user: enrichUserForClient(user, 0, reportedNotWorkingAccounts, profileStats),
    registrationLockToken: lockToken ?? null,
  };
  });
}

function resolveLoginUser(db, identifier) {
  const raw = String(identifier ?? '').trim();
  if (!raw) return null;
  if (raw.includes('@')) {
    const normalized = normalizeEmail(raw);
    return db.users.find((u) => u.email === normalized) ?? null;
  }
  return findUserByUsername(db.users, raw);
}

export async function loginUser({ email, password, remember }) {
  const db = await loadUsersDb();
  const user = resolveLoginUser(db, email);
  if (!isEffectivelyActive(user) || user.role === 'bot') throw new Error('Invalid login credentials');
  if (!(await verifyPassword(password, user.passwordHash))) throw new Error('Invalid login credentials');

  const token = newSessionToken();
  const maxAgeSec = remember ? SESSION_REMEMBER_SEC : SESSION_SHORT_SEC;

  const loginResult = await runCoinTransaction(async () => {
    const freshDb = await loadUsersDb();
    const freshUser = freshDb.users.find((u) => u.id === user.id);
    if (!freshUser) throw new Error('User not found');
    const isFirstLogin = freshUser.lastLoginAt == null;
    const newUnlocks = isFirstLogin ? grantFirstLogin(freshUser) : [];

    freshUser.lastLoginAt = Date.now();
    freshUser.updatedAt = Date.now();
    ensureUniqueReferralCode(freshDb, freshUser);

    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(freshUser);
    const loginHour = new Date().getHours();
    const more = syncAchievements(freshUser, {
      accountsSubmitted,
      incrementLogin: true,
      loginHour,
    });
    newUnlocks.push(...more);

    await saveUsersDb(freshDb);
    notifyBotAchievements(freshUser.username, newUnlocks).catch(() => {});

    return {
      user: enrichUserForClient(freshUser, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      newUnlocks,
      ...buildUnlockPayload(newUnlocks),
    };
  });

  await withSessionsWrite(async () => {
    const sessionsDb = await loadSessionsDb();
    const now = Date.now();
    const expired = sessionsDb.sessions.filter((s) => s.expiresAt <= now);
    if (expired.length) {
      const { leaveAllGameQueues } = await import('../gamesService.mjs');
      for (const s of expired) {
        const cleanup = await leaveAllGameQueues(s.userId).catch((e) => {
          console.warn('[auth] login expired-session arcade cleanup failed', s.userId, e);
          return { ok: false, errors: [] };
        });
        await refundOrphanEscrowsAfterCleanup(s.userId, cleanup);
      }
    }
    sessionsDb.sessions = sessionsDb.sessions.filter((s) => s.expiresAt > now);
    sessionsDb.sessions.push({
      token,
      userId: user.id,
      remember: Boolean(remember),
      expiresAt: Date.now() + maxAgeSec * 1000,
      createdAt: Date.now(),
      analyticsProofRemint: true,
    });
    sessionsDb.sessions = sessionsDb.sessions.filter(
      (s) => s.userId !== user.id || s.token === token,
    );
    await saveSessionsDb(sessionsDb);
  });

  const { touchUserLastSeen } = await import('../chatStats.mjs');
  await touchUserLastSeen(user.id, { force: true });

  return {
    user: loginResult.user,
    token,
    maxAgeSec,
    newUnlocks: loginResult.newUnlocks,
    unlockRewards: loginResult.unlockRewards,
    unlockCoinsTotal: loginResult.unlockCoinsTotal,
  };
}

function arcadeCleanupError(cleanup) {
  const games = cleanup.errors?.map((e) => e.gameId).join(', ') || 'unknown';
  return `Cannot sign out: arcade cleanup failed (${games})`;
}

/** Refund persisted escrows when arcade RAM is clear but rows remain (orphan sweep / cleanup ok). */
export async function refundOrphanEscrowsAfterCleanup(userId, cleanup) {
  if (!userId) return;
  const { userHasActiveArcadeSession } = await import('../gamesService.mjs');
  const stillActive = await userHasActiveArcadeSession(userId).catch(() => true);
  if (stillActive) {
    if (!cleanup?.ok) {
      console.warn('[auth] skipped escrow refund — arcade RAM state still active', {
        userId,
        errors: cleanup?.errors ?? [],
      });
    }
    return;
  }
  const db = await loadUsersDb();
  const user = db.users.find((u) => u.id === userId);
  const hasEscrows = (user?.gameEscrows?.length ?? 0) > 0;
  if (hasEscrows || !cleanup?.ok) {
    console.warn('[auth] refunding orphan escrows after arcade cleanup', {
      userId,
      hasEscrows,
      cleanupOk: cleanup?.ok ?? true,
    });
    await refundUserEscrows(userId).catch((e) => {
      console.warn('[auth] escrow refund after cleanup failed', userId, e);
    });
  }
}

/** Expired session still in DB — release arcade state so escrow is not held until queue sweep. */
export async function reconcileExpiredSession(token) {
  if (!token) return;
  const sessionsDb = await loadSessionsDb();
  const session = sessionsDb.sessions.find((s) => s.token === token);
  if (!session || session.expiresAt >= Date.now()) return;

  const { leaveAllGameQueues, userHasActiveArcadeSession } = await import('../gamesService.mjs');
  let cleanup = await leaveAllGameQueues(session.userId).catch((e) => {
    console.warn('[auth] expired session arcade cleanup failed', session.userId, e);
    return { ok: false, errors: [] };
  });
  if (cleanup && !cleanup.ok) {
    cleanup = await leaveAllGameQueues(session.userId).catch(() => cleanup);
  }
  await refundOrphanEscrowsAfterCleanup(session.userId, cleanup);
  await withSessionsWrite(async () => {
    const sessionsDb = await loadSessionsDb();
    sessionsDb.sessions = sessionsDb.sessions.filter((s) => s.token !== token);
    await saveSessionsDb(sessionsDb);
  });
}

export async function logoutUser(token) {
  if (!token) return;
  const sessionsDb = await loadSessionsDb();
  const session = sessionsDb.sessions.find((s) => s.token === token);
  const userId = session?.userId;

  if (userId) {
    const { leaveAllGameQueues } = await import('../gamesService.mjs');
    const cleanup = await leaveAllGameQueues(userId);
    await refundOrphanEscrowsAfterCleanup(userId, cleanup);
    await withUsersWrite(async () => {
      const db = await loadUsersDb();
      const user = db.users.find((u) => u.id === userId);
      if (user) {
        clearAchievementProofFlags(user);
        await saveUsersDb(db);
      }
    });
  }

  await withSessionsWrite(async () => {
    const fresh = await loadSessionsDb();
    fresh.sessions = fresh.sessions.filter((s) => s.token !== token);
    await saveSessionsDb(fresh);
  });
}

export async function revokeUserSessions(userId, { keepToken = null } = {}) {
  if (!userId) return;
  await withSessionsWrite(async () => {
    const sessionsDb = await loadSessionsDb();
    sessionsDb.sessions = sessionsDb.sessions.filter(
      (s) => s.userId !== userId || (keepToken && s.token === keepToken),
    );
    await saveSessionsDb(sessionsDb);
  });
}

export async function updateProfile(userId, payload, { keepToken = null } = {}) {
  let passwordChanged = false;
  const result = await runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    if (payload.displayName != null) user.displayName = String(payload.displayName).trim().slice(0, 64);
    if (payload.bio != null) user.bio = String(payload.bio).trim().slice(0, 160);
    if (payload.website != null) user.website = sanitizeExternalUrl(payload.website);
    if (payload.socialLinks != null) user.socialLinks = normalizeSocialLinks(payload.socialLinks);
    if (payload.avatarUrl != null) user.avatarUrl = sanitizeAvatarUrl(payload.avatarUrl);
    if (payload.coverUrl != null) user.coverUrl = sanitizeCoverUrl(payload.coverUrl);

    if (payload.profileCustomization != null) {
      const { mergeProfileCustomizationPatch } = await import('../profileCustomization.mjs');
      user.profileCustomization = mergeProfileCustomizationPatch(
        user.profileCustomization,
        payload.profileCustomization,
      );
    }

    if (payload.email != null) {
      const email = normalizeEmail(payload.email);
      if (!email.includes('@')) throw new Error('Invalid email');
      if (email !== normalizeEmail(user.email)) {
        const current = String(payload.currentPassword ?? '');
        if (!current || !(await verifyPassword(current, user.passwordHash))) {
          throw new Error('Current password required to change email');
        }
      }
      if (db.users.some((u) => u.id !== userId && u.email === email)) throw new Error('Email taken');
      user.email = email;
    }

    if (payload.password) {
      const current = String(payload.currentPassword ?? '');
      if (!current || !(await verifyPassword(current, user.passwordHash))) {
        throw new Error('Current password required to change password');
      }
      const pw = String(payload.password);
      if (pw.length < 6) throw new Error('Password min. 6 characters');
      user.passwordHash = await hashPassword(pw);
      passwordChanged = true;
    }

    user.updatedAt = Date.now();
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
    const newUnlocks = syncAchievements(user, { accountsSubmitted });
    await saveUsersDb(db);
    notifyBotAchievements(user.username, newUnlocks).catch(() => {});
    return {
      user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      ...buildUnlockPayload(newUnlocks),
    };
  });
  if (passwordChanged) {
    await revokeUserSessions(userId, { keepToken });
  }
  return result;
}

export async function uploadUserAvatar(userId, { mime, buffer }) {
  const avatarUrl = await saveUserAvatar(userId, { mime, buffer });
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    user.avatarUrl = avatarUrl;
    user.updatedAt = Date.now();
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
    const newUnlocks = syncAchievements(user, { accountsSubmitted });
    await saveUsersDb(db);
    notifyBotAchievements(user.username, newUnlocks).catch(() => {});
    return {
      user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      ...buildUnlockPayload(newUnlocks),
    };
  });
}

/** Server-only tab visit recording (analytics tab_visit pipeline; activity tallies only). */
export async function recordTabVisitFromAnalytics(userId, tab, { forceRemint = false } = {}) {
  const safeTab = String(tab ?? '').slice(0, 24);
  if (!ALL_MANAGEABLE_TAB_IDS.includes(safeTab)) return null;
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user || user.role === 'bot') return null;
    if (safeTab === 'admin' && !canAccessAdmin(user)) return null;
    const touched = applyActivityCtx(user, { visitedTab: safeTab });
    const shouldMint = !ACHIEVEMENT_PROOF_INELIGIBLE_TABS.has(safeTab)
      && (touched || forceRemint);
    let proof = null;
    if (shouldMint) {
      try {
        await checkRateLimit(`ach-proof-mint:${userId}`, { max: 10, windowMs: 60_000 });
        proof = mintAchievementProof(user, safeTab);
      } catch (e) {
        if (!isRateLimitError(e)) throw e;
      }
    }
    let newUnlocks = [];
    if (touched) {
      user.updatedAt = Date.now();
      const accountsSubmitted = await countAccountsByCreator(user.id);
      newUnlocks = syncAchievements(user, { accountsSubmitted });
      if (newUnlocks.length) {
        notifyBotAchievements(user.username, newUnlocks).catch(() => {});
      }
    }
    if (touched || proof) {
      await saveUsersDb(db);
    }
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
    return {
      user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      newUnlocks,
      proof,
    };
  });
}

export async function syncUserAchievements(userId, ctx = {}) {
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    const safeCtx = { ...ctx };
    delete safeCtx.visitedTab;
    delete safeCtx.visitedProfile;
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
    const newUnlocks = syncAchievements(user, { ...safeCtx, accountsSubmitted });
    if (newUnlocks.length) {
      user.updatedAt = Date.now();
      await saveUsersDb(db);
      notifyBotAchievements(user.username, newUnlocks).catch(() => {});
    }
    return {
      user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      ...buildUnlockPayload(newUnlocks),
    };
  });
}

const ACHIEVEMENT_EVENT_FLAGS = new Set(['claw_victim']);

export async function recordAchievementEvent(userId, event, proofNonce) {
  const flag = String(event ?? '').trim().slice(0, 32);
  if (!ACHIEVEMENT_EVENT_FLAGS.has(flag)) {
    throw new Error('Unknown achievement event');
  }
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    const act = ensureActivity(user);
    const now = Date.now();
    const lastAt = Number(act.flags?.lastAchievementEventAt) || 0;
    if (now - lastAt < 3000) throw new Error('Please wait before triggering another event');
    if (flag === 'claw_victim') {
      const dayKey = new Date(now).toISOString().slice(0, 10);
      const clawKey = `claw_victim_${dayKey}`;
      const daily = Number(act.flags[clawKey]) || 0;
      if (daily >= 20) throw new Error('Daily claw event limit reached');
    }
    consumeAchievementProof(user, {
      nonce: proofNonce,
      requiredTab: flag === 'claw_victim' ? 'fun' : null,
    });
    act.flags = { ...(act.flags ?? {}), lastAchievementEventAt: now };
    if (flag === 'claw_victim') {
      const dayKey = new Date(now).toISOString().slice(0, 10);
      const clawKey = `claw_victim_${dayKey}`;
      const daily = Number(act.flags[clawKey]) || 0;
      act.flags[clawKey] = daily + 1;
    }
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
    const newUnlocks = await syncAchievementsOnLoadedUser(user, db, { flag });
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    if (newUnlocks.length) {
      notifyBotAchievements(user.username, newUnlocks).catch(() => {});
    }
    return {
      user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      ...buildUnlockPayload(newUnlocks),
    };
  });
}

const TERMINAL_CATALOG_COMMANDS = new Set(['help', 'commands', 'cmds', 'befehle', 'liste']);
const TERMINAL_ACHIEVEMENT_COMMANDS = new Set(['matrix', 'self-destruct', 'reboot self-destruct']);
const RECOGNIZED_TERMINAL_COMMANDS = new Set([
  ...TERMINAL_CATALOG_COMMANDS,
  ...TERMINAL_ACHIEVEMENT_COMMANDS,
]);

export async function recordTerminalCommand(userId, command, proofNonce, sessionTab = null) {
  const cmd = String(command ?? '').trim().toLowerCase().slice(0, 48);
  if (!cmd) throw new Error('Command required');
  if (!RECOGNIZED_TERMINAL_COMMANDS.has(cmd)) throw new Error('Unrecognized command');
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    if (TERMINAL_CATALOG_COMMANDS.has(cmd)) {
      const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
      return {
        user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
        ...buildUnlockPayload([]),
      };
    }
    if (String(sessionTab ?? '') !== 'dashboard') {
      throw new Error('Achievement proof invalid for this action');
    }
    const act = ensureActivity(user);
    const now = Date.now();
    const lastAt = Number(act.flags?.lastTerminalCommandAt) || 0;
    if (now - lastAt < 5000) throw new Error('Please wait before running another command');
    const dayKey = new Date(now).toISOString().slice(0, 10);
    const dailyKey = `terminal_cmds_${dayKey}`;
    const dailyCount = Number(act.flags[dailyKey]) || 0;
    if (dailyCount >= 120) throw new Error('Daily command limit reached');
    consumeAchievementProof(user, {
      nonce: proofNonce,
      excludedTabs: ACHIEVEMENT_PROOF_INELIGIBLE_TABS,
      eligibleTabs: TERMINAL_PROOF_ELIGIBLE_TABS,
    });
    act.flags[dailyKey] = dailyCount + 1;
    act.flags.lastTerminalCommandAt = now;
    const flag = cmd === 'matrix'
      ? 'matrix'
      : cmd === 'self-destruct' || cmd === 'reboot self-destruct'
        ? 'self_destruct'
        : undefined;
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
    const newUnlocks = await syncAchievementsOnLoadedUser(user, db, {
      incrementCommands: true,
      ...(flag ? { flag } : {}),
    });
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    if (newUnlocks.length) {
      notifyBotAchievements(user.username, newUnlocks).catch(() => {});
    }
    const { recordEvent } = await import('../analyticsService.mjs');
    await recordEvent({
      type: 'command_run',
      userId: user.id,
      username: user.username,
      tab: 'dashboard',
      meta: { cmd },
    }).catch(() => {});
    return {
      user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      ...buildUnlockPayload(newUnlocks),
    };
  });
}

export async function getPublicProfileByUsername(username) {
  const db = await loadUsersDb();
  const user = findUserByUsername(db.users, username);
  if (!user) throw new Error('User not found');
  const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
  const view = publicProfileView(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats);
  if (!view) throw new Error('User not found');
  return view;
}

export async function incrementProfileView(username, { viewer = null, sessionTab = null, sessionToken = null } = {}) {
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = findUserByUsername(db.users, username);
    if (!user || !isEffectivelyActive(user)) throw new Error('User not found');
    const uname = String(user.username).toLowerCase();
    const viewerUname = viewer?.username ? String(viewer.username).toLowerCase() : null;
    if (viewerUname && viewerUname === uname) {
      const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
      return {
        user: publicProfileView(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
        credited: false,
      };
    }

    let dirty = false;
    let credited = false;
    if (viewer && viewer.id && viewer.role !== 'bot') {
      const viewerUser = db.users.find((u) => u.id === viewer.id);
      const onProfileTab = String(sessionTab ?? '') === 'profile';
      if (viewerUser && onProfileTab) {
        const visitKey = `profile_visit_${uname}`;
        const alreadyVisited = Boolean(ensureActivity(viewerUser).flags[visitKey]);
        if (!alreadyVisited) {
          const { tryClaimProfileViewCredit, releaseProfileViewCredit } = await import('../analyticsTabIntegrity.mjs');
          const burstOk = sessionToken ? await tryClaimProfileViewCredit(sessionToken) : false;
          if (burstOk) {
            try {
              user.profileViews = (Number(user.profileViews) || 0) + 1;
              user.updatedAt = Date.now();
              dirty = true;
              credited = true;
              syncAchievements(user, { accountsSubmitted: await countAccountsByCreator(user.id) });
              const ctx = { visitedProfile: uname };
              if (user.role === 'admin') ctx.flag = 'visited_admin_profile';
              applyActivityCtx(viewerUser, ctx);
              const viewerSubmitted = await countAccountsByCreator(viewerUser.id);
              syncAchievements(viewerUser, { ...ctx, accountsSubmitted: viewerSubmitted });
              viewerUser.updatedAt = Date.now();
              dirty = true;
            } catch (creditErr) {
              if (sessionToken) await releaseProfileViewCredit(sessionToken);
              throw creditErr;
            }
          }
        }
      }
    }
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);

    if (dirty) await saveUsersDb(db);
    if (credited && viewer?.id) {
      const { recordEvent } = await import('../analyticsService.mjs');
      await recordEvent({
        type: 'profile_view',
        userId: viewer.id,
        username: viewer.username ?? null,
        tab: 'profile',
        meta: { target: uname },
      }).catch(() => {});
    }
    return {
      user: publicProfileView(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
      credited,
    };
  });
}

export async function getReferralInfo(userId, req) {
  return withUsersWrite(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    ensureUniqueReferralCode(db, user);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    const { accountsSubmitted, reportedNotWorkingAccounts, profileStats } = await profileExtrasForUser(user);
    const code = user.referralCode;
    return {
      referralCode: code,
      referralsCount: Number(user.referralsCount) || 0,
      inviteUrl: buildInviteUrl(req, code),
      user: enrichUserForClient(user, accountsSubmitted, reportedNotWorkingAccounts, profileStats),
    };
  });
}

export async function syncAchievementsOnLoadedUser(user, db, ctx = {}) {
  if (!user || user.role === 'bot') return [];
  const accountsSubmitted = await countAccountsByCreator(user.id);
  const newUnlocks = syncAchievements(user, { ...ctx, accountsSubmitted });
  if (newUnlocks.length) {
    notifyBotAchievements(user.username, newUnlocks).catch(() => {});
  }
  return newUnlocks;
}

export async function recordUserShoutboxSend(userId) {
  if (!userId) return [];
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user || user.role === 'bot') return [];

    const act = ensureActivity(user);
    act.shoutboxSent = Math.max(0, Number(act.shoutboxSent) || 0) + 1;

    const accountsSubmitted = await countAccountsByCreator(user.id);
    const newUnlocks = syncAchievements(user, { accountsSubmitted });
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    if (newUnlocks.length) {
      notifyBotAchievements(user.username, newUnlocks).catch(() => {});
    }
    return newUnlocks;
  });
}

export async function incrementUserImageUpload(userId) {
  if (!userId) return [];
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user || user.role === 'bot') return [];
    user.imagesUploaded = (Number(user.imagesUploaded) || 0) + 1;
    ensureActivity(user).flags.image_host = true;
    const newUnlocks = await syncAchievementsOnLoadedUser(user, db);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return newUnlocks;
  });
}

export async function incrementUserPasteCount(userId) {
  if (!userId) return [];
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user || user.role === 'bot') return [];
    user.pastesCreated = (Number(user.pastesCreated) || 0) + 1;
    ensureActivity(user).flags.paste_create = true;
    const newUnlocks = await syncAchievementsOnLoadedUser(user, db);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return newUnlocks;
  });
}

export async function incrementUserPasteViews(userId, { viewerId, pasteId } = {}) {
  if (!userId || !viewerId || !pasteId) return [];
  if (String(viewerId) === String(userId)) return [];
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const viewer = db.users.find((u) => u.id === viewerId);
    if (!viewer || viewer.role === 'bot') return [];
    const flagKey = `paste_view_${String(pasteId)}`;
    const act = ensureActivity(viewer);
    if (act.flags[flagKey]) return [];
    act.flags[flagKey] = true;
    viewer.updatedAt = Date.now();

    const user = db.users.find((u) => u.id === userId);
    if (!user || user.role === 'bot') {
      await saveUsersDb(db);
      return [];
    }
    user.pasteViewsTotal = (Number(user.pasteViewsTotal) || 0) + 1;
    const newUnlocks = await syncAchievementsOnLoadedUser(user, db);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return newUnlocks;
  });
}

export async function incrementUserMemeCreated(userId, memeImageId = '') {
  if (!userId) return [];
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user || user.role === 'bot') return [];
    const imageId = String(memeImageId ?? '').trim().slice(0, 64);
    if (imageId) {
      const act = ensureActivity(user);
      const statKey = `meme_stat_${imageId}`;
      if (act.flags[statKey]) return [];
      act.flags[statKey] = true;
    }
    user.memesCreated = (Number(user.memesCreated) || 0) + 1;
    const newUnlocks = await syncAchievementsOnLoadedUser(user, db);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return newUnlocks;
  });
}

export async function deleteOwnAccount(userId, password) {
  const { leaveAllGameQueues } = await import('../gamesService.mjs');
  const { blockRegistrationSignalsForUser } = await import('./registrationRegistry.mjs');

  const db = await loadUsersDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found');
  const pwd = String(password ?? '');
  if (!pwd) throw new Error('Password required to delete account');
  if (!(await verifyPassword(pwd, user.passwordHash))) {
    throw new Error('Invalid password');
  }

  await withUsersWrite(async () => {
    const freshDb = await loadUsersDb();
    const freshUser = freshDb.users.find((u) => u.id === userId);
    if (!freshUser) throw new Error('User not found');
    if (freshUser.role === 'admin' && countActiveAdmins(freshDb.users) <= 1) {
      throw new Error('Last admin cannot be deleted');
    }
    const cleanup = await leaveAllGameQueues(userId);
    await refundOrphanEscrowsAfterCleanup(userId, cleanup);
    await refundUserEscrows(userId).catch((e) => {
      console.warn('[auth] final escrow refund before delete failed', userId, e);
    });
    await blockRegistrationSignalsForUser(freshUser);
    freshUser.registrationBlocked = true;
    freshDb.users = freshDb.users.filter((u) => u.id !== userId);
    await saveUsersDb(freshDb);
  });

  await withSessionsWrite(async () => {
    const sessionsDb = await loadSessionsDb();
    sessionsDb.sessions = sessionsDb.sessions.filter((s) => s.userId !== userId);
    await saveSessionsDb(sessionsDb);
  });
}

export async function getPublicAuthStats() {
  const db = await loadUsersDb();
  const users = db.users.filter((u) => u.role !== 'bot');
  return {
    registered: users.length,
    active: users.filter((u) => isEffectivelyActive(u)).length,
  };
}