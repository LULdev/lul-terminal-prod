/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function avatarFallback(username: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
}

export function safeAvatarUrl(url: string | undefined, username: string): string {
  const raw = String(url ?? '').trim();
  if (raw.startsWith('/api/auth/avatars/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw, 'http://localhost');
    if (parsed.pathname.startsWith('/api/auth/avatars/')) return parsed.pathname;
  } catch { /* invalid */ }
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:' && parsed.hostname === 'api.dicebear.com') return raw;
    } catch { /* invalid */ }
  }
  return avatarFallback(username);
}