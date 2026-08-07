/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { changelogVersionExists } from './changelogMeta.mjs';
import { getArticleById } from './newsStore.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { readJsonBody } from './readJsonBody.mjs';
import { claimIpView } from './viewDedup.mjs';
import { getAllPostViews, recordPostView, sanitizePostId } from './postViewsStore.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function handlePostViewsRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/post-views') {
      await checkRateLimit(`post-views-read:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      return sendJson(res, 200, await getAllPostViews());
    }

    if (req.method === 'POST' && pathname === '/api/post-views/view') {
      const ip = clientIp(req);
      await checkRateLimit(`post-view:${ip}`, { max: 60, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const type = String(body.type ?? '').trim();
      const rawId = String(body.id ?? '').trim();
      const id = sanitizePostId(rawId);
      if (!id || (type !== 'changelog' && type !== 'news')) {
        return sendJson(res, 400, { error: 'type (changelog|news) and id required' });
      }
      const bucket = type === 'news' ? 'news' : 'changelog';
      if (bucket === 'news') {
        const article = await getArticleById(id);
        if (!article) return sendJson(res, 404, { error: 'Article not found' });
      } else if (!(await changelogVersionExists(id))) {
        return sendJson(res, 404, { error: 'Changelog entry not found' });
      }

      if (!(await claimIpView(`post-${bucket}`, ip, id))) {
        const all = await getAllPostViews();
        return sendJson(res, 200, {
          type: bucket,
          id,
          views: Math.max(0, Number(all[bucket]?.[id]) || 0),
          deduped: true,
        });
      }

      try {
        const recorded = await recordPostView(type, id);
        if (!recorded) return sendJson(res, 400, { error: 'Invalid id' });
        return sendJson(res, 200, { ...recorded, deduped: false });
      } catch (recErr) {
        console.warn('[post-views] record failed after claim', recErr);
        const all = await getAllPostViews();
        return sendJson(res, 200, {
          type: bucket,
          id,
          views: Math.max(0, Number(all[bucket]?.[id]) || 0),
          deduped: false,
          recordFailed: true,
        });
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    if (isRateLimitError(err)) {
      applyRateLimitHeaders(res, err);
      return sendJson(res, 429, { error: err.message || 'Too many requests' });
    }
    const status = err instanceof SyntaxError || err?.message === 'Payload too large'
        ? 400
        : err?.message === 'Not logged in'
          ? 401
          : err?.message === 'Permission denied'
            ? 403
            : 500;
    return sendJson(res, status, { error: err.message || 'Server error' });
  }
}

export function createPostViewsMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/post-views')) {
      return handlePostViewsRequest(req, res);
    }
    next();
  });
}
