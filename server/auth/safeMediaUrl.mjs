/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const GRADIENT_RE = /^(linear-gradient|radial-gradient)\([^;]{0,400}\)$/i;
const SOLID_RE = /^(#[0-9a-f]{3,8}|rgb\([^)]{0,80}\)|rgba\([^)]{0,80}\)|hsl\([^)]{0,80}\)|hsla\([^)]{0,80}\))$/i;

export function sanitizeAvatarUrl(raw) {
  const v = String(raw ?? '').trim().slice(0, 512);
  if (!v) return '';
  if (v.startsWith('/api/auth/avatars/') && !v.startsWith('//')) return v;
  try {
    const parsed = new URL(v, 'http://localhost');
    if (parsed.pathname.startsWith('/api/auth/avatars/')) return parsed.pathname;
  } catch { /* invalid */ }
  try {
    const parsed = new URL(v);
    if (parsed.protocol === 'https:' && parsed.hostname === 'api.dicebear.com') return v;
  } catch { /* invalid */ }
  return '';
}

export function sanitizeExternalUrl(raw) {
  const v = String(raw ?? '').trim().slice(0, 256);
  if (!v) return '';
  if (v.startsWith('//')) return '';
  try {
    const parsed = new URL(v.startsWith('http') ? v : `https://${v}`);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch { /* invalid */ }
  return '';
}

export function sanitizeCoverUrl(raw) {
  const v = String(raw ?? '').trim().slice(0, 512);
  if (!v) return '';
  if (GRADIENT_RE.test(v)) {
    if (/,\s*url\s*\(/i.test(v) || /\burl\s*\(/i.test(v)) return '';
    return v;
  }
  if (SOLID_RE.test(v)) return v;
  if (v.startsWith('url(')) {
    const inner = v.slice(4, -1).trim().replace(/^["']|["']$/g, '');
    if (inner.startsWith('/api/auth/avatars/') && !inner.startsWith('//')) return v;
    try {
      const parsed = new URL(inner, 'http://localhost');
      if (parsed.pathname.startsWith('/api/auth/avatars/')) return v;
    } catch { /* invalid */ }
    try {
      const parsed = new URL(inner);
      if (parsed.protocol === 'https:' && parsed.hostname === 'api.dicebear.com') return v;
    } catch { /* invalid */ }
  }
  if (v.startsWith('/api/auth/avatars/') && !v.startsWith('//')) {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `url("${escaped}")`;
  }
  return '';
}