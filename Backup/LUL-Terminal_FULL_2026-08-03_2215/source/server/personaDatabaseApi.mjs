/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { getPersonaStats, listCountries, pickRandomEntry } from './personaDatabaseStore.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function handlePersonaDatabaseRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/persona-db/stats') {
      await checkRateLimit(`persona-db:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      await requireMemberTab(req, 'identity');
      return sendJson(res, 200, await getPersonaStats());
    }

    if (req.method === 'GET' && pathname === '/api/persona-db/countries') {
      await checkRateLimit(`persona-db:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      await requireMemberTab(req, 'identity');
      return sendJson(res, 200, { countries: await listCountries() });
    }

    if (req.method === 'GET' && pathname === '/api/persona-db/random') {
      await checkRateLimit(`persona-db:${clientIp(req)}`, { max: 40, windowMs: 60_000 });
      await requireMemberTab(req, 'identity');
      const country = url.searchParams.get('country')?.trim() || undefined;
      const entry = await pickRandomEntry(country);
      if (!entry) {
        return sendJson(res, 404, { error: country ? `No addresses for ${country}` : 'Database empty' });
      }
      return sendJson(res, 200, { entry });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    if (isRateLimitError(e)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = e instanceof Error ? e.message : 'Server error';
    const status =
      msg === 'Permission denied' ? 403
        : msg === 'Not logged in' ? 401
          : 500;
    return sendJson(res, status, { error: msg });
  }
}

export function createPersonaDatabaseMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (!pathname.startsWith('/api/persona-db')) {
      next();
      return;
    }
    return handlePersonaDatabaseRequest(req, res);
  });
}