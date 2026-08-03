/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { ALL_MANAGEABLE_TAB_IDS } from './accessControlStore.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { claimIpView } from './viewDedup.mjs';
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
      return sendJson(res, 200, await getAllPageViews());
    }

    const viewMatch = pathname.match(/^\/api\/page-views\/([a-zA-Z0-9_-]{1,24})\/view$/);
    if (viewMatch && req.method === 'POST') {
      const ip = clientIp(req);
      await checkRateLimit(`page-view:${ip}`, { max: 60, windowMs: 60_000 });
      const pageId = sanitizePageId(viewMatch[1]);
      if (!pageId) return sendJson(res, 400, { error: 'Invalid page id' });
      if (!ALL_MANAGEABLE_TAB_IDS.includes(pageId)) {
        return sendJson(res, 404, { error: 'Page not found' });
      }
      // Anyone can count; 90m IP dedup only
      if (!(await claimIpView('page', ip, pageId))) {
        return sendJson(res, 200, { pageId, views: await getPageViews(pageId), deduped: true });
      }
      try {
        const recorded = await recordPageView(pageId);
        if (!recorded) return sendJson(res, 400, { error: 'Invalid page id' });
        return sendJson(res, 200, { ...recorded, deduped: false });
      } catch (recErr) {
        // Claim spent but write failed — still return current count (under-count preferred to 500)
        console.warn('[page-views] record failed after claim', recErr);
        return sendJson(res, 200, { pageId, views: await getPageViews(pageId), deduped: false, recordFailed: true });
      }
    }

    const idMatch = pathname.match(/^\/api\/page-views\/([a-zA-Z0-9_-]{1,24})$/);
    if (idMatch && req.method === 'GET') {
      await checkRateLimit(`page-views-read:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      const id = sanitizePageId(idMatch[1]);
      if (!id) return sendJson(res, 400, { error: 'Invalid page id' });
      if (!ALL_MANAGEABLE_TAB_IDS.includes(id)) {
        return sendJson(res, 404, { error: 'Page not found' });
      }
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
