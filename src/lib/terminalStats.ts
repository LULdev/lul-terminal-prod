/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API = '/api/terminal-stats';

export type MemberHighlight = {
  username: string;
  displayName: string;
  value: number;
};

export type TerminalStats = {
  generatedAt: number;
  version: string;
  community: {
    registeredMembers: number;
    activeMembers: number;
    membersJoinedThisWeek: number;
    membersActiveToday: number;
    membersOnlineNow: number;
    vipMembers: number;
    verifiedMembers: number;
    adminMembers: number;
    totalReferrals: number;
    totalProfileViews: number;
    totalAchievementsUnlocked: number;
    totalOnlineMinutes: number;
    totalPageVisits: number;
    totalCommandsRun: number;
    newestMember: { username: string; displayName: string; joinedAt: number } | null;
    topProfileViews: MemberHighlight | null;
    topReferrer: MemberHighlight | null;
    topUploader: MemberHighlight | null;
    topMemeCreator: MemberHighlight | null;
  };
  media: {
    imagesHosted: number;
    imageViewsTotal: number;
    imageFilesOnDisk: number;
    imageStorageBytes: number;
    totalMemberUploads: number;
    totalMemesCreated: number;
    topImage: { id: string; name: string; views: number } | null;
  };
  network: {
    proxiesInDatabase: number;
    proxiesWorking: number;
    proxiesOffline: number;
    proxiesEverCollected: number;
    proxyTypesWorking: Record<string, number>;
    scraperPoolSize: number;
    scraperSourcesOk: number;
    checkerAlive: number;
    lastProxyCheckAt: number | null;
  };
  vault: {
    premiumAccounts: number;
    freeAccounts: number;
    vaultTotal: number;
  };
  content: {
    newsArticles: number;
    newsFeedVersion: string;
    changelogReleases: number;
    changelogViews: number;
    newsViews: number;
    shoutboxMessagesStored: number;
    shoutboxSentByMembers: number;
  };
  labs: {
    personaEntries: number;
    personaCountries: number;
  };
  analytics: {
    eventsStored: number;
    topTabVisited: { tab: string; count: number } | null;
    loginsToday: number;
  };
  meta: {
    onlineWindowMinutes: number;
  };
};

export async function fetchTerminalStats(): Promise<TerminalStats> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Stats unavailable');
  return res.json() as Promise<TerminalStats>;
}

export function formatStatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatRelativeEn(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}