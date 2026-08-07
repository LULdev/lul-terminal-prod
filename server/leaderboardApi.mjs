/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { respondApiError, wrapAsyncHandler } from './asyncMiddleware.mjs';
import { getLeaderboardsWithSync } from './leaderboardService.mjs';
import { checkRateLimit, clientIp } from './rateLimit.mjs';

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
    // Public leaderboards — no login required for guests
    await checkRateLimit(`leaderboards:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
    const data = await getLeaderboardsWithSync();
    sendJson(res, 200, data);
  } catch (e) {
    return respondApiError(res, e, sendJson);
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