/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const NEWS_LAST_READ_KEY = 'lul_news_last_read';

function normalizeFeedVersion(v: string | null | undefined): string {
  return String(v ?? '').trim().slice(0, 32);
}

export function hasUnreadNews(
  lastReadVersion: string | null | undefined,
  currentFeedVersion: string,
): boolean {
  const last = normalizeFeedVersion(lastReadVersion);
  const current = normalizeFeedVersion(currentFeedVersion);
  if (!current || current === '0.0.0') return false;
  if (!last) return true;
  return last !== current;
}

export function readLocalNewsLastVersion(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(NEWS_LAST_READ_KEY);
}

export function markLocalNewsRead(version: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NEWS_LAST_READ_KEY, version);
}