/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TabId } from '../config/menuItems';
import { sessionFetch } from './sessionFetch';

const API = '/api/access-control';

export type PageVisibility = 'public' | 'members';

export type PageVisibilityConfig = Record<string, PageVisibility>;

export type SiteUiConfig = {
  /** Right diagnostics / shoutbox pane (dashboard-right-pane) */
  showDiagnosticsPane: boolean;
};

export const DEFAULT_SITE_UI: SiteUiConfig = {
  showDiagnosticsPane: true,
};

export type PublicAccessControl = {
  version: number;
  updatedAt: number | null;
  /** Legacy full map — admin only; public API returns publicTabs only. */
  pages?: PageVisibilityConfig;
  publicTabs: TabId[];
  ui?: SiteUiConfig;
};

export type AdminAccessControl = PublicAccessControl & {
  defaults: PageVisibilityConfig;
  defaultUi?: SiteUiConfig;
  lockedPublic: TabId[];
  lockedMembers: TabId[];
  allTabs: TabId[];
  ui: SiteUiConfig;
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

export async function updateAdminPageVisibility(
  pages: PageVisibilityConfig,
  ui?: Partial<SiteUiConfig>,
): Promise<AdminAccessControl> {
  const body: { pages: PageVisibilityConfig; ui?: Partial<SiteUiConfig> } = { pages };
  if (ui) body.ui = ui;
  const res = await sessionFetch(`${API}/admin`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data as AdminAccessControl;
}

export async function resetAdminPageVisibility(): Promise<AdminAccessControl> {
  const res = await sessionFetch(`${API}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ resetDefaults: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Reset failed');
  return data as AdminAccessControl;
}
