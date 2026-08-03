/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TabId } from '../config/menuItems';

export function normalizeProfileUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function parseProfileRoute(): { tab: 'profile'; username: string } | null {
  const match = window.location.pathname.match(/^\/profile\/([a-zA-Z0-9_]+)\/?$/);
  if (!match?.[1]) return null;
  const username = normalizeProfileUsername(match[1]);
  return username ? { tab: 'profile', username } : null;
}

export function profilePath(username: string): string {
  return `/profile/${encodeURIComponent(normalizeProfileUsername(username))}`;
}

export function buildProfileUrl(username: string): string {
  return `${window.location.origin}${profilePath(username)}`;
}

export function syncUrlForTab(tab: TabId, profileUsername?: string | null): void {
  if (tab === 'profile' && profileUsername) {
    const path = profilePath(profileUsername);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== path) {
      window.history.pushState(null, '', path);
    }
    return;
  }
  const next = tab === 'changelog' ? '/' : `/?tab=${encodeURIComponent(tab)}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== next) {
    window.history.pushState(null, '', next);
  }
}