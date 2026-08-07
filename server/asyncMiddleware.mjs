/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyRateLimitHeaders, isRateLimitError } from './rateLimit.mjs';

/**
 * Map thrown errors to HTTP status. Honors err.statusCode first (readJsonBody, rate limit).
 * Shared by wrapAsyncHandler and API catch blocks that must not 500 Invalid JSON / 429.
 */
export function statusForError(e) {
  const code = Number(e?.statusCode);
  if (Number.isFinite(code) && code >= 400 && code < 600) return code;
  const msg = e instanceof Error ? e.message : 'Server error';
  if (isRateLimitError(e) || msg === 'Too many requests') return 429;
  if (msg === 'Permission denied' || msg === 'Not allowed') return 403;
  if (msg === 'Not logged in' || msg === 'Invalid login credentials') return 401;
  if (msg === 'Invalid JSON' || e instanceof SyntaxError) return 400;
  if (msg === 'Payload too large' || msg.startsWith('Payload too large')) return 413;
  if (/\bnot found\b/i.test(msg) || msg.includes('expired')) return 404;
  return 500;
}

/** Wrap async API handlers so unexpected rejections return JSON errors instead of hanging. */
export function wrapAsyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((e) => {
      if (res.headersSent) return;
      const msg = e instanceof Error ? e.message : 'Server error';
      const status = statusForError(e);
      if (status === 429 || isRateLimitError(e)) {
        applyRateLimitHeaders(res, e);
      }
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: msg }));
    });
  };
}
