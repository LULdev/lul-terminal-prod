/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { wrapAsyncHandler } from '../asyncMiddleware.mjs';
import { requireMemberTab } from '../tabAccessGuard.mjs';
import {
  clearSessionCookie,
  parseCookies,
  setRegistrationLockCookie,
  setSessionCookie,
  SESSION_COOKIE,
} from './cookies.mjs';
import {
  canAccessAdmin,
  canDeletePremiumAccounts,
  canSubmitPremiumAccounts,
  canViewPremiumAccounts,
  enrichUserForClient,
} from './permissions.mjs';
import {
  deleteOwnAccount,
  getPublicProfileByUsername,
  incrementProfileView,
  initAuth,
  loginUser,
  logoutUser,
  registerUser,
  reconcileExpiredSession,
  resolveSession,
  getPublicAuthStats,
  getReferralInfo,
  recordAchievementEvent,
  recordTerminalCommand,
  syncUserAchievements,
  updateProfile,
  uploadUserAvatar,
} from './authService.mjs';
import { getAvatarFile } from './avatarStore.mjs';
import {
  createUserAdmin,
  deleteUserAdmin,
  listUsers,
  updateUserAdmin,
} from './adminService.mjs';
import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from '../rateLimit.mjs';

let initPromise = null;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = 512 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function attachAuth(req) {
  initPromise ??= initAuth();
  await initPromise;
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) await reconcileExpiredSession(token);
  const resolved = await resolveSession(token);
  req.auth = {
    token: token ?? null,
    user: resolved?.user ?? null,
    session: resolved?.session ?? null,
  };
  if (resolved?.user?.id) {
    const { touchUserLastSeen } = await import('../chatStats.mjs');
    touchUserLastSeen(resolved.user.id).catch(() => {});
  }
  return req.auth;
}

export function requireAuth(req) {
  if (!req.auth?.user) throw new Error('Not logged in');
  return req.auth.user;
}

export function requireRole(req, minChecker) {
  const user = requireAuth(req);
  if (!minChecker(user)) throw new Error('Permission denied');
  return user;
}

async function recordAuthLifecycleEvent(req, type, user, token) {
  const { recordEvent } = await import('../analyticsService.mjs');
  const ip = clientIp(req);
  await recordEvent({
    type,
    userId: user?.id ?? null,
    username: user?.username ?? null,
    guestId: null,
    sessionId: token?.slice(0, 16) ?? user?.id ?? null,
    tab: null,
    meta: { ip },
  }).catch(() => {});
}

export async function handleAuthRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    await attachAuth(req);

    if (req.method === 'GET' && pathname === '/api/auth/me') {
      await checkRateLimit(`auth-me:${clientIp(req)}`, { max: 120, windowMs: 60_000 });
      const { countAccountsByCreator } = await import('../premiumAccountsService.mjs');
      let user = null;
      let accountsSubmitted = 0;
      if (req.auth.user) {
        const { getAcceptedNotWorkingForCreator } = await import('../premiumAccountsReports.mjs');
        accountsSubmitted = await countAccountsByCreator(req.auth.user.id);
        const reportedNotWorkingAccounts = await getAcceptedNotWorkingForCreator(req.auth.user.id);
        const { buildProfileStats } = await import('../profileStats.mjs');
        const profileStats = await buildProfileStats(req.auth.user);
        user = enrichUserForClient(req.auth.user, accountsSubmitted, reportedNotWorkingAccounts, profileStats);
      }
      return sendJson(res, 200, {
        user,
        stats: req.auth.user ? { accountsSubmitted } : null,
        permissions: {
          premiumView: canViewPremiumAccounts(req.auth.user),
          premiumSubmit: canSubmitPremiumAccounts(req.auth.user),
          premiumDelete: canDeletePremiumAccounts(req.auth.user),
          admin: canAccessAdmin(req.auth.user),
          isVip: req.auth.user?.role === 'vip' || req.auth.user?.role === 'admin',
          isVerified: Boolean(req.auth.user?.verified),
        },
      });
    }

    if (req.method === 'GET' && pathname === '/api/auth/register/challenge') {
      await checkRateLimit(`reg-challenge:${clientIp(req)}`, { max: 30, windowMs: 15 * 60_000 });
      const { issueRegistrationChallenge } = await import('./registrationChallenge.mjs');
      return sendJson(res, 200, issueRegistrationChallenge(req));
    }

    if (req.method === 'POST' && pathname === '/api/auth/register') {
      const ip = clientIp(req);
      await checkRateLimit(`register:${ip}`, { max: 2, windowMs: 24 * 60 * 60_000 });
      const body = await readJsonBody(req);
      const result = await registerUser(body, req);
      if (result.registrationLockToken) {
        setRegistrationLockCookie(res, result.registrationLockToken);
      }
      return sendJson(res, 201, { user: result.user });
    }

    if (req.method === 'GET' && pathname === '/api/auth/referral/me') {
      const user = requireAuth(req);
      await requireMemberTab(req, 'invite');
      await checkRateLimit(`referral-read:${user.id}`, { max: 30, windowMs: 60_000 });
      const info = await getReferralInfo(user.id, req);
      return sendJson(res, 200, info);
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      await checkRateLimit(`login:${clientIp(req)}`, { max: 25, windowMs: 15 * 60_000 });
      const body = await readJsonBody(req);
      const emailKey = String(body.email ?? '').trim().toLowerCase().slice(0, 128);
      if (emailKey) {
        await checkRateLimit(`login-email:${emailKey}`, { max: 10, windowMs: 15 * 60_000 });
      }
      const result = await loginUser(body);
      await recordAuthLifecycleEvent(req, 'login', result.user, result.token);
      await recordAuthLifecycleEvent(req, 'session_start', result.user, result.token);
      setSessionCookie(res, result.token, result.maxAgeSec);
      const { countAccountsByCreator } = await import('../premiumAccountsService.mjs');
      const accountsSubmitted = await countAccountsByCreator(result.user.id);
      return sendJson(res, 200, {
        user: result.user,
        newUnlocks: result.newUnlocks ?? [],
        stats: { accountsSubmitted },
        permissions: {
          premiumView: canViewPremiumAccounts(result.user),
          premiumSubmit: canSubmitPremiumAccounts(result.user),
          premiumDelete: canDeletePremiumAccounts(result.user),
          admin: canAccessAdmin(result.user),
          isVip: result.user?.role === 'vip' || result.user?.role === 'admin',
          isVerified: Boolean(result.user?.verified),
        },
      });
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      await checkRateLimit(`logout:${clientIp(req)}`, { max: 30, windowMs: 60_000 });
      if (req.auth?.user) {
        await recordAuthLifecycleEvent(req, 'logout', req.auth.user, req.auth.token);
      }
      await logoutUser(req.auth.token);
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'PATCH' && pathname === '/api/auth/profile') {
      const user = requireAuth(req);
      await checkRateLimit(`profile-patch:${user.id}`, { max: 10, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const updated = await updateProfile(user.id, body, { keepToken: req.auth.token });
      return sendJson(res, 200, { user: updated.user, newUnlocks: updated.newUnlocks ?? [] });
    }

    if (req.method === 'POST' && pathname === '/api/auth/avatar') {
      const user = requireAuth(req);
      await checkRateLimit(`avatar:${user.id}`, { max: 10, windowMs: 60_000 });
      const body = await readJsonBody(req, 3 * 1024 * 1024);
      const b64 = String(body.data ?? '');
      const estBytes = Math.floor((b64.length * 3) / 4);
      if (estBytes > 2 * 1024 * 1024) throw new Error('Avatar max. 2 MB');
      const buffer = Buffer.from(b64, 'base64');
      const result = await uploadUserAvatar(user.id, { mime: body.mime, buffer });
      return sendJson(res, 200, { user: result.user, newUnlocks: result.newUnlocks ?? [] });
    }

    if (req.method === 'POST' && pathname === '/api/auth/achievements/sync') {
      const user = requireAuth(req);
      await requireMemberTab(req, 'dashboard');
      await checkRateLimit(`ach-sync:${user.id}`, { max: 30, windowMs: 60_000 });
      const result = await syncUserAchievements(user.id, {});
      return sendJson(res, 200, { user: result.user, newUnlocks: result.newUnlocks ?? [] });
    }

    if (req.method === 'POST' && pathname === '/api/auth/achievements/event') {
      const user = requireAuth(req);
      await requireMemberTab(req, 'fun');
      await checkRateLimit(`ach-event:${user.id}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const result = await recordAchievementEvent(user.id, String(body.event ?? ''), body.proof);
      return sendJson(res, 200, { user: result.user, newUnlocks: result.newUnlocks ?? [] });
    }

    if (req.method === 'POST' && pathname === '/api/auth/achievements/terminal-command') {
      const user = requireAuth(req);
      await requireMemberTab(req, 'dashboard');
      await checkRateLimit(`ach-cmd:${user.id}`, { max: 40, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const result = await recordTerminalCommand(
        user.id,
        String(body.command ?? ''),
        body.proof,
        req.auth?.session?.analyticsLastTab ?? null,
      );
      return sendJson(res, 200, { user: result.user, newUnlocks: result.newUnlocks ?? [] });
    }

    const avatarFileMatch = pathname.match(/^\/api\/auth\/avatars\/([a-f0-9]+\.(?:jpg|png|gif|webp))$/);
    if (avatarFileMatch && req.method === 'GET') {
      await checkRateLimit(`avatar-file:${clientIp(req)}`, { max: 180, windowMs: 60_000 });
      const hit = await getAvatarFile(avatarFileMatch[1]);
      if (!hit) return sendJson(res, 404, { error: 'Not found' });
      res.statusCode = 200;
      res.setHeader('Content-Type', hit.mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.end(hit.buf);
      return;
    }

    if (req.method === 'DELETE' && pathname === '/api/auth/account') {
      const user = requireAuth(req);
      await checkRateLimit(`account-delete:${user.id}`, { max: 3, windowMs: 3600_000 });
      const body = await readJsonBody(req, 4096);
      const password = String(body.password ?? '');
      if (!password) return sendJson(res, 400, { error: 'Password required to delete account' });
      await deleteOwnAccount(user.id, password);
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/auth/stats') {
      await checkRateLimit(`auth-stats:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      return sendJson(res, 200, await getPublicAuthStats());
    }

    const publicUserMatch = pathname.match(/^\/api\/auth\/users\/([a-z0-9_]+)$/);
    if (publicUserMatch && req.method === 'GET') {
      await checkRateLimit(`profile-read:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      const profile = await getPublicProfileByUsername(publicUserMatch[1]);
      return sendJson(res, 200, { user: profile });
    }

    const profileViewMatch = pathname.match(/^\/api\/auth\/users\/([a-z0-9_]+)\/view$/);
    if (profileViewMatch && req.method === 'POST') {
      await attachAuth(req);
      const viewer = requireAuth(req);
      await requireMemberTab(req, 'profile');
      await checkRateLimit(`profile-view:${viewer.id}`, { max: 40, windowMs: 60_000 });
      const result = await incrementProfileView(profileViewMatch[1], {
        viewer: req.auth?.user ?? null,
        sessionTab: req.auth?.session?.analyticsLastTab ?? null,
        sessionToken: req.auth?.token ?? null,
      });
      return sendJson(res, 200, { user: result.user, credited: result.credited });
    }

    if (pathname.startsWith('/api/auth/admin')) {
      requireRole(req, canAccessAdmin);

      if (req.method === 'GET' && pathname === '/api/auth/admin/users') {
        await checkRateLimit(`admin-users-list:${req.auth.user.id}`, { max: 60, windowMs: 60_000 });
        const data = await listUsers({
          search: url.searchParams.get('search') ?? undefined,
          role: url.searchParams.get('role') ?? undefined,
          active: url.searchParams.get('active') ?? undefined,
        });
        return sendJson(res, 200, data);
      }

      const adminActKey = `admin-users-act:${req.auth.user.id}`;

      if (req.method === 'POST' && pathname === '/api/auth/admin/users') {
        await checkRateLimit(adminActKey, { max: 20, windowMs: 60_000 });
        const body = await readJsonBody(req);
        const user = await createUserAdmin(body);
        return sendJson(res, 201, { user });
      }

      const patchMatch = pathname.match(/^\/api\/auth\/admin\/users\/([a-f0-9]+)$/);
      if (patchMatch && req.method === 'PATCH') {
        await checkRateLimit(adminActKey, { max: 30, windowMs: 60_000 });
        const body = await readJsonBody(req);
        const user = await updateUserAdmin(patchMatch[1], body);
        return sendJson(res, 200, { user });
      }

      if (patchMatch && req.method === 'DELETE') {
        await checkRateLimit(adminActKey, { max: 20, windowMs: 60_000 });
        await deleteUserAdmin(patchMatch[1], req.auth.user.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    if (isRateLimitError(e)) {
      applyRateLimitHeaders(res, e);
      return sendJson(res, 429, { error: msg });
    }
    const status = msg === 'Permission denied'
        ? 403
        : msg === 'Not logged in' || msg === 'Invalid login credentials'
          ? 401
          : e instanceof SyntaxError || msg === 'Payload too large'
            || msg === 'Achievement proof required'
            || msg === 'Achievement proof expired'
            || msg === 'Achievement proof invalid for this action'
            || msg === 'Invalid password'
            || msg === 'Password required to delete account'
            ? 400
            : 500;
    return sendJson(res, status, { error: msg });
  }
}

export function createAuthMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (!pathname.startsWith('/api/auth')) {
      next();
      return;
    }
    return handleAuthRequest(req, res);
  });
}