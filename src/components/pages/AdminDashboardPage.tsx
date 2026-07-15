/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useCallback, useState } from 'react';
import { PageShell } from './PageShell';
import { VipGate } from '../auth/VipGate';
import {
  AdminShell,
  AdminPanelSkeleton,
  ADMIN_TABS,
  type AdminTabId,
} from '../admin/AdminShell';

const STORAGE_KEY = 'lul_admin_tab';

const AdminOverviewPanel = React.lazy(() =>
  import('../admin/AdminOverviewPanel').then((m) => ({ default: m.AdminOverviewPanel })),
);
const AdminAnalyticsPanel = React.lazy(() =>
  import('../admin/AdminAnalyticsPanel').then((m) => ({ default: m.AdminAnalyticsPanel })),
);
const AdminPageVisibilityPanel = React.lazy(() =>
  import('../admin/AdminPageVisibilityPanel').then((m) => ({ default: m.AdminPageVisibilityPanel })),
);
const AdminProxyPipeline = React.lazy(() =>
  import('../admin/AdminProxyPipeline').then((m) => ({ default: m.AdminProxyPipeline })),
);
const AdminXmlLinkScraperPanel = React.lazy(() =>
  import('../admin/AdminXmlLinkScraperPanel').then((m) => ({ default: m.AdminXmlLinkScraperPanel })),
);
const AdminNewsPanel = React.lazy(() =>
  import('../admin/AdminNewsPanel').then((m) => ({ default: m.AdminNewsPanel })),
);
const AdminModerationPanel = React.lazy(() =>
  import('../admin/AdminModerationPanel').then((m) => ({ default: m.AdminModerationPanel })),
);
const AdminUsersPanel = React.lazy(() =>
  import('../admin/AdminUsersPanel').then((m) => ({ default: m.AdminUsersPanel })),
);
const AdminPastesPanel = React.lazy(() =>
  import('../admin/AdminPastesPanel').then((m) => ({ default: m.AdminPastesPanel })),
);
const AdminSystemPulsePanel = React.lazy(() =>
  import('../admin/AdminSystemPulsePanel').then((m) => ({ default: m.AdminSystemPulsePanel })),
);
const AdminColonDbPanel = React.lazy(() =>
  import('../admin/AdminColonDbPanel').then((m) => ({ default: m.AdminColonDbPanel })),
);
const AdminShoutboxPanel = React.lazy(() =>
  import('../admin/AdminShoutboxPanel').then((m) => ({ default: m.AdminShoutboxPanel })),
);
const AdminEmotesPanel = React.lazy(() =>
  import('../admin/AdminEmotesPanel').then((m) => ({ default: m.AdminEmotesPanel })),
);
const AdminImagesPanel = React.lazy(() =>
  import('../admin/AdminImagesPanel').then((m) => ({ default: m.AdminImagesPanel })),
);
const AdminContentPanel = React.lazy(() =>
  import('../admin/AdminContentPanel').then((m) => ({ default: m.AdminContentPanel })),
);
const AdminLeaderboardsPanel = React.lazy(() =>
  import('../admin/AdminLeaderboardsPanel').then((m) => ({ default: m.AdminLeaderboardsPanel })),
);
const AdminPersonaPanel = React.lazy(() =>
  import('../admin/AdminPersonaPanel').then((m) => ({ default: m.AdminPersonaPanel })),
);
const AdminVaultPanel = React.lazy(() =>
  import('../admin/AdminVaultPanel').then((m) => ({ default: m.AdminVaultPanel })),
);
const AdminProxyDbPanel = React.lazy(() =>
  import('../admin/AdminProxyDbPanel').then((m) => ({ default: m.AdminProxyDbPanel })),
);
const AdminVisitorsPanel = React.lazy(() =>
  import('../admin/AdminVisitorsPanel').then((m) => ({ default: m.AdminVisitorsPanel })),
);
const AdminReferralsPanel = React.lazy(() =>
  import('../admin/AdminReferralsPanel').then((m) => ({ default: m.AdminReferralsPanel })),
);
const AdminEventsPanel = React.lazy(() =>
  import('../admin/AdminEventsPanel').then((m) => ({ default: m.AdminEventsPanel })),
);
const AdminOnlinePanel = React.lazy(() =>
  import('../admin/AdminOnlinePanel').then((m) => ({ default: m.AdminOnlinePanel })),
);
const AdminHeatmapPanel = React.lazy(() =>
  import('../admin/AdminHeatmapPanel').then((m) => ({ default: m.AdminHeatmapPanel })),
);
const AdminAchievementsPanel = React.lazy(() =>
  import('../admin/AdminAchievementsPanel').then((m) => ({ default: m.AdminAchievementsPanel })),
);
const AdminScraperPoolPanel = React.lazy(() =>
  import('../admin/AdminScraperPoolPanel').then((m) => ({ default: m.AdminScraperPoolPanel })),
);
const AdminCheckerPanel = React.lazy(() =>
  import('../admin/AdminCheckerPanel').then((m) => ({ default: m.AdminCheckerPanel })),
);
const AdminReportsPanel = React.lazy(() =>
  import('../admin/AdminReportsPanel').then((m) => ({ default: m.AdminReportsPanel })),
);
const AdminChangelogPanel = React.lazy(() =>
  import('../admin/AdminChangelogPanel').then((m) => ({ default: m.AdminChangelogPanel })),
);
const AdminAvatarsPanel = React.lazy(() =>
  import('../admin/AdminAvatarsPanel').then((m) => ({ default: m.AdminAvatarsPanel })),
);
const AdminStoragePanel = React.lazy(() =>
  import('../admin/AdminStoragePanel').then((m) => ({ default: m.AdminStoragePanel })),
);
const AdminSetupNotesPanel = React.lazy(() =>
  import('../admin/AdminSetupNotesPanel').then((m) => ({ default: m.AdminSetupNotesPanel })),
);

function readStoredTab(): AdminTabId {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw && ADMIN_TABS.some((t) => t.id === raw)) return raw as AdminTabId;
  } catch { /* ignore */ }
  return 'overview';
}

function ActivePanel({ tab, onNavigate }: { tab: AdminTabId; onNavigate: (id: AdminTabId) => void }) {
  switch (tab) {
    case 'overview':
      return <AdminOverviewPanel onNavigate={onNavigate} />;
    case 'analytics':
      return <AdminAnalyticsPanel />;
    case 'visibility':
      return <AdminPageVisibilityPanel />;
    case 'proxy':
      return <AdminProxyPipeline />;
    case 'scraper':
      return <AdminXmlLinkScraperPanel />;
    case 'pastes':
      return <AdminPastesPanel />;
    case 'news':
      return <AdminNewsPanel />;
    case 'moderation':
      return <AdminModerationPanel />;
    case 'users':
      return <AdminUsersPanel />;
    case 'pulse':
      return <AdminSystemPulsePanel />;
    case 'colon-db':
      return <AdminColonDbPanel />;
    case 'shoutbox':
      return <AdminShoutboxPanel />;
    case 'emotes':
      return <AdminEmotesPanel />;
    case 'images':
      return <AdminImagesPanel />;
    case 'content':
      return <AdminContentPanel />;
    case 'leaderboards':
      return <AdminLeaderboardsPanel />;
    case 'persona':
      return <AdminPersonaPanel />;
    case 'vault':
      return <AdminVaultPanel />;
    case 'proxy-db':
      return <AdminProxyDbPanel />;
    case 'visitors':
      return <AdminVisitorsPanel />;
    case 'referrals':
      return <AdminReferralsPanel />;
    case 'events':
      return <AdminEventsPanel />;
    case 'online':
      return <AdminOnlinePanel />;
    case 'heatmap':
      return <AdminHeatmapPanel />;
    case 'achievements':
      return <AdminAchievementsPanel />;
    case 'scraper-pool':
      return <AdminScraperPoolPanel />;
    case 'checker':
      return <AdminCheckerPanel />;
    case 'reports':
      return <AdminReportsPanel />;
    case 'changelog':
      return <AdminChangelogPanel />;
    case 'avatars':
      return <AdminAvatarsPanel />;
    case 'storage':
      return <AdminStoragePanel />;
    case 'setup-notes':
      return <AdminSetupNotesPanel />;
    default:
      return <AdminOverviewPanel onNavigate={onNavigate} />;
  }
}

function AdminDashboardContent() {
  const [tab, setTab] = useState<AdminTabId>(readStoredTab);
  const [search, setSearch] = useState('');
  const activeDef = ADMIN_TABS.find((t) => t.id === tab) ?? ADMIN_TABS[0];

  const setTabPersist = useCallback((id: AdminTabId) => {
    setTab(id);
    setSearch('');
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
    } catch { /* ignore */ }
  }, []);

  return (
    <PageShell
      id="admin-module"
      pageId="admin"
      icon="🛡️"
      title="Admin Dashboard"
      subtitle={activeDef.desc}
      accentClass="text-violet-400"
      contentClassName="!overflow-hidden flex flex-col"
    >
      <AdminShell active={tab} onChange={setTabPersist} search={search} onSearch={setSearch}>
        <Suspense fallback={<AdminPanelSkeleton label={activeDef.shortLabel} />}>
          <ActivePanel tab={tab} onNavigate={setTabPersist} />
        </Suspense>
      </AdminShell>
    </PageShell>
  );
}

export function AdminDashboardPage() {
  return (
    <VipGate minRole="admin" title="Admin area" description="Only administrators have access to the user dashboard.">
      <AdminDashboardContent />
    </VipGate>
  );
}