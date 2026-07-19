/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth, requireAuth, requireRole } from './auth/authApi.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { resolvePublicOrigin } from './resolvePublicOrigin.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { claimGuestView } from './viewDedup.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { pasteViewLink, postBotPastePublished } from './chatBot.mjs';
import { incrementUserPasteCount, incrementUserPasteViews } from './auth/authService.mjs';
import { loadUsersDb } from './auth/authStore.mjs';
import { sanitizeAvatarUrl } from './auth/safeMediaUrl.mjs';
import { resolvePasteAccess } from './pasteAccess.mjs';
import {
  adminDeletePaste,
  adminUpdatePaste,
  computeAdminPasteStats,
  computeUserPasteStats,
  deletePaste,
  getContent,
  getMeta,
  listAllPastes,
  listByUser,
  listPublicArchive,
  listTrendingPublic,
  purgeIfExpired,
  readStats,
  getPasteRatingStatus,
  pasteVoterKey,
  ratePaste,
  recordView,
  savePaste,
  updatePaste,
} from './pasteStore.mjs';

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
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function originFromReq(req) {
  return resolvePublicOrigin(req);
}

async function requireAdmin(req) {
  await attachAuth(req);
  requireRole(req, canAccessAdmin);
}

/** Short-lived author lookup so paste lists show live uploaded avatars + roles. */
let authorLookupCache = { at: 0, byId: null, byName: null };
const AUTHOR_LOOKUP_TTL_MS = 15_000;

async function getAuthorLookup() {
  const now = Date.now();
  if (authorLookupCache.byId && now - authorLookupCache.at < AUTHOR_LOOKUP_TTL_MS) {
    return authorLookupCache;
  }
  try {
    const db = await loadUsersDb();
    const byId = new Map();
    const byName = new Map();
    for (const u of db.users ?? []) {
      if (u?.id) byId.set(String(u.id), u);
      if (u?.username) byName.set(String(u.username).toLowerCase(), u);
    }
    authorLookupCache = { at: now, byId, byName };
    return authorLookupCache;
  } catch (err) {
    console.warn('[paste] author lookup unavailable', err);
    return { at: now, byId: new Map(), byName: new Map() };
  }
}

function resolveAuthorFields(meta, authorLookup) {
  const fallbackName = meta?.username ? String(meta.username) : null;
  const snapshotAvatar = sanitizeAvatarUrl(meta?.avatarUrl) || null;
  const snapshotRole = meta?.authorRole ? String(meta.authorRole) : null;
  const snapshotVerified = Boolean(meta?.authorVerified);

  let user = null;
  if (authorLookup) {
    if (meta?.userId) {
      user = authorLookup.byId.get(String(meta.userId))
        ?? authorLookup.byId.get(String(meta.userId).toLowerCase())
        ?? null;
    }
    if (!user && fallbackName) {
      user = authorLookup.byName.get(String(fallbackName).toLowerCase()) ?? null;
    }
  }

  if (!user) {
    // Fallback to snapshot written at create time (or bare username)
    return {
      username: fallbackName,
      avatarUrl: snapshotAvatar,
      authorRole: snapshotRole,
      authorVerified: snapshotVerified,
    };
  }

  // Prefer live profile avatar so paste matches profile picture after re-upload
  const liveAvatar = sanitizeAvatarUrl(user.avatarUrl) || null;
  return {
    username: user.username ?? fallbackName,
    avatarUrl: liveAvatar || snapshotAvatar || null,
    authorRole: user.role ?? snapshotRole ?? 'user',
    authorVerified: user.verified != null ? Boolean(user.verified) : snapshotVerified,
  };
}

function toAdminClientMeta(meta, req, opts = {}) {
  return {
    ...toClientMeta(meta, req, { ...opts, includePrivate: true }),
    hasPassword: Boolean(meta.passwordHash),
  };
}

function ratingKeyFromReq(req) {
  const userId = req.auth?.user?.id ?? null;
  return pasteVoterKey({ userId, ip: clientIp(req) });
}

function toClientMeta(meta, req, { includePrivate = false, userId = null, authorLookup = null } = {}) {
  const origin = originFromReq(req);
  const locked = meta.visibility === 'protected';
  const ownerOnly = meta.visibility === 'private';
  const author = resolveAuthorFields(meta, authorLookup);
  const base = {
    id: meta.id,
    title: meta.title,
    language: meta.language,
    visibility: meta.visibility,
    locked,
    ownerOnly,
    membersOnly: ownerOnly,
    expiresAt: meta.expiresAt ?? null,
    burnAfterRead: Boolean(meta.burnAfterRead),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt ?? null,
    views: meta.views ?? 0,
    size: meta.size ?? 0,
    lineCount: meta.lineCount ?? 0,
    pinned: Boolean(meta.pinned),
    username: author.username,
    avatarUrl: author.avatarUrl,
    authorRole: author.authorRole,
    authorVerified: author.authorVerified,
    ratingAvg: meta.ratingAvg ?? 0,
    ratingCount: meta.ratingCount ?? 0,
    viewUrl: `${origin}/p/${meta.id}`,
    rawUrl: `${origin}/api/paste/${meta.id}/raw`,
  };
  if (includePrivate) {
    base.userId = meta.userId ?? null;
  }
  // Prefer logged-in user key (owner can always rate); guests fall back to IP hash.
  const uid = userId ?? req.auth?.user?.id ?? null;
  const ratingKey = pasteVoterKey({ userId: uid, ip: clientIp(req) });
  const status = getPasteRatingStatus(meta, ratingKey);
  if (status.userRating) base.userRating = status.userRating;
  base.canRate = status.canRate !== false;
  if (status.lockedUntil) base.ratingLockedUntil = status.lockedUntil;
  return base;
}

function toClientPaste(meta, content, req, opts = {}) {
  return {
    ...toClientMeta(meta, req, opts),
    content,
  };
}

/** Await author lookup then build client meta (lists + single paste). */
async function toClientMetaAsync(meta, req, opts = {}) {
  const authorLookup = opts.authorLookup ?? await getAuthorLookup();
  return toClientMeta(meta, req, { ...opts, authorLookup });
}

async function toClientPasteAsync(meta, content, req, opts = {}) {
  const authorLookup = opts.authorLookup ?? await getAuthorLookup();
  return toClientPaste(meta, content, req, { ...opts, authorLookup });
}

async function toAdminClientMetaAsync(meta, req, opts = {}) {
  const authorLookup = opts.authorLookup ?? await getAuthorLookup();
  return toAdminClientMeta(meta, req, { ...opts, authorLookup });
}

async function clientUserId(req) {
  try {
    await attachAuth(req);
    return req.auth?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function loadAlive(id) {
  const meta = await purgeIfExpired(await getMeta(id));
  return meta;
}

/**
 * Count a paste view with dedup.
 * - Owner's first view counts (same as any viewer).
 * - Dedup: logged-in user id OR guest IP (file/redis claim — NOT user activity flags).
 * - Does NOT run inside withUsersWrite (avoids view-count deadlocks / silent failures).
 */
async function countPasteViewDeduped(req, pasteId, { consumeBurn = false } = {}) {
  try {
    await attachAuth(req);
  } catch {
    /* guest */
  }
  const viewerId = req.auth?.user?.id ?? null;
  const earlyMeta = await loadAlive(pasteId);
  if (!earlyMeta) return null;

  const isOwner = Boolean(
    viewerId && earlyMeta.userId && String(earlyMeta.userId) === String(viewerId),
  );

  let firstTime = true;
  try {
    if (viewerId) {
      // Fresh scope "paste-u" — old paste_meta_view_* achievement flags no longer block counting
      firstTime = await claimGuestView('paste-u', String(viewerId), pasteId);
    } else {
      firstTime = await claimGuestView('paste', clientIp(req), pasteId);
    }
  } catch (err) {
    console.warn('[paste] view dedup claim failed — counting view anyway', err);
    firstTime = true;
  }

  if (!firstTime) {
    // Already counted — still load content when burn path needs it
    let content = null;
    if (consumeBurn && earlyMeta.burnAfterRead) {
      content = await getContent(pasteId);
    }
    return {
      views: earlyMeta.views ?? 0,
      burned: false,
      deduped: true,
      selfView: isOwner,
      meta: earlyMeta,
      content,
    };
  }

  try {
    const result = await recordView(pasteId, {
      consumeBurn: Boolean(consumeBurn && earlyMeta.burnAfterRead),
    });
    if (!result) return null;
    return {
      views: result.meta.views ?? 0,
      burned: result.burned,
      deduped: false,
      selfView: isOwner,
      meta: result.meta,
      content: result.content,
    };
  } catch (err) {
    console.warn('[paste] recordView failed after claim', err);
    return {
      views: earlyMeta.views ?? 0,
      burned: false,
      deduped: false,
      selfView: isOwner,
      meta: earlyMeta,
      content: await getContent(pasteId),
    };
  }
}

/**
 * True when the route should NOT require the Paste tab (members-only module gate).
 * Public share links MUST work for guests even when the Paste tab is members-only.
 * Auth / ownership is still enforced per-handler via resolvePasteAccess / requireAuth.
 *
 * Deny-list approach: only create / my / edit / fork need the members tab.
 * Everything else under /api/paste is public (so guests never get "Permission denied").
 */
function skipsPasteTabGate(method, pathname) {
  if (!pathname.startsWith('/api/paste')) return true;

  // Admin paste panel has its own admin role check
  if (pathname.startsWith('/api/paste/admin')) return true;

  // Member-only: create paste
  if (method === 'POST' && pathname === '/api/paste') return false;

  // Member-only: my gallery / stats
  if (pathname === '/api/paste/my' || pathname.startsWith('/api/paste/my/')) return false;

  // Member-only: edit / delete / fork own paste
  if (method === 'PATCH' || method === 'DELETE') return false;
  if (method === 'POST' && /\/fork\/?$/.test(pathname)) return false;

  // Public: stats, public archive, trending, GET content, raw, view, unlock, rate
  return true;
}

export async function handlePasteRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    // Members-only paste module (create / my gallery / edit) — not public share or rate.
    if (!skipsPasteTabGate(req.method, pathname)) {
      await requireMemberTab(req, 'paste');
    }

    if (req.method === 'GET' && pathname === '/api/paste/stats') {
      await checkRateLimit(`paste-stats:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      return sendJson(res, 200, await readStats());
    }

    if (req.method === 'GET' && pathname === '/api/paste/public') {
      await checkRateLimit(`paste-public:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      const limit = Math.min(80, Math.max(1, Number(url.searchParams.get('limit')) || 40));
      const items = await listPublicArchive(limit);
      const authorLookup = await getAuthorLookup();
      return sendJson(res, 200, {
        pastes: items.map((m) => toClientMeta(m, req, { authorLookup })),
        total: items.length,
      });
    }

    if (req.method === 'GET' && pathname === '/api/paste/trending') {
      await checkRateLimit(`paste-trending:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      const limit = Math.min(40, Math.max(1, Number(url.searchParams.get('limit')) || 12));
      const items = await listTrendingPublic(limit);
      const authorLookup = await getAuthorLookup();
      return sendJson(res, 200, {
        pastes: items.map((m) => toClientMeta(m, req, { authorLookup })),
        total: items.length,
      });
    }

    if (req.method === 'GET' && pathname === '/api/paste/admin/stats') {
      await requireAdmin(req);
      await checkRateLimit(`paste-admin:${req.auth?.user?.id ?? clientIp(req)}`, { max: 120, windowMs: 60_000 });
      return sendJson(res, 200, await computeAdminPasteStats());
    }

    if (req.method === 'GET' && pathname === '/api/paste/admin') {
      await requireAdmin(req);
      await checkRateLimit(`paste-admin:${req.auth?.user?.id ?? clientIp(req)}`, { max: 120, windowMs: 60_000 });
      const q = url.searchParams.get('q') ?? '';
      const visibility = url.searchParams.get('visibility') ?? 'all';
      const sort = url.searchParams.get('sort') ?? 'newest';
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const result = await listAllPastes({ q, visibility, sort, limit, offset });
      const authorLookup = await getAuthorLookup();
      return sendJson(res, 200, {
        pastes: result.pastes.map((m) => toAdminClientMeta(m, req, { authorLookup })),
        total: result.total,
      });
    }

    const adminIdMatch = pathname.match(/^\/api\/paste\/admin\/([A-Za-z0-9_-]{4,64})$/);
    if (adminIdMatch) {
      const id = adminIdMatch[1];
      await requireAdmin(req);
      const adminKey = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`paste-admin:${adminKey}`, { max: 120, windowMs: 60_000 });
      const meta = await loadAlive(id);
      if (!meta) return sendJson(res, 404, { error: 'Paste not found' });

      if (req.method === 'GET') {
        const content = await getContent(id);
        if (!content) return sendJson(res, 404, { error: 'Paste not found' });
        return sendJson(res, 200, {
          ...(await toAdminClientMetaAsync(meta, req)),
          content,
        });
      }

      if (req.method === 'PATCH') {
        await checkRateLimit(`paste-admin-act:${adminKey}`, { max: 30, windowMs: 60_000 });
        const body = await readJsonBody(req);
        const updated = await adminUpdatePaste(id, body);
        const content = await getContent(id);
        return sendJson(res, 200, {
          ...(await toAdminClientMetaAsync(updated, req)),
          content,
        });
      }

      if (req.method === 'DELETE') {
        await checkRateLimit(`paste-admin-act:${adminKey}`, { max: 20, windowMs: 60_000 });
        const result = await adminDeletePaste(id);
        return sendJson(res, 200, result);
      }
    }

    if (req.method === 'GET' && pathname === '/api/paste/my/stats') {
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`paste-my-stats:${user.id}`, { max: 60, windowMs: 60_000 });
      return sendJson(res, 200, await computeUserPasteStats(user.id));
    }

    if (req.method === 'GET' && pathname === '/api/paste/my') {
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`paste-my-list:${user.id}`, { max: 60, windowMs: 60_000 });
      const sort = url.searchParams.get('sort') ?? 'newest';
      const items = await listByUser(user.id, sort);
      const authorLookup = await getAuthorLookup();
      return sendJson(res, 200, {
        pastes: items.map((m) => toClientMeta(m, req, { includePrivate: true, authorLookup })),
        total: items.length,
      });
    }

    if (req.method === 'POST' && pathname === '/api/paste') {
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`paste-create:${user.id}`, { max: 15, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const meta = await savePaste({
        title: body.title,
        content: body.content,
        language: body.language,
        visibility: body.visibility,
        password: body.password,
        expiry: body.expiry,
        burnAfterRead: body.burnAfterRead,
        userId: user.id,
        username: user.username,
        avatarUrl: sanitizeAvatarUrl(user.avatarUrl) || null,
        authorRole: user.role ?? 'user',
        authorVerified: Boolean(user.verified),
      });
      const content = await getContent(meta.id);
      const unlocks = await incrementUserPasteCount(user.id);
      if (user.username) {
        postBotPastePublished({
          username: user.username,
          pasteTitle: meta.title,
          pasteHref: pasteViewLink(meta.id),
          visibility: meta.visibility,
        }).catch(() => {});
      }
      const payload = await toClientPasteAsync(meta, content, req, { includePrivate: true });
      if (unlocks.length) payload.achievementUnlocks = unlocks;
      return sendJson(res, 201, payload);
    }

    const rawMatch = pathname.match(/^\/api\/paste\/([A-Za-z0-9_-]{4,64})\/raw$/);
    if (rawMatch && req.method === 'GET') {
      await checkRateLimit(`paste-pw:${clientIp(req)}:${rawMatch[1]}`, { max: 15, windowMs: 900_000 });
      const meta = await loadAlive(rawMatch[1]);
      if (!meta) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      if (url.searchParams.has('password')) {
        res.statusCode = 400;
        res.end('Password must be sent via POST /api/paste/:id/view or /unlock');
        return;
      }
      const access = await resolvePasteAccess(req, meta, '');
      if (!access.allowed) {
        if (access.notFound) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.statusCode = access.requiresLogin ? 401 : 404;
        res.end(access.requiresLogin ? 'Sign in required' : 'Not found');
        return;
      }
      const viewResult = await countPasteViewDeduped(req, meta.id, { consumeBurn: false });
      const content = viewResult?.content ?? await getContent(meta.id);
      if (!content) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      if (viewResult?.meta?.userId && req.auth?.user?.id && !viewResult.deduped) {
        await incrementUserPasteViews(viewResult.meta.userId, {
          viewerId: req.auth.user.id,
          pasteId: viewResult.meta.id,
        });
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(content);
      return;
    }

    const viewMatch = pathname.match(/^\/api\/paste\/([A-Za-z0-9_-]{4,64})\/view$/);
    if (viewMatch && req.method === 'POST') {
      await checkRateLimit(`paste-view:${clientIp(req)}:${viewMatch[1]}`, { max: 40, windowMs: 60_000 });
      const meta = await loadAlive(viewMatch[1]);
      if (!meta) return sendJson(res, 404, { error: 'Not found' });
      let viewPassword = '';
      try {
        const body = await readJsonBody(req, 8 * 1024);
        viewPassword = body.password ?? '';
      } catch { /* empty body */ }
      const access = await resolvePasteAccess(req, meta, viewPassword);
      if (!access.allowed) {
        if (access.notFound) return sendJson(res, 404, { error: 'Not found' });
        return sendJson(res, access.requiresLogin ? 401 : 403, {
          error: access.requiresLogin ? 'Sign in required' : 'Password required',
          requiresLogin: access.requiresLogin ?? false,
          requiresPassword: access.requiresPassword ?? false,
        });
      }
      const pasteId = viewMatch[1];
      const payload = await countPasteViewDeduped(req, pasteId, { consumeBurn: meta.burnAfterRead });
      if (!payload) return sendJson(res, 404, { error: 'Not found' });
      const viewerId = req.auth?.user?.id ?? null;
      if (payload.meta?.userId && viewerId && !payload.deduped) {
        await incrementUserPasteViews(payload.meta.userId, {
          viewerId,
          pasteId: payload.meta.id,
        });
      }
      return sendJson(res, 200, {
        views: payload.views,
        burned: payload.burned,
      });
    }

    const forkMatch = pathname.match(/^\/api\/paste\/([A-Za-z0-9_-]{4,64})\/fork$/);
    if (forkMatch && req.method === 'POST') {
      await requireMemberTab(req, 'paste');
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`paste-fork:${user.id}`, { max: 30, windowMs: 60_000 });
      const meta = await loadAlive(forkMatch[1]);
      if (!meta) return sendJson(res, 404, { error: 'Not found' });
      if (String(meta.userId) !== String(user.id)) return sendJson(res, 403, { error: 'Not allowed' });
      const content = await getContent(meta.id);
      if (!content) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, {
        title: `${meta.title} (fork)`,
        content,
        language: meta.language,
        visibility: meta.visibility === 'public' ? 'public' : 'private',
        sourceId: meta.id,
      });
    }

    const rateMatch = pathname.match(/^\/api\/paste\/([A-Za-z0-9_-]{4,64})\/rate$/);
    if (rateMatch && req.method === 'POST') {
      // Guests + members may rate. Logged-in → user: key (owner works). Guests → IP hash, 24h lock.
      try {
        await attachAuth(req);
      } catch { /* guest */ }
      const ip = clientIp(req);
      const user = req.auth?.user ?? null;
      const voterKey = pasteVoterKey({ userId: user?.id ?? null, ip });
      await checkRateLimit(`paste-rate:${user?.id ?? ip}`, { max: 40, windowMs: 60_000 });
      const meta = await loadAlive(rateMatch[1]);
      if (!meta) return sendJson(res, 404, { error: 'Paste not found' });
      // Private pastes: only the owner may rate
      if (meta.visibility === 'private') {
        if (!user?.id || !meta.userId || String(meta.userId) !== String(user.id)) {
          return sendJson(res, 404, { error: 'Paste not found' });
        }
      }
      const body = await readJsonBody(req, 4 * 1024);
      const stars = Number(body.stars);
      if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
        return sendJson(res, 400, { error: 'Rating must be between 1 and 5' });
      }
      try {
        const result = await ratePaste(rateMatch[1], voterKey, stars);
        return sendJson(res, 200, result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Rating failed';
        if (e?.code === 'RATE_LOCKED') {
          return sendJson(res, 429, {
            error: msg,
            code: 'RATE_LOCKED',
            userRating: e.userRating,
            lockedUntil: e.lockedUntil,
            ratingAvg: e.ratingAvg,
            ratingCount: e.ratingCount,
            retryAfterMs: e.retryAfterMs,
          });
        }
        return sendJson(res, msg.includes('not found') ? 404 : 400, { error: msg });
      }
    }

    const unlockMatch = pathname.match(/^\/api\/paste\/([A-Za-z0-9_-]{4,64})\/unlock$/);
    if (unlockMatch && req.method === 'POST') {
      await checkRateLimit(`paste-pw:${clientIp(req)}:${unlockMatch[1]}`, { max: 15, windowMs: 900_000 });
      const meta = await loadAlive(unlockMatch[1]);
      if (!meta) return sendJson(res, 404, { error: 'Not found' });
      if (meta.visibility !== 'protected') {
        return sendJson(res, 404, { error: 'Not found' });
      }
      const body = await readJsonBody(req, 8 * 1024);
      const access = await resolvePasteAccess(req, meta, body.password ?? '');
      if (!access.allowed) {
        return sendJson(res, 404, { error: 'Not found' });
      }
      const unlockUid = await clientUserId(req);
      if (meta.burnAfterRead) {
        const viewResult = await countPasteViewDeduped(req, meta.id, { consumeBurn: true });
        if (!viewResult) return sendJson(res, 404, { error: 'Not found' });
        const content = viewResult.content ?? await getContent(meta.id);
        if (!content) return sendJson(res, 404, { error: 'Not found' });
        if (viewResult.meta?.userId && unlockUid && !viewResult.deduped) {
          await incrementUserPasteViews(viewResult.meta.userId, { viewerId: unlockUid, pasteId: meta.id });
        }
        return sendJson(res, 200, {
          ...(await toClientPasteAsync(viewResult.meta, content, req, { userId: unlockUid })),
          burned: true,
        });
      }
      const viewResult = await countPasteViewDeduped(req, meta.id, { consumeBurn: false });
      const outMeta = viewResult?.meta ?? meta;
      const content = viewResult?.content ?? await getContent(meta.id);
      if (!content) return sendJson(res, 404, { error: 'Not found' });
      if (viewResult?.meta?.userId && unlockUid && !viewResult.deduped) {
        await incrementUserPasteViews(viewResult.meta.userId, { viewerId: unlockUid, pasteId: meta.id });
      }
      return sendJson(res, 200, await toClientPasteAsync(outMeta, content, req, { userId: unlockUid }));
    }

    const idMatch = pathname.match(/^\/api\/paste\/([A-Za-z0-9_-]{4,64})$/);
    if (idMatch) {
      const id = idMatch[1];

      if (req.method === 'GET') {
        await checkRateLimit(`paste-read:${clientIp(req)}`, { max: 120, windowMs: 60_000 });
        const meta = await loadAlive(id);
        if (!meta) return sendJson(res, 404, { error: 'Paste not found or expired' });
        const uid = await clientUserId(req);

        if (url.searchParams.has('password')) {
          return sendJson(res, 400, { error: 'Password must be sent via POST /api/paste/:id/view or /unlock' });
        }
        const access = await resolvePasteAccess(req, meta, '');
        const isOwner = Boolean(uid && meta.userId && String(meta.userId) === String(uid));

        if (!access.allowed) {
          if (access.notFound) return sendJson(res, 404, { error: 'Paste not found or expired' });
          // Owner may open protected pastes without password — still count their view
          if (isOwner) {
            let content = null;
            let outMeta = meta;
            let burned = false;
            try {
              const viewResult = await countPasteViewDeduped(req, id, {
                consumeBurn: Boolean(meta.burnAfterRead),
              });
              if (viewResult) {
                content = viewResult.content ?? await getContent(id);
                outMeta = viewResult.meta ?? meta;
                burned = Boolean(viewResult.burned);
              } else {
                content = await getContent(id);
              }
            } catch (viewErr) {
              console.warn('[paste] owner view count failed, still returning content', viewErr);
              content = await getContent(id);
            }
            if (!content) return sendJson(res, 404, { error: 'Paste not found or expired' });
            return sendJson(res, 200, {
              ...(await toClientPasteAsync(outMeta, content, req, { userId: uid, includePrivate: true })),
              burned,
            });
          }
          if (access.requiresPassword) {
            return sendJson(res, 200, {
              ...(await toClientMetaAsync(meta, req, { userId: uid })),
              content: null,
              requiresPassword: true,
              requiresLogin: false,
            });
          }
          if (access.requiresLogin) {
            return sendJson(res, 200, {
              ...(await toClientMetaAsync(meta, req, { userId: uid })),
              content: null,
              requiresPassword: false,
              requiresLogin: true,
            });
          }
          return sendJson(res, 404, { error: 'Paste not found or expired' });
        }

        // Public / authorized (incl. owner on private): count view (owner first view included).
        let content = null;
        let outMeta = meta;
        let burned = false;
        try {
          const viewResult = await countPasteViewDeduped(req, id, {
            consumeBurn: Boolean(meta.burnAfterRead),
          });
          if (viewResult) {
            content = viewResult.content ?? await getContent(id);
            outMeta = viewResult.meta ?? meta;
            burned = Boolean(viewResult.burned);
            // Profile pasteViewsTotal: only non-self viewers
            if (viewResult.meta?.userId && uid && !viewResult.deduped && !viewResult.selfView) {
              await incrementUserPasteViews(viewResult.meta.userId, {
                viewerId: uid,
                pasteId: id,
              }).catch(() => {});
            }
          } else {
            content = await getContent(id);
          }
        } catch (viewErr) {
          console.warn('[paste] view count failed, still returning content', viewErr);
          content = await getContent(id);
        }
        if (!content) return sendJson(res, 404, { error: 'Paste not found or expired' });
        return sendJson(res, 200, {
          ...(await toClientPasteAsync(outMeta, content, req, { userId: uid, includePrivate: isOwner })),
          burned,
        });
      }

      if (req.method === 'PATCH') {
        await requireMemberTab(req, 'paste');
        await attachAuth(req);
        const user = requireAuth(req);
        await checkRateLimit(`paste-update:${user.id}`, { max: 30, windowMs: 60_000 });
        const body = await readJsonBody(req);
        const meta = await updatePaste(id, user.id, body);
        const content = await getContent(id);
        return sendJson(res, 200, await toClientPasteAsync(meta, content, req, { includePrivate: true }));
      }

      if (req.method === 'DELETE') {
        await requireMemberTab(req, 'paste');
        await attachAuth(req);
        const user = requireAuth(req);
        await checkRateLimit(`paste-delete:${user.id}`, { max: 20, windowMs: 60_000 });
        const result = await deletePaste(id, user.id);
        return sendJson(res, 200, result);
      }
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    if (isRateLimitError(e)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = e instanceof Error ? e.message : 'Server error';
    const status = msg === 'Not logged in' ? 401
      : msg === 'Permission denied' || msg === 'Not allowed' ? 403
      : msg.includes('too large') || msg.includes('empty') ? 400
      : e instanceof SyntaxError ? 400
      : 500;
    sendJson(res, status, { error: msg });
  }
}

export function createPasteMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/paste')) {
      return handlePasteRequest(req, res);
    }
    next();
  });
}