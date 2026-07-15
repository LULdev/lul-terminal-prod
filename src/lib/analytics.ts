/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionJson } from './sessionFetch';

const API = '/api/analytics';

export type AnalyticsEventType =
  | 'session_start'
  | 'session_end'
  | 'tab_visit'
  | 'tab_dwell'
  | 'profile_view'
  | 'command_run'
  | 'login'
  | 'logout'
  | 'faq_visit'
  | 'search'
  | 'feature_use';

export type VisitorKeyCount = { key: string; count: number };

export type RecentVisitorRow = {
  key: string;
  username: string | null;
  userId: string | null;
  guestId: string | null;
  visitCount: number;
  sessionCount: number;
  returnVisitor: boolean;
  lastReferrerDomain: string;
  lastReferrer: string;
  lastLandingPath: string;
  lastLandingUrl: string;
  deviceType: string;
  language: string;
  timezone: string;
  lastSeenAt: number;
  firstSeenAt: number;
  utmSource: string;
  refCode: string;
};

export type VisitorIntelligence = {
  totalProfiles: number;
  activeLast24h: number;
  returnVisitorCount: number;
  newVisitorCount: number;
  avgVisitsPerVisitor: number;
  returnVisits: number;
  newVisits: number;
  recentVisitors: RecentVisitorRow[];
  referrerDomains: VisitorKeyCount[];
  referrerTypes: VisitorKeyCount[];
  devices: VisitorKeyCount[];
  languages: VisitorKeyCount[];
  timezones: VisitorKeyCount[];
  connections: VisitorKeyCount[];
  colorSchemes: VisitorKeyCount[];
  platforms: VisitorKeyCount[];
  landingPaths: VisitorKeyCount[];
  utmSources: VisitorKeyCount[];
  utmMediums: VisitorKeyCount[];
  utmCampaigns: VisitorKeyCount[];
  dwellByTab: { tab: string; avgSec: number; totalSec: number; visits: number }[];
};

export type UserVisitorInsights = {
  sessionCount: number;
  maxVisitCount: number;
  lastSession: Record<string, unknown> | null;
  referrerDomains: VisitorKeyCount[];
  referrers: VisitorKeyCount[];
  devices: VisitorKeyCount[];
  landingPaths: VisitorKeyCount[];
};

export type UserActivityInsights = {
  tabBreakdown: { tab: string; count: number }[];
  eventBreakdown: { type: string; count: number }[];
  sessionCount: number;
  totalEvents: number;
  firstEventAt: number | null;
  lastEventAt: number | null;
  recentCommands: { cmd: string; ts: number }[];
  profileTargets: { target: string; count: number }[];
  visitor?: UserVisitorInsights;
  visitorProfile?: Record<string, unknown> | null;
};

export type UserActivitySummary = {
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    role: string;
    active: boolean;
    verified: boolean;
    createdAt: number | null;
    lastLoginAt: number | null;
    onlineMinutes: number;
    profileViews: number;
    imagesUploaded: number;
    memesCreated: number;
    pastesCreated: number;
    pasteViewsTotal: number;
    referralsCount: number;
    website: string | null;
    isOnline: boolean;
    lastSeenAt: number | null;
    activity: {
      loginCount: number;
      commandsRun: number;
      pageVisits: number;
      profileVisits: number;
      shoutboxSent: number;
      changelogReads: number;
      changelogLastReadVersion: string | null;
      newsReads: number;
      newsLastReadVersion: string | null;
      tabsVisited: string[];
      flags: Record<string, boolean>;
    };
    achievements: number;
    achievementIds: string[];
  };
  recentEvents: AnalyticsEvent[];
  insights?: UserActivityInsights;
};

export type AnalyticsEvent = {
  id: string;
  type: string;
  userId: string | null;
  username: string | null;
  guestId?: string | null;
  sessionId?: string | null;
  tab: string | null;
  meta: Record<string, unknown>;
  ts: number;
};

export type ActiveTodayUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  verified: boolean;
  isOnline: boolean;
  lastSeenAt: number | null;
};

export type ActiveTodayResponse = {
  date: string;
  count: number;
  onlineNow: number;
  users: ActiveTodayUser[];
};

export type AdminOverview = {
  generatedAt: number;
  disclaimer: string;
  totals: {
    users: number;
    onlineNow: number;
    newUsersWeek: number;
    activeToday: number;
    eventsStored: number;
  };
  engagement: {
    totalPageVisits: number;
    totalCommands: number;
    totalShoutbox: number;
    totalOnlineMinutes: number;
    changelogViews: number;
    newsViews: number;
  };
  system: {
    proxyPool: number;
    proxySourcesOk: number;
    proxySourcesFailed: number;
    lastProxyCheck: number | null;
    proxyAlive: number;
  };
  tabHits: { tab: string; count: number }[];
  eventCounts: { type: string; count: number }[];
  dailySeries: { date: string; events: number; uniqueUsers: number; logins: number; tabVisits: number }[];
  onlineUsers: { id: string; username: string; displayName: string; role: string; lastSeenAt: number }[];
  recentEvents: AnalyticsEvent[];
  leaderboard: UserActivitySummary['user'][];
  onlineWindowMs: number;
  visitorIntelligence: VisitorIntelligence;
};

/** Analytics track — soft 401 (no global session invalidation). */
export async function trackEvent(
  type: AnalyticsEventType,
  opts: { tab?: string; meta?: Record<string, unknown> } = {},
) {
  try {
    const res = await fetch(`${API}/track`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        tab: opts.tab,
        meta: opts.meta,
      }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json() as {
      ok?: boolean;
      user?: import('../types/auth').AuthUser | null;
      proof?: import('./achievementProof').AchievementProof | null;
      eventId?: string | null;
    };
    return { ...data, ok: data.ok !== false };
  } catch {
    return { ok: false };
  }
}

export async function fetchMyActivity(): Promise<UserActivitySummary> {
  return sessionJson<UserActivitySummary>(`${API}/me`);
}

export async function fetchActiveTodayUsers(limit = 48): Promise<ActiveTodayResponse> {
  const q = new URLSearchParams({ limit: String(limit) });
  return sessionJson<ActiveTodayResponse>(`${API}/active-today?${q}`);
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return sessionJson<AdminOverview>(`${API}/admin/overview`);
}

export async function fetchAdminUserActivity(search = '', limit = 100) {
  const q = new URLSearchParams();
  if (search) q.set('search', search);
  q.set('limit', String(limit));
  return sessionJson<{ users: UserActivitySummary['user'][]; total: number }>(`${API}/admin/users?${q}`);
}

export async function fetchAdminUserDetail(userId: string): Promise<UserActivitySummary> {
  return sessionJson<UserActivitySummary>(`${API}/admin/users/${encodeURIComponent(userId)}`);
}

export async function exportAdminAnalytics() {
  return sessionJson(`${API}/admin/export`);
}

export async function purgeAnalyticsEvents(keep = 2000) {
  return sessionJson<{ before: number; after: number; removed: number }>(`${API}/admin/purge`, {
    method: 'POST',
    body: JSON.stringify({ keep }),
  });
}

export function formatRelativeTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(ts).toLocaleString('en-US');
}

export function formatAnalyticsDate(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const META_PRIORITY = [
  'referrerDomain', 'referrerType', 'visitCount', 'returnVisitor', 'landingPath',
  'deviceType', 'language', 'utmSource', 'refCode', 'dwellSec', 'target', 'cmd',
];

export function formatEventMeta(meta: Record<string, unknown>): string {
  const entries = Object.entries(meta ?? {});
  const sorted = [
    ...entries.filter(([k]) => META_PRIORITY.includes(k)).sort(
      (a, b) => META_PRIORITY.indexOf(a[0]) - META_PRIORITY.indexOf(b[0]),
    ),
    ...entries.filter(([k]) => !META_PRIORITY.includes(k)),
  ];
  const parts = sorted
    .slice(0, 5)
    .map(([k, v]) => `${k}=${String(v)}`);
  return parts.join(' · ') || '';
}