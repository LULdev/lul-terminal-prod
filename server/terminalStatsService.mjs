/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadUsersDb } from './auth/authStore.mjs';
import { ensureActivity, userAchievementIds } from './auth/achievements.mjs';
import { isUserOnline, localDayStart, ONLINE_WINDOW_MS } from './profileStats.mjs';
import { readStats as readImageStats, listAllMeta } from './imageHostStore.mjs';
import { getDatabaseStats } from './proxyDatabaseService.mjs';
import { loadState as loadProxyScraperState } from './proxyScraperStore.mjs';
import { loadCheckerState } from './proxyCheckerStore.mjs';
import { getPublicAccountStats } from './premiumAccountsService.mjs';
import { getPersonaStats } from './personaDatabaseStore.mjs';
import { loadLobbyDb } from './chatStore.mjs';
import { listPublishedArticles } from './newsStore.mjs';
import { getAllPostViews } from './postViewsStore.mjs';
import { loadEventsDb, loadAggregatesDb } from './analyticsStore.mjs';
import { getLatestChangelogVersion } from './changelogMeta.mjs';
import { normalizeProfileCustomization } from './profileCustomization.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGELOG_FILE = path.join(__dirname, '..', 'src', 'data', 'changelog.ts');

function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function activityVisibleUsers(users) {
  return users.filter((u) => {
    const privacy = normalizeProfileCustomization(u.profileCustomization).privacy;
    return privacy.showActivityStats !== false;
  });
}

function pickTop(users, field, min = 1) {
  const sorted = [...users]
    .filter((u) => (Number(u[field]) || 0) >= min)
    .sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0));
  const top = sorted[0];
  if (!top) return null;
  return {
    username: top.username,
    displayName: top.displayName,
    value: Number(top[field]) || 0,
  };
}

async function countChangelogReleases() {
  try {
    const raw = await fs.readFile(CHANGELOG_FILE, 'utf8');
    const matches = raw.match(/^\s*version:\s*['"]/gm);
    return matches?.length ?? 0;
  } catch {
    return 0;
  }
}

function stripSensitiveTerminalFields(payload) {
  return {
    ...payload,
    community: {
      ...payload.community,
      adminMembers: 0,
      newestMember: null,
    },
    analytics: {
      ...payload.analytics,
      eventsStored: 0,
    },
  };
}

export async function buildTerminalStats({ includeSensitive = false } = {}) {
  const now = Date.now();
  const todayStart = localDayStart(now);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const [
    usersDb,
    imageStats,
    imageMetas,
    proxyDb,
    proxyScraper,
    proxyChecker,
    vaultStats,
    personas,
    lobby,
    news,
    postViews,
    eventsDb,
    aggregates,
    changelogReleases,
  ] = await Promise.all([
    loadUsersDb(),
    readImageStats(),
    listAllMeta(),
    getDatabaseStats().catch(() => null),
    loadProxyScraperState().catch(() => ({})),
    loadCheckerState().catch(() => ({})),
    getPublicAccountStats(),
    getPersonaStats().catch(() => ({ total: 0, countries: [] })),
    loadLobbyDb(),
    listPublishedArticles(),
    getAllPostViews().catch(() => ({ changelog: {}, news: {} })),
    loadEventsDb().catch(() => ({ events: [] })),
    loadAggregatesDb().catch(() => ({ tabHits: {}, eventCounts: {}, daily: {} })),
    countChangelogReleases(),
  ]);

  const users = usersDb.users.filter((u) => u.role !== 'bot' && u.active !== false);
  const visibleUsers = activityVisibleUsers(users);
  const allUsers = usersDb.users.filter((u) => u.role !== 'bot');

  const newest = [...allUsers].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null;
  const membersJoinedWeek = allUsers.filter((u) => (u.createdAt ?? 0) >= weekAgo).length;
  const membersActiveToday = users.filter((u) => {
    const seen = Number(u.lastSeenAt) || Number(u.lastLoginAt) || 0;
    return seen >= todayStart;
  }).length;
  const membersOnlineNow = users.filter((u) => isUserOnline(u)).length;

  const totalMemes = visibleUsers.reduce((s, u) => s + (Number(u.memesCreated) || 0), 0);
  const totalUploads = visibleUsers.reduce((s, u) => s + (Number(u.imagesUploaded) || 0), 0);
  const totalReferrals = visibleUsers.reduce((s, u) => s + (Number(u.referralsCount) || 0), 0);
  const totalProfileViews = visibleUsers.reduce((s, u) => s + (Number(u.profileViews) || 0), 0);
  const totalAchievementsUnlocked = visibleUsers.reduce(
    (s, u) => s + userAchievementIds(u.achievements).length,
    0,
  );
  const totalOnlineMinutes = visibleUsers.reduce((s, u) => s + (Number(u.onlineMinutes) || 0), 0);
  const totalCommands = visibleUsers.reduce((s, u) => s + (ensureActivity(u).commandsRun ?? 0), 0);
  const totalShoutboxSent = visibleUsers.reduce((s, u) => s + (ensureActivity(u).shoutboxSent ?? 0), 0);
  const totalPageVisits = visibleUsers.reduce((s, u) => s + (ensureActivity(u).pageVisits ?? 0), 0);

  const shoutboxTotal = lobby.messages?.filter((m) => m.role !== 'bot').length ?? 0;

  const changelogViews = Object.values(postViews.changelog ?? {}).reduce((a, b) => a + Number(b), 0);
  const newsViews = Object.values(postViews.news ?? {}).reduce((a, b) => a + Number(b), 0);

  const topTab = Object.entries(aggregates.tabHits ?? {})
    .sort((a, b) => b[1] - a[1])[0];

  const topImage = [...imageMetas].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] ?? null;

  const imageStorageBytes = imageMetas.reduce((s, m) => s + (Number(m.size) || 0), 0);

  const payload = {
    generatedAt: now,
    version: getLatestChangelogVersion(),
    community: {
      registeredMembers: allUsers.length,
      activeMembers: users.length,
      membersJoinedThisWeek: membersJoinedWeek,
      membersActiveToday,
      membersOnlineNow,
      vipMembers: allUsers.filter((u) => u.role === 'vip').length,
      verifiedMembers: allUsers.filter((u) => u.verified).length,
      adminMembers: allUsers.filter((u) => u.role === 'admin').length,
      totalReferrals,
      totalProfileViews,
      totalAchievementsUnlocked,
      totalOnlineMinutes,
      totalPageVisits,
      totalCommandsRun: totalCommands,
      newestMember: newest ? {
        username: newest.username,
        displayName: newest.displayName,
        joinedAt: newest.createdAt,
      } : null,
      topProfileViews: pickTop(activityVisibleUsers(users), 'profileViews'),
      topReferrer: pickTop(activityVisibleUsers(users), 'referralsCount'),
      topUploader: pickTop(activityVisibleUsers(users), 'imagesUploaded'),
      topMemeCreator: pickTop(activityVisibleUsers(users), 'memesCreated'),
    },
    media: {
      imagesHosted: imageStats.imagesHosted ?? 0,
      imageViewsTotal: imageStats.imageViewsTotal ?? 0,
      imageFilesOnDisk: imageMetas.length,
      imageStorageBytes,
      totalMemberUploads: totalUploads,
      totalMemesCreated: totalMemes,
      topImage: topImage ? {
        id: topImage.id,
        name: topImage.name,
        views: topImage.views ?? 0,
      } : null,
    },
    network: {
      proxiesInDatabase: proxyDb?.inDatabase ?? 0,
      proxiesWorking: proxyDb?.working ?? 0,
      proxiesOffline: proxyDb?.currentlyOffline ?? 0,
      proxiesEverCollected: proxyDb?.totalCollected ?? 0,
      proxyTypesWorking: proxyDb?.byType ?? {},
      scraperPoolSize: proxyScraper.uniqueProxies ?? proxyScraper.totalScraped ?? 0,
      scraperSourcesOk: proxyScraper.sourcesOk ?? 0,
      checkerAlive: proxyChecker.alive ?? 0,
      lastProxyCheckAt: proxyDb?.lastDailyCheckAt ?? proxyChecker.lastCheckAt ?? null,
    },
    vault: {
      premiumAccounts: vaultStats.premium ?? 0,
      freeAccounts: vaultStats.free ?? 0,
      vaultTotal: (vaultStats.premium ?? 0) + (vaultStats.free ?? 0),
    },
    content: {
      newsArticles: news.articles?.length ?? 0,
      newsFeedVersion: news.feedVersion ?? '0.0.0',
      changelogReleases,
      changelogViews,
      newsViews,
      shoutboxMessagesStored: shoutboxTotal,
      shoutboxSentByMembers: totalShoutboxSent,
    },
    labs: {
      personaEntries: personas.total ?? 0,
      personaCountries: personas.countries?.length ?? 0,
    },
    analytics: {
      eventsStored: eventsDb.events?.length ?? 0,
      topTabVisited: topTab ? { tab: topTab[0], count: topTab[1] } : null,
      loginsToday: aggregates.daily?.[dayKey(now)]?.logins ?? 0,
    },
    meta: {
      onlineWindowMinutes: Math.round(ONLINE_WINDOW_MS / 60_000),
    },
  };
  return includeSensitive ? payload : stripSensitiveTerminalFields(payload);
}