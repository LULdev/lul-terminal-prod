/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getRateLimitBackend, incrementRateLimit } from './rateLimitStore.mjs';

const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

const TRUSTED_PROXY_IPS = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? '127.0.0.1,::1,::ffff:127.0.0.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

if (process.env.NODE_ENV === 'production' && !TRUST_PROXY) {
  console.warn('[rate-limit] TRUST_PROXY is not set — clientIp uses socket address only (set TRUST_PROXY=1 behind a reverse proxy)');
}

const backend = getRateLimitBackend();
if (backend !== 'memory') {
  console.info(`[rate-limit] Using ${backend} backend for shared limits`);
}

function isTrustedProxyHop(remote) {
  if (!remote) return false;
  return TRUSTED_PROXY_IPS.has(remote);
}

export function clientIp(req) {
  const remote = req.socket?.remoteAddress ?? 'unknown';
  if (TRUST_PROXY && isTrustedProxyHop(remote)) {
    const real = req.headers?.['x-real-ip'];
    if (real) return String(real).split(',')[0].trim();
    const fwd = req.headers?.['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return remote;
}

/** Sliding-window rate limiter (memory, file, or Redis backend). */
export async function checkRateLimit(key, { max = 30, windowMs = 60_000 } = {}) {
  const ok = await incrementRateLimit(key, { max, windowMs });
  if (!ok) {
    const err = new Error('Too many requests');
    err.code = 'RATE_LIMIT';
    err.retryAfterMs = windowMs;
    throw err;
  }
}

export function isRateLimitError(err) {
  return err?.code === 'RATE_LIMIT' || err?.message === 'Too many requests';
}

export function applyRateLimitHeaders(res, err) {
  const ms = Number(err?.retryAfterMs) || 60_000;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(ms / 1000))));
}