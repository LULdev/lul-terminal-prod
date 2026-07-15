/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth, requireAuth } from './auth/authApi.mjs';
import { ensureActivity } from './auth/achievements.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { ALL_MANAGEABLE_TAB_IDS } from './accessControlStore.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { getAllPageViews, getPageViews, recordPageView, sanitizePageId } from './pageViewsStore.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function handlePageViewsRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/page-views') {
      await checkRateLimit(`page-views-read:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      await attachAuth(req);
      requireAuth(req);
      await requireMemberTab(req, 'stats');
      return sendJson(res, 200, await getAllPageViews());
    }

    const viewMatch = pathname.match(/^\/api\/page-views\/([a-zA-Z0-9_-]{1,24})\/view$/);
    if (viewMatch && req.method === 'POST') {
      await checkRateLimit(`page-view:${clientIp(req)}`, { max: 40, windowMs: 60_000 });
      await attachAuth(req);
      const viewer = requireAuth(req);
      const pageId = sanitizePageId(viewMatch[1]);
      if (!pageId) return sendJson(res, 400, { error: 'Invalid page id' });
      if (!ALL_MANAGEABLE_TAB_IDS.includes(pageId)) {
        return sendJson(res, 404, { error: 'Page not found' });
      }
      await requireMemberTab(req, pageId);
      const flagKey = `page_view_${pageId}`;

      const result = await runCoinTransaction(async () => {
        const db = await loadUsersDb();
        const viewerUser = db.users.find((u) => u.id === viewer.id);
        if (!viewerUser) throw new Error('User not found');
        const act = ensureActivity(viewerUser);
        if (act.flags[flagKey]) {
          return { pageId, views: await getPageViews(pageId), deduped: true };
        }
        act.flags[flagKey] = true;
        viewerUser.updatedAt = Date.now();
        await saveUsersDb(db);
        try {
          const recorded = await recordPageView(pageId);
          if (!recorded) throw new Error('Invalid page id');
          return recorded;
        } catch (e) {
          delete act.flags[flagKey];
          viewerUser.updatedAt = Date.now();
          await saveUsersDb(db);
          throw e;
        }
      });

      return sendJson(res, 200, result);
    }

    const idMatch = pathname.match(/^\/api\/page-views\/([a-zA-Z0-9_-]{1,24})$/);
    if (idMatch && req.method === 'GET') {
      await checkRateLimit(`page-views-read:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      const id = sanitizePageId(idMatch[1]);
      if (!id) return sendJson(res, 400, { error: 'Invalid page id' });
      await attachAuth(req);
      requireAuth(req);
      if (!ALL_MANAGEABLE_TAB_IDS.includes(id)) {
        return sendJson(res, 404, { error: 'Page not found' });
      }
      await requireMemberTab(req, id);
      return sendJson(res, 200, { pageId: id, views: await getPageViews(id) });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    if (isRateLimitError(err)) {
      applyRateLimitHeaders(res, err);
      return sendJson(res, 429, { error: err.message || 'Too many requests' });
    }
    const status = err instanceof SyntaxError
        ? 400
        : err?.message === 'Not logged in'
          ? 401
          : err?.message === 'Permission denied'
            ? 403
            : 500;
    return sendJson(res, status, { error: err.message || 'Server error' });
  }
}

export function createPageViewsMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/page-views')) {
      return handlePageViewsRequest(req, res);
    }
    next();
  });
}