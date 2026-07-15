/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { attachAuth } from './auth/authApi.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { buildTerminalStats } from './terminalStatsService.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=15');
  res.end(JSON.stringify(body));
}

export async function handleTerminalStatsRequest(req, res) {
  const pathname = req.url?.split('?')[0] ?? '';
  if (req.method !== 'GET' || pathname !== '/api/terminal-stats') {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  try {
    await checkRateLimit(`terminal-stats:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
    await requireMemberTab(req, 'stats');
    await attachAuth(req);
    const includeSensitive = Boolean(req.auth?.user && canAccessAdmin(req.auth.user));
    sendJson(res, 200, await buildTerminalStats({ includeSensitive }));
  } catch (e) {
    if (isRateLimitError(e)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = e instanceof Error ? e.message : 'Server error';
    const status = msg === 'Permission denied' ? 403 : 500;
    sendJson(res, status, { error: msg });
  }
}

export function createTerminalStatsMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname === '/api/terminal-stats') {
      return handleTerminalStatsRequest(req, res);
    }
    next();
  });
}