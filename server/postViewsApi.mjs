/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth, requireAuth } from './auth/authApi.mjs';
import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { changelogVersionExists } from './changelogMeta.mjs';
import { getArticleById } from './newsStore.mjs';
import { ensureActivity } from './auth/achievements.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { getAllPostViews, recordPostView, sanitizePostId } from './postViewsStore.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = 4096) {
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

export async function handlePostViewsRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/post-views') {
      await checkRateLimit(`post-views-read:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      await attachAuth(req);
      requireAuth(req);
      await requireMemberTab(req, 'stats');
      return sendJson(res, 200, await getAllPostViews());
    }

    if (req.method === 'POST' && pathname === '/api/post-views/view') {
      await checkRateLimit(`post-view:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const type = String(body.type ?? '').trim();
      const rawId = String(body.id ?? '').trim();
      const id = sanitizePostId(rawId);
      if (!id || (type !== 'changelog' && type !== 'news')) {
        return sendJson(res, 400, { error: 'type (changelog|news) and id required' });
      }
      await attachAuth(req);
      const viewer = requireAuth(req);
      const bucket = type === 'news' ? 'news' : 'changelog';
      await requireMemberTab(req, bucket);
      if (bucket === 'news') {
        const article = await getArticleById(id);
        if (!article) return sendJson(res, 404, { error: 'Article not found' });
      } else if (!(await changelogVersionExists(id))) {
        return sendJson(res, 404, { error: 'Changelog entry not found' });
      }
      const flagKey = `post_view_${bucket}_${id}`;

      const result = await runCoinTransaction(async () => {
        const db = await loadUsersDb();
        const viewerUser = db.users.find((u) => u.id === viewer.id);
        if (!viewerUser) throw new Error('User not found');
        const act = ensureActivity(viewerUser);
        if (act.flags[flagKey]) {
          const all = await getAllPostViews();
          return {
            type: bucket,
            id,
            views: Math.max(0, Number(all[bucket]?.[id]) || 0),
            deduped: true,
          };
        }
        act.flags[flagKey] = true;
        viewerUser.updatedAt = Date.now();
        await saveUsersDb(db);
        try {
          const recorded = await recordPostView(type, id);
          if (!recorded) throw new Error('Invalid id');
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