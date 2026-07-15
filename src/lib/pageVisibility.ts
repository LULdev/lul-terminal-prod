/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TabId } from '../config/menuItems';
import { sessionFetch } from './sessionFetch';

const API = '/api/access-control';

export type PageVisibility = 'public' | 'members';

export type PageVisibilityConfig = Record<string, PageVisibility>;

export type PublicAccessControl = {
  version: number;
  updatedAt: number | null;
  /** Legacy full map — admin only; public API returns publicTabs only. */
  pages?: PageVisibilityConfig;
  publicTabs: TabId[];
};

export type AdminAccessControl = PublicAccessControl & {
  defaults: PageVisibilityConfig;
  lockedPublic: TabId[];
  lockedMembers: TabId[];
  allTabs: TabId[];
};

export async function fetchPageVisibility(): Promise<PublicAccessControl> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Could not load visibility');
  return res.json() as Promise<PublicAccessControl>;
}

export async function fetchAdminPageVisibility(): Promise<AdminAccessControl> {
  const res = await sessionFetch(`${API}/admin`);
  if (!res.ok) throw new Error('Admin visibility unavailable');
  return res.json() as Promise<AdminAccessControl>;
}

export async function updateAdminPageVisibility(pages: PageVisibilityConfig): Promise<AdminAccessControl> {
  const res = await sessionFetch(`${API}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ pages }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Save failed');
  return body as AdminAccessControl;
}

export async function resetAdminPageVisibility(): Promise<AdminAccessControl> {
  const res = await sessionFetch(`${API}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ resetDefaults: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Reset failed');
  return body as AdminAccessControl;
}