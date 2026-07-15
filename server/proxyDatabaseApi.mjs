/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth, requireRole } from './auth/authApi.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import {
  getDatabaseStats,
  getProxiesGrouped,
  runDailyCheck,
} from './proxyDatabaseService.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
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

export async function handleProxyDatabaseRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/proxy-db/stats') {
      await checkRateLimit(`proxy-db:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      await requireMemberTab(req, 'proxydatabase');
      const stats = await getDatabaseStats();
      return sendJson(res, 200, stats);
    }

    if (req.method === 'GET' && pathname === '/api/proxy-db/lists') {
      await checkRateLimit(`proxy-db:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      await requireMemberTab(req, 'proxydatabase');
      const status = url.searchParams.get('status') ?? 'all';
      const type = url.searchParams.get('type') ?? '';
      const data = await getProxiesGrouped({
        status: status === 'all' ? undefined : status,
        type: type || undefined,
      });
      return sendJson(res, 200, data);
    }

    if (req.method === 'POST' && pathname === '/api/proxy-db/daily-check') {
      await attachAuth(req);
      requireRole(req, canAccessAdmin);
      const adminKey = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`proxy-db-check:${adminKey}`, { max: 10, windowMs: 60_000 });
      const body = await readJsonBody(req).catch(() => ({}));
      const rawConcurrency = Number(body.concurrency);
      const concurrency = Number.isFinite(rawConcurrency)
        ? Math.min(Math.max(Math.round(rawConcurrency), 1), 500)
        : undefined;
      const result = await runDailyCheck({
        force: Boolean(body.force),
        timeoutMs: body.timeoutMs,
        concurrency,
      });
      return sendJson(res, 200, result);
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    if (isRateLimitError(e)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = e instanceof Error ? e.message : 'Server error';
    const status =
      e instanceof SyntaxError ? 400
        : msg === 'Permission denied' ? 403
        : msg === 'Not logged in' ? 401
        : 500;
    sendJson(res, status, { error: msg });
  }
}

export function createProxyDatabaseMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/proxy-db')) {
      return handleProxyDatabaseRequest(req, res);
    }
    next();
  });
}