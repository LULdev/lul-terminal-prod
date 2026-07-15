/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const PASTE_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/;

export function safePasteAssetUrl(url: string | undefined): string | null {
  const raw = String(url ?? '').trim();
  if (raw.startsWith('/api/paste/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/paste/')) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch { /* invalid */ }
  return null;
}

/** Same-origin paste preview page URL (/p/:id) only. */
export function safePastePageUrl(url: string | undefined, fallbackId?: string): string | null {
  const id = String(fallbackId ?? '').trim();
  if (id && PASTE_ID_RE.test(id)) {
    return `${window.location.origin}/p/${id}`;
  }
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    const match = parsed.pathname.match(/^\/p\/([^/]+)$/);
    if (match?.[1] && PASTE_ID_RE.test(match[1])) {
      return `${parsed.origin}/p/${match[1]}`;
    }
  } catch { /* invalid */ }
  return null;
}