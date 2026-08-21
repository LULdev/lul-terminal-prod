/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { respondApiError, wrapAsyncHandler } from './asyncMiddleware.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { checkRateLimit, clientIp } from './rateLimit.mjs';
import { readJsonBody } from './readJsonBody.mjs';
import { catalogPublic, parseInputUrls, resolveMany, MAX_URLS } from './bypassEngine.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function handleBypassRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/bypass/catalog') {
      await checkRateLimit(`bypass-cat:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      await requireMemberTab(req, 'bypass');
      return sendJson(res, 200, { services: catalogPublic() });
    }

    if (req.method === 'POST' && pathname === '/api/bypass') {
      await requireMemberTab(req, 'bypass');
      const userId = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`bypass:${userId}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req, 16 * 1024);
      const fromList = Array.isArray(body.urls) ? body.urls.map((u) => String(u ?? '')) : [];
      const fromSingle = body.url != null ? [String(body.url)] : [];
      const raw = [...fromList, ...fromSingle].join('\n');
      const urls = parseInputUrls(raw);
      if (!urls.length) {
        return sendJson(res, 400, { error: 'Paste at least one http(s) URL' });
      }
      const results = await resolveMany(urls.slice(0, MAX_URLS));
      return sendJson(res, 200, { results });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    return respondApiError(res, e, sendJson);
  }
}

export function createBypassMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (!pathname.startsWith('/api/bypass')) {
      next();
      return;
    }
    return handleBypassRequest(req, res);
  });
}
