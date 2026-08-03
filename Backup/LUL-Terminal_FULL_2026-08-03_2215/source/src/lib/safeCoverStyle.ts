/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties } from 'react';

const DEFAULT_COVER = 'linear-gradient(135deg,#0f172a,#1e293b,#020617)';
const GRADIENT_RE = /^(linear-gradient|radial-gradient)\([^;]{0,400}\)$/i;
const SOLID_RE = /^(#[0-9a-f]{3,8}|rgb\([^)]{0,80}\)|rgba\([^)]{0,80}\)|hsl\([^)]{0,80}\)|hsla\([^)]{0,80}\))$/i;

function isAllowedUrl(inner: string): boolean {
  const v = inner.trim().replace(/^["']|["']$/g, '');
  if (v.startsWith('/api/auth/avatars/') && !v.startsWith('//')) return true;
  try {
    const parsed = new URL(v, 'http://localhost');
    if (parsed.pathname.startsWith('/api/auth/avatars/')) return true;
  } catch { /* invalid */ }
  try {
    const parsed = new URL(v);
    return parsed.protocol === 'https:' && parsed.hostname === 'api.dicebear.com';
  } catch { /* invalid */ }
  return false;
}

export function safeCoverStyle(coverUrl: string | undefined): CSSProperties {
  const v = String(coverUrl ?? '').trim().slice(0, 512);
  if (!v) return { background: DEFAULT_COVER };

  if (GRADIENT_RE.test(v)) {
    if (/,\s*url\s*\(/i.test(v) || /\burl\s*\(/i.test(v)) {
      return { background: DEFAULT_COVER };
    }
    return { background: v };
  }

  if (v.startsWith('url(')) {
    const inner = v.slice(4, -1).trim();
    if (isAllowedUrl(inner)) {
      return { backgroundImage: v, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    return { background: DEFAULT_COVER };
  }

  if (SOLID_RE.test(v)) return { background: v };

  if (v.startsWith('/api/auth/avatars/') && !v.startsWith('//')) {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return {
      backgroundImage: `url("${escaped}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  return { background: DEFAULT_COVER };
}