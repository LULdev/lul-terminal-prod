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
  const lower = msg.toLowerCase();
  if (isRateLimitError(e) || msg === 'Too many requests' || lower.includes('too many requests')) return 429;
  // Auth — exact + "You must be logged in…" variants used across chat/tabs
  if (
    msg === 'Not logged in'
    || msg === 'Invalid login credentials'
    || lower.includes('not logged in')
    || lower.includes('must be logged in')
    || lower.includes('sign in')
  ) {
    return 401;
  }
  // Authorization
  if (
    msg === 'Permission denied'
    || msg === 'Not allowed'
    || msg === 'Admin only'
    || lower.includes('permission')
    || lower.includes('forbidden')
    || lower.includes('admin only')
    || lower.includes('vip')
    || lower.includes('verification required')
  ) {
    return 403;
  }
  if (msg === 'Invalid JSON' || e instanceof SyntaxError) return 400;
  if (msg === 'Payload too large' || msg.startsWith('Payload too large') || lower.includes('too large')) return 413;
  // Proof/session expiry are client-actionable 400/401 — not resource 404
  if (msg.includes('proof expired') || msg.includes('Achievement proof')) return 400;
  if (/\bsession\b/i.test(msg) && /expired/i.test(msg)) return 401;
  // Transient lock contention — client should retry, not treat as hard 500
  if (lower.includes('file lock timeout') || lower.includes('lock timeout')) return 503;
  if (/\bnot found\b/i.test(msg)) return 404;
  // Match/paste content expiry (resource gone), not auth/proof
  if (msg.includes('not found or expired') || msg.includes('Match expired') || msg.includes('queue expired')) {
    return 404;
  }
  // Common validation messages (avoid 500 noise for client-fixable input)
  if (
    lower.includes('invalid')
    || lower.includes('required')
    || lower.includes('usage:')
    || lower.includes('cannot ')
    || lower.includes('too long')
    || lower.includes('empty')
    || lower.includes('min.')
    || lower.includes('max ')
  ) {
    return 400;
  }
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
