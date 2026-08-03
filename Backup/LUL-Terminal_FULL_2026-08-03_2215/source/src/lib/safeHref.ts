/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function safeHref(href: string | undefined): string | null {
  const raw = String(href ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch { /* invalid */ }
  return null;
}