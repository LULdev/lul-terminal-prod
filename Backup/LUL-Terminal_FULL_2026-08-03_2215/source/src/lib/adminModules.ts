/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TerminalStats } from './terminalStats';
import { fetchTerminalStats } from './terminalStats';
import type { LeaderboardsResponse } from './leaderboards';
import { fetchLeaderboards } from './leaderboards';
import type { ChatSegment } from './chat';

import { sessionFetch, sessionJson } from './sessionFetch';

const API = '/api/admin';

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await sessionFetch(`${API}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Request failed');
  }
  return data as T;
}

export type ColonDbEntry = {
  id: string;
  U: string;
  P: string;
  Website: string;
  sourceValue?: string;
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  seenCount?: number;
};

export type ColonDbStats = {
  total: number;
  updatedAt: string | null;
  websites: number;
  byWebsite: Record<string, number>;
};

export async function fetchColonDbStats(): Promise<ColonDbStats> {
  return sessionJson<ColonDbStats>('/api/xml-scraper/colon-db/stats');
}

export async function fetchColonDbEntries(opts?: {
  limit?: number;
  website?: string;
  q?: string;
}): Promise<{ entries: ColonDbEntry[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.website) params.set('website', opts.website);
  if (opts?.q) params.set('q', opts.q);
  const qs = params.toString();
  return sessionJson<{ entries: ColonDbEntry[]; total: number }>(
    `/api/xml-scraper/colon-db/entries${qs ? `?${qs}` : ''}`,
  );
}

export async function adminDeleteColonEntry(id: string): Promise<{ ok: boolean }> {
  return adminFetch(`/colon-db/${id}`, { method: 'DELETE' });
}

export type ShoutboxMessageKind = 'chat' | 'bot' | 'system' | 'action' | 'ping' | 'achievement' | 'pinned';

export type ShoutboxMessage = {
  id: string;
  lobby: string;
  userId: string | null;
  username: string;
  displayName: string;
  role: string;
  verified?: boolean;
  avatarUrl?: string | null;
  kind: ShoutboxMessageKind;
  text: string;
  segments?: ChatSegment[] | null;
  createdAt: number;
};

export type ShoutboxTopChatter = {
  username: string;
  count: number;
  displayName: string;
  role: string;
  verified?: boolean;
  chatBanned?: boolean;
  chatMutedUntil?: number | null;
};

export type ShoutboxAdminData = {
  lobby: string;
  total: number;
  messages: ShoutboxMessage[];
  updatedAt: string | null;
  stats: { stored: number; uniqueUsers?: number; byKind: Record<string, number> };
  topChatters?: ShoutboxTopChatter[];
};

export type ShoutboxKindFilter = 'all' | 'chat' | 'bot' | 'system' | 'action' | 'ping' | 'achievement';

export async function fetchAdminShoutbox(opts?: {
  limit?: number;
  q?: string;
  kind?: ShoutboxKindFilter;
  username?: string;
}): Promise<ShoutboxAdminData> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.q) params.set('q', opts.q);
  if (opts?.kind && opts.kind !== 'all') params.set('kind', opts.kind);
  if (opts?.username) params.set('username', opts.username);
  const qs = params.toString();
  return adminFetch(`/shoutbox/messages${qs ? `?${qs}` : ''}`);
}

export async function adminDeleteShoutboxMessage(id: string): Promise<{ ok: boolean; removed?: number }> {
  return adminFetch(`/shoutbox/messages/${id}`, { method: 'DELETE' });
}

export async function adminBulkDeleteShoutboxMessages(ids: string[]): Promise<{ ok: boolean; removed: number }> {
  return adminFetch('/shoutbox/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export async function adminClearShoutbox(): Promise<{ ok: boolean; cleared: number }> {
  return adminFetch('/shoutbox/clear', { method: 'POST' });
}

export async function adminBroadcastShoutbox(text: string): Promise<{ ok: boolean }> {
  return adminFetch('/shoutbox/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export type ShoutboxModAction = 'ban' | 'unban' | 'mute' | 'unmute';

export async function adminModerateShoutboxUser(opts: {
  action: ShoutboxModAction;
  username: string;
  minutes?: number;
}): Promise<{ ok: boolean }> {
  return adminFetch('/shoutbox/mod', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
}

export type AdminImageMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  views: number;
  userId: string | null;
  favorite: boolean;
  tags: string[];
  createdAt: number | null;
  updatedAt: number | null;
  url: string;
};

export type AdminImagesData = {
  images: AdminImageMeta[];
  total: number;
  stats: { onDisk: number; totalBytes: number; totalViews: number };
};

export async function fetchAdminImages(opts?: {
  limit?: number;
  q?: string;
  sort?: 'newest' | 'oldest' | 'views' | 'size';
}): Promise<AdminImagesData> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.q) params.set('q', opts.q);
  if (opts?.sort) params.set('sort', opts.sort);
  const qs = params.toString();
  return adminFetch(`/images${qs ? `?${qs}` : ''}`);
}

export async function adminDeleteImage(id: string): Promise<{ ok: boolean }> {
  return adminFetch(`/images/${id}`, { method: 'DELETE' });
}

export type ContentAnalytics = {
  generatedAt: number;
  postViews: {
    changelog: { id: string; views: number }[];
    news: { id: string; views: number }[];
    changelogTotal: number;
    newsTotal: number;
  };
  pageViews: {
    pages: { pageId: string; views: number }[];
    total: number;
  };
};

export async function fetchContentAnalytics(): Promise<ContentAnalytics> {
  return adminFetch('/content-analytics');
}

export type PersonaStats = {
  total: number;
  countries: string[];
  byCountry: Record<string, number>;
  updatedAt: string | null;
};

export async function fetchPersonaStats(): Promise<PersonaStats> {
  return adminFetch('/persona/stats');
}

export type PersonaEntry = {
  id: string;
  country: string;
  city: string;
  street: string;
  zip: string | null;
  timezone: string | null;
  venue: string | null;
  address: string | null;
};

export async function fetchPersonaEntries(opts?: {
  limit?: number;
  country?: string;
  q?: string;
}): Promise<{ entries: PersonaEntry[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.country) params.set('country', opts.country);
  if (opts?.q) params.set('q', opts.q);
  const qs = params.toString();
  return adminFetch(`/persona/entries${qs ? `?${qs}` : ''}`);
}

export type VisitorProfileRow = {
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
  deviceType: string;
  language: string;
  timezone: string;
  utmSource: string;
  refCode: string;
  firstSeenAt: number;
  lastSeenAt: number;
};

export type VisitorsAdminData = {
  total: number;
  profiles: VisitorProfileRow[];
  overview: {
    totalProfiles: number;
    activeLast24h: number;
    returnVisitorCount: number;
    avgVisitsPerVisitor: number;
  };
};

export async function fetchAdminVisitors(opts?: {
  limit?: number;
  q?: string;
}): Promise<VisitorsAdminData> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.q) params.set('q', opts.q);
  const qs = params.toString();
  return adminFetch(`/visitors${qs ? `?${qs}` : ''}`);
}

export type ReferralLeader = {
  userId: string;
  username: string;
  displayName: string;
  referralCode: string;
  referralsCount: number;
  referredBy: string | null;
  createdAt: number | null;
  verified: boolean;
  role: string;
};

export type ReferralsAdminData = {
  generatedAt: number;
  stats: {
    totalReferrals: number;
    usersWithCode: number;
    topReferrers: number;
    membersReferred: number;
  };
  leaders: ReferralLeader[];
  recentReferred: {
    userId: string;
    username: string;
    displayName: string;
    referredBy: string | null;
    createdAt: number | null;
  }[];
};

export async function fetchAdminReferrals(limit = 50): Promise<ReferralsAdminData> {
  return adminFetch(`/referrals?limit=${limit}`);
}

export type EventsOpsData = {
  generatedAt: number;
  stats: { stored: number; maxCapacity: number; types: number; oldestTs: number | null; newestTs: number | null };
  typeCounts: { type: string; count: number }[];
  dailySeries: { date: string; events: number; logins: number; tabVisits: number }[];
  recentEvents: { id: string; type: string; username: string | null; tab: string | null; ts: number; guestId: string | null }[];
};

export async function fetchAdminEvents(): Promise<EventsOpsData> {
  return adminFetch('/events');
}

export async function adminPurgeEvents(keep = 2000): Promise<{ before: number; after: number; removed: number }> {
  return adminFetch('/events/purge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keep }) });
}

export async function adminExportEvents(): Promise<unknown> {
  return adminFetch('/events/export');
}

export type OnlineRadarData = {
  generatedAt: number;
  activeToday: { date: string; count: number; onlineNow: number; users: { id: string; username: string; displayName: string; role: string; isOnline: boolean; lastSeenAt: number | null }[] };
  onlineNow: { id: string; username: string; displayName: string; role: string; verified: boolean; lastSeenAt: number | null; onlineMinutes: number; pageVisits: number }[];
  stats: { onlineCount: number; activeTodayCount: number; registered: number };
};

export async function fetchAdminOnline(): Promise<OnlineRadarData> {
  return adminFetch('/online');
}

export type HeatmapData = {
  generatedAt: number;
  tabHits: { tab: string; count: number }[];
  dwellByTab: { tab: string; avgSec: number; totalSec: number; visits: number }[];
  visitorAggregates: {
    returnVisits: number;
    newVisits: number;
    topReferrerDomains: { key: string; count: number }[];
    topDevices: { key: string; count: number }[];
    topLandingPaths: { key: string; count: number }[];
  };
};

export async function fetchAdminHeatmap(): Promise<HeatmapData> {
  return adminFetch('/heatmap');
}

export type AchievementsAdminData = {
  generatedAt: number;
  stats: { totalUnlocked: number; uniqueTypes: number; membersWithAny: number; avgPerMember: number };
  byAchievement: { id: string; name: string; icon: string; count: number }[];
  leaders: { userId: string; username: string; displayName: string; role: string; count: number; achievements: string[] }[];
};

export async function fetchAdminAchievements(): Promise<AchievementsAdminData> {
  return adminFetch('/achievements');
}

export type ScraperPoolData = {
  generatedAt: number;
  state: Record<string, unknown>;
  pool: { poolCount: number; scrapedCount: number; customCount: number; dedupRemoved: number; scrapedAt: string | number | null; customUpdatedAt: string | null; checkedAlive: number; checkedTotal: number };
  sources: { total: number; enabled: number; sample: { id: string; label: string; enabled: boolean }[] };
  topProxies: { type: string; host: string; port: number }[];
};

export async function fetchAdminScraperPool(): Promise<ScraperPoolData> {
  return adminFetch('/scraper-pool');
}

export type CheckerDashboardData = {
  generatedAt: number;
  state: Record<string, unknown>;
  results: { total: number; alive: number; dead: number; avgLatency: number; sample: { type: string; host: string; port: number; alive: boolean; latency: number | null }[] };
};

export async function fetchAdminChecker(): Promise<CheckerDashboardData> {
  return adminFetch('/checker');
}

export type ReportsDeskData = {
  generatedAt: number;
  stats: Record<string, number>;
  total: number;
  reports: { id: string; status: string; note: string; createdAt: number; reviewedAt: number | null; reportedByUsername: string; account: { id: string; service: string; category: string; status: string } | null }[];
};

export async function fetchAdminReports(): Promise<ReportsDeskData> {
  return adminFetch('/reports');
}

export type ChangelogConsoleData = {
  generatedAt: number;
  totalReleases: number;
  latest: { version: string; title: string; date: string; highlight: boolean; itemCount: number } | null;
  releases: { version: string; title: string; date: string; highlight: boolean; itemCount: number }[];
};

export async function fetchAdminChangelog(): Promise<ChangelogConsoleData> {
  return adminFetch('/changelog');
}

export type AvatarsAdminData = {
  generatedAt: number;
  stats: { onDisk: number; totalBytes: number; membersWithAvatar: number };
  avatars: { userId: string; filename: string; url: string; bytes: number; updatedAt: number; username: string | null; displayName: string | null }[];
};

export async function fetchAdminAvatars(): Promise<AvatarsAdminData> {
  return adminFetch('/avatars');
}

export type StorageMapData = {
  generatedAt: number;
  totals: { bytes: number; files: number; stores: number };
  stores: { id: string; label: string; path: string; bytes: number; files: number }[];
};

export async function fetchAdminStorage(): Promise<StorageMapData> {
  return adminFetch('/storage');
}

export { fetchTerminalStats, fetchLeaderboards };
export type { TerminalStats, LeaderboardsResponse };