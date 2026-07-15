/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { getLeaderboardsWithSync } from './leaderboardService.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.end(JSON.stringify(body));
}

export async function handleLeaderboardRequest(req, res) {
  const pathname = req.url?.split('?')[0] ?? '';
  if (req.method !== 'GET' || pathname !== '/api/leaderboards') {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  try {
    await checkRateLimit(`leaderboards:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
    await requireMemberTab(req, 'leaderboard');
    const data = await getLeaderboardsWithSync();
    sendJson(res, 200, data);
  } catch (e) {
    if (isRateLimitError(e)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = e instanceof Error ? e.message : 'Server error';
    const status = msg === 'Permission denied' ? 403 : msg === 'Not logged in' ? 401 : 500;
    sendJson(res, status, { error: msg });
  }
}

export function createLeaderboardMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname === '/api/leaderboards') {
      return handleLeaderboardRequest(req, res);
    }
    next();
  });
}