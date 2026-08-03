/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Parse Retry-After header (seconds or HTTP-date) into milliseconds. */
export function parseRetryAfterMs(header: string | null, fallback = 60_000): number {
  if (!header) return fallback;
  const sec = Number(header);
  if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
  const until = Date.parse(header);
  if (Number.isFinite(until)) return Math.max(0, until - Date.now());
  return fallback;
}