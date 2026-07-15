/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { attachAuth, requireAuth } from './auth/authApi.mjs';
import { requireRole } from './auth/authApi.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';

import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { ALL_MANAGEABLE_TAB_IDS } from './accessControlStore.mjs';
import { recordTabVisitFromAnalytics } from './auth/authService.mjs';
import { loadSessionsDb, saveSessionsDb, withSessionsWrite } from './auth/authStore.mjs';
import {
  markTabDwellIntegrity,
  MIN_DWELL_MS,
  rollbackTabVisitCredit,
  tryClaimTabVisitCredit,
} from './analyticsTabIntegrity.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import {
  buildAdminOverview,
  buildUserActivitySummary,
  exportAnalyticsBundle,
  listActiveTodayUsers,
  listAdminUserActivity,
  purgeOldEvents,
  recordEvent,
} from './analyticsService.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = 256 * 1024) {
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

export async function handleAnalyticsRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'POST' && pathname === '/api/analytics/track') {
      await attachAuth(req);
      const rateKey = req.auth?.user?.id
        ? `analytics:${req.auth.user.id}`
        : `analytics-guest:${clientIp(req)}`;
      await checkRateLimit(rateKey, {
        max: req.auth?.user?.id ? 90 : 30,
        windowMs: 60_000,
      });
      const body = await readJsonBody(req);

      const eventType = String(body.type ?? '').slice(0, 48);
      const rawTab = eventType === 'faq_visit'
        ? 'faq'
        : String(body.tab ?? '').slice(0, 24);
      const safeTab = ALL_MANAGEABLE_TAB_IDS.includes(rawTab) ? rawTab : null;
      const ip = clientIp(req);
      const derivedGuestId = req.auth?.user
        ? null
        : crypto.createHash('sha256').update(`guest:${ip}`).digest('hex').slice(0, 16);
      const meta = body.meta && typeof body.meta === 'object' ? { ...body.meta } : {};
      delete meta.forceRemint;
      if (eventType === 'tab_dwell' && typeof meta.dwellSec === 'number') {
        meta.dwellSec = Math.min(Math.max(0, Math.round(meta.dwellSec)), 3600);
      }
      let persistTab = safeTab;
      const tabGatedTypes = new Set(['tab_visit', 'faq_visit', 'tab_dwell']);
      if (tabGatedTypes.has(eventType) && safeTab) {
        try {
          await requireMemberTab(req, safeTab);
          if (safeTab === 'admin' && !canAccessAdmin(req.auth?.user)) {
            persistTab = null;
          }
        } catch {
          persistTab = null;
        }
      }
      if (eventType === 'tab_dwell' && !req.auth?.user) {
        persistTab = null;
      }
      if (eventType === 'tab_dwell' && persistTab && req.auth?.token) {
        const dwellSec = Number(meta.dwellSec) || 0;
        const sessionsDb = await loadSessionsDb();
        const session = sessionsDb.sessions.find((s) => s.token === req.auth.token);
        if (
          !session
          || session.expiresAt <= Date.now()
          || String(session.analyticsLastTab ?? '') !== persistTab
          || dwellSec < 2
        ) {
          persistTab = null;
        } else {
          const lastVisitAt = Number(session.analyticsLastVisitAt) || 0;
          if (lastVisitAt > 0 && Date.now() - lastVisitAt < MIN_DWELL_MS) {
            persistTab = null;
          } else {
            await markTabDwellIntegrity(req.auth.token, persistTab);
          }
        }
      }

      if (!req.auth?.user) {
        return sendJson(res, 201, { ok: true, eventId: null, user: null, proof: null });
      }

      if (
        eventType === 'profile_view'
        || eventType === 'command_run'
        || eventType === 'login'
        || eventType === 'logout'
        || eventType === 'search'
        || eventType === 'feature_use'
        || eventType === 'session_end'
        || (eventType === 'session_start' && req.auth?.user)
      ) {
        return sendJson(res, 201, { ok: true, eventId: null, user: null, proof: null });
      }

      if (tabGatedTypes.has(eventType) && !persistTab) {
        return sendJson(res, 201, { ok: false, eventId: null, user: null, proof: null });
      }

      const eventBase = {
        type: eventType,
        userId: req.auth?.user?.id ?? null,
        username: req.auth?.user?.username ?? null,
        guestId: derivedGuestId,
        sessionId: req.auth?.user
          ? (req.auth.token?.slice(0, 16) ?? req.auth.user.id)
          : derivedGuestId,
        tab: persistTab,
        meta,
      };

      let userPayload = null;
      let proofPayload = null;
      let event = null;

      const isLoggedInTabVisit = req.auth?.user?.id && persistTab
        && (eventType === 'tab_visit' || eventType === 'faq_visit');

      if (isLoggedInTabVisit) {
        try {
          await checkRateLimit(`analytics-tab-visit:${req.auth.user.id}`, { max: 24, windowMs: 60_000 });
          const sessionCreated = Number(req.auth.session?.createdAt) || 0;
          const forceRemint = Boolean(req.auth.session?.analyticsProofRemint)
            && sessionCreated > 0
            && (Date.now() - sessionCreated) < 120_000;
          const claim = await tryClaimTabVisitCredit(req.auth.token, persistTab, { forceRemint });
          if (!claim.claimed) {
            return sendJson(res, 201, { ok: false, eventId: null, user: null, proof: null });
          }
          const sameTabRevisit = claim.snapshot?.analyticsLastTab === persistTab && !forceRemint;
          if (sameTabRevisit) {
            return sendJson(res, 201, { ok: true, eventId: null, user: null, proof: null });
          }
          try {
            event = await recordEvent(eventBase);
            const visitResult = await recordTabVisitFromAnalytics(req.auth.user.id, persistTab, { forceRemint });
            userPayload = visitResult?.user ?? null;
            proofPayload = visitResult?.proof ?? null;
            if (forceRemint && req.auth.token) {
              await withSessionsWrite(async () => {
                const db = await loadSessionsDb();
                const session = db.sessions.find((s) => s.token === req.auth.token);
                if (session) {
                  session.analyticsProofRemint = false;
                  await saveSessionsDb(db);
                }
              });
            }
          } catch (sideErr) {
            if (claim.snapshot) {
              await rollbackTabVisitCredit(req.auth.token, claim.snapshot);
            }
            throw sideErr;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          if (!isRateLimitError(e) && msg !== 'Permission denied') {
            console.warn('[analytics] tab visit side effect failed', e);
          }
          const status = isRateLimitError(e) ? 429 : 201;
          return sendJson(res, status, { ok: false, eventId: null, user: null, proof: null });
        }
      } else {
        event = await recordEvent(eventBase);
      }

      return sendJson(res, 201, {
        ok: true,
        eventId: event?.id ?? null,
        user: userPayload,
        proof: proofPayload,
      });
    }

    if (req.method === 'GET' && pathname === '/api/analytics/me') {
      await attachAuth(req);
      const user = requireAuth(req);
      await requireMemberTab(req, 'activity');
      await checkRateLimit(`analytics-me:${user.id}`, { max: 60, windowMs: 60_000 });
      const summary = await buildUserActivitySummary(user.id);
      if (!summary) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, summary);
    }

    const adminRoutes = pathname.startsWith('/api/analytics/admin/');
    if (adminRoutes) {
      await attachAuth(req);
      requireRole(req, canAccessAdmin);
      const adminKey = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`analytics-admin:${adminKey}`, { max: 120, windowMs: 60_000 });
    }

    if (req.method === 'GET' && pathname === '/api/analytics/active-today') {
      await attachAuth(req);
      requireRole(req, canAccessAdmin);
      const adminKey = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`analytics-admin:${adminKey}`, { max: 120, windowMs: 60_000 });
      const limit = Math.min(Number(url.searchParams.get('limit')) || 48, 80);
      return sendJson(res, 200, await listActiveTodayUsers(limit));
    }

    if (req.method === 'GET' && pathname === '/api/analytics/admin/overview') {
      return sendJson(res, 200, await buildAdminOverview());
    }

    if (req.method === 'GET' && pathname === '/api/analytics/admin/users') {
      const search = url.searchParams.get('search') ?? '';
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100));
      return sendJson(res, 200, await listAdminUserActivity({ search, limit }));
    }

    if (req.method === 'GET' && pathname === '/api/analytics/admin/export') {
      return sendJson(res, 200, await exportAnalyticsBundle());
    }

    if (req.method === 'POST' && pathname === '/api/analytics/admin/purge') {
      const adminKey = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`analytics-admin-act:${adminKey}`, { max: 10, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const keep = Math.max(1, Math.min(Number(body.keep) || 2000, 50_000));
      return sendJson(res, 200, await purgeOldEvents(keep));
    }

    const userDetail = pathname.match(/^\/api\/analytics\/admin\/users\/([^/]+)$/);
    if (userDetail && req.method === 'GET') {
      const summary = await buildUserActivitySummary(userDetail[1]);
      if (!summary) return sendJson(res, 404, { error: 'User not found' });
      return sendJson(res, 200, summary);
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
        : msg === 'Not logged in'
          ? 401
          : e instanceof SyntaxError || msg === 'Payload too large'
            ? 400
            : 500;
    return sendJson(res, status, { error: msg });
  }
}

export function createAnalyticsMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/analytics')) {
      return handleAnalyticsRequest(req, res);
    }
    next();
  });
}