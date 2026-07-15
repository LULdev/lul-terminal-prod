/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { APP_VERSION } from '../config/version';

export const CHANGELOG_LAST_READ_KEY = 'lul_changelog_last_read';

export function hasUnreadChangelog(lastReadVersion: string | null | undefined): boolean {
  const last = lastReadVersion?.trim();
  if (!last) return true;
  return last !== APP_VERSION;
}

export function readLocalChangelogLastVersion(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CHANGELOG_LAST_READ_KEY);
}

export function markLocalChangelogRead(version: string = APP_VERSION) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CHANGELOG_LAST_READ_KEY, version);
}