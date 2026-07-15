/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const HOSTED_ID_RE = /^[a-f0-9]{16}$/;

function isSameOriginHostedPath(pathname: string, kind: 'direct' | 'view'): boolean {
  const re = kind === 'direct' ? /^\/hosting\/[a-f0-9]{16}$/ : /^\/i\/[a-f0-9]{16}$/;
  return re.test(pathname);
}

export function safeHostedImageUrl(url: string | undefined, id?: string): string | null {
  const fallbackId = String(id ?? '').trim();
  if (HOSTED_ID_RE.test(fallbackId)) {
    return `${window.location.origin}/hosting/${fallbackId}`;
  }
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    if (isSameOriginHostedPath(parsed.pathname, 'direct')) return parsed.toString();
    const apiMatch = parsed.pathname.match(/^\/api\/images\/([a-f0-9]{16})$/);
    if (apiMatch) return `${parsed.origin}/hosting/${apiMatch[1]}`;
  } catch { /* invalid */ }
  return null;
}

export function safeHostedViewUrl(url: string | undefined, id?: string): string | null {
  const fallbackId = String(id ?? '').trim();
  if (HOSTED_ID_RE.test(fallbackId)) {
    return `${window.location.origin}/i/${fallbackId}`;
  }
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    if (isSameOriginHostedPath(parsed.pathname, 'view')) return parsed.toString();
  } catch { /* invalid */ }
  return null;
}