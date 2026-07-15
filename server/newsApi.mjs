/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth, requireRole } from './auth/authApi.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import {
  createArticle,
  deleteArticle,
  getNewsFeedVersion,
  listAllArticles,
  listPublishedArticles,
  updateArticle,
} from './newsStore.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';

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

export async function handleNewsRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/news/meta') {
      await checkRateLimit(`news-meta:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      await requireMemberTab(req, 'news');
      const feedVersion = await getNewsFeedVersion();
      return sendJson(res, 200, { feedVersion });
    }

    if (req.method === 'GET' && pathname === '/api/news') {
      await checkRateLimit(`news-feed:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      await requireMemberTab(req, 'news');
      const data = await listPublishedArticles();
      return sendJson(res, 200, data);
    }

    await attachAuth(req);
    const adminKey = req.auth?.user?.id ?? clientIp(req);

    if (req.method === 'GET' && pathname === '/api/news/admin') {
      requireRole(req, canAccessAdmin);
      await checkRateLimit(`news-admin:${adminKey}`, { max: 120, windowMs: 60_000 });
      const data = await listAllArticles();
      return sendJson(res, 200, data);
    }

    if (req.method === 'POST' && pathname === '/api/news') {
      const user = requireRole(req, canAccessAdmin);
      await checkRateLimit(`news-admin-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const article = await createArticle(body, user);
      const feedVersion = await getNewsFeedVersion();
      return sendJson(res, 201, { article, feedVersion });
    }

    const patchMatch = pathname.match(/^\/api\/news\/([a-zA-Z0-9._-]+)$/);
    if (patchMatch && req.method === 'PATCH') {
      requireRole(req, canAccessAdmin);
      await checkRateLimit(`news-admin-act:${adminKey}`, { max: 30, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const article = await updateArticle(patchMatch[1], body);
      const feedVersion = await getNewsFeedVersion();
      return sendJson(res, 200, { article, feedVersion });
    }

    if (patchMatch && req.method === 'DELETE') {
      requireRole(req, canAccessAdmin);
      await checkRateLimit(`news-admin-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      await deleteArticle(patchMatch[1]);
      const feedVersion = await getNewsFeedVersion();
      return sendJson(res, 200, { ok: true, feedVersion });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    if (isRateLimitError(err)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = err instanceof Error ? err.message : 'Server error';
    const status =
      msg === 'Permission denied'
        ? 403
        : msg === 'Not logged in'
          ? 401
          : msg === 'Article not found' || msg === 'News feed unavailable'
            ? msg === 'Article not found' ? 404 : 503
            : 400;
    return sendJson(res, status, { error: msg });
  }
}

export function createNewsMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/news')) {
      return handleNewsRequest(req, res);
    }
    next();
  });
}