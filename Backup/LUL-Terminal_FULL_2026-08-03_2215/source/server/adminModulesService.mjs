/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadUsersDb } from './auth/authStore.mjs';
import { isUserOnline } from './profileStats.mjs';
import { ensureActivity, userAchievementIds } from './auth/achievements.mjs';
import { localDayStart } from './profileStats.mjs';
import { loadEventsDb, loadAggregatesDb, MAX_EVENTS } from './analyticsStore.mjs';
import { listActiveTodayUsers } from './analyticsService.mjs';
import { loadState as loadScraperState, loadScrapePool, loadSources } from './proxyScraperStore.mjs';
import { loadCheckerState, loadCheckerResults } from './proxyCheckerStore.mjs';
import { loadReportsDb } from './premiumAccountsReports.mjs';
import { loadAccountsDb } from './premiumAccountsStore.mjs';
import { ACHIEVEMENT_LOOKUP } from './chatConstants.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHANGELOG_FILE = path.join(ROOT, 'src', 'data', 'changelog.ts');
const AVATAR_DIR = path.join(ROOT, 'data', 'avatars');

async function dirStats(target) {
  let bytes = 0;
  let files = 0;
  try {
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else {
          const st = await fs.stat(p);
          bytes += st.size;
          files += 1;
        }
      }
    };
    await walk(target);
  } catch { /* missing dir */ }
  return { bytes, files };
}

export async function buildAdminEventsOps() {
  const [eventsDb, agg] = await Promise.all([loadEventsDb(), loadAggregatesDb()]);
  const events = eventsDb.events ?? [];
  const recent = [...events].slice(-80).reverse().map((e) => ({
    id: e.id,
    type: e.type,
    username: e.username,
    tab: e.tab,
    ts: e.ts,
    guestId: e.guestId ?? null,
  }));

  const typeCounts = {};
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  }

  return {
    generatedAt: Date.now(),
    stats: {
      stored: events.length,
      maxCapacity: MAX_EVENTS,
      types: Object.keys(typeCounts).length,
      oldestTs: events[0]?.ts ?? null,
      newestTs: events[events.length - 1]?.ts ?? null,
    },
    typeCounts: Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count })),
    dailySeries: Object.entries(agg.daily ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, d]) => ({
        date,
        events: d.events ?? 0,
        logins: d.logins ?? 0,
        tabVisits: d.tabVisits ?? 0,
      })),
    recentEvents: recent,
  };
}

export async function buildAdminHeatmap() {
  const agg = await loadAggregatesDb();
  const tabHits = Object.entries(agg.tabHits ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([tab, count]) => ({ tab, count }));

  const dwellByTab = Object.entries(agg.dwellByTab ?? {})
    .map(([tab, d]) => ({
      tab,
      avgSec: d.count ? Math.round(d.totalSec / d.count) : 0,
      totalSec: d.totalSec ?? 0,
      visits: d.count ?? 0,
    }))
    .sort((a, b) => b.totalSec - a.totalSec);

  const vs = agg.visitorStats ?? {};

  return {
    generatedAt: Date.now(),
    tabHits,
    dwellByTab,
    visitorAggregates: {
      returnVisits: vs.returnVisits ?? 0,
      newVisits: vs.newVisits ?? 0,
      topReferrerDomains: Object.entries(vs.referrerDomains ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([key, count]) => ({ key, count })),
      topDevices: Object.entries(vs.devices ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([key, count]) => ({ key, count })),
      topLandingPaths: Object.entries(vs.landingPaths ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ key, count })),
    },
  };
}

export async function buildAdminAchievements() {
  const db = await loadUsersDb();
  const users = db.users.filter((u) => u.role !== 'bot' && u.active !== false);
  const byAchievement = {};

  for (const u of users) {
    for (const id of userAchievementIds(u.achievements)) {
      if (!byAchievement[id]) {
        const meta = ACHIEVEMENT_LOOKUP[id] ?? { name: id, icon: '🏅' };
        byAchievement[id] = { id, name: meta.name, icon: meta.icon, count: 0 };
      }
      byAchievement[id].count += 1;
    }
  }

  const leaders = [...users]
    .sort((a, b) => userAchievementIds(b.achievements).length - userAchievementIds(a.achievements).length)
    .slice(0, 40)
    .map((u) => {
      const ids = userAchievementIds(u.achievements);
      return {
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        count: ids.length,
        achievements: ids.slice(0, 12),
      };
    });

  const totalUnlocked = users.reduce((s, u) => s + userAchievementIds(u.achievements).length, 0);

  return {
    generatedAt: Date.now(),
    stats: {
      totalUnlocked,
      uniqueTypes: Object.keys(byAchievement).length,
      membersWithAny: users.filter((u) => userAchievementIds(u.achievements).length > 0).length,
      avgPerMember: users.length ? Math.round((totalUnlocked / users.length) * 10) / 10 : 0,
    },
    byAchievement: Object.values(byAchievement).sort((a, b) => b.count - a.count),
    leaders,
  };
}

export async function buildAdminScraperPool() {
  const [state, pool, sources] = await Promise.all([
    loadScraperState(),
    loadScrapePool(),
    loadSources(),
  ]);

  return {
    generatedAt: Date.now(),
    state,
    pool: {
      poolCount: pool.poolCount,
      scrapedCount: pool.scrapedCount,
      customCount: pool.customCount,
      dedupRemoved: pool.dedupRemoved,
      scrapedAt: pool.scrapedAt,
      customUpdatedAt: pool.customUpdatedAt,
      checkedAlive: (pool.checked ?? []).filter((p) => p.alive).length,
      checkedTotal: (pool.checked ?? []).length,
    },
    sources: {
      total: sources.length,
      enabled: sources.filter((s) => s.enabled !== false).length,
      sample: sources.slice(0, 12).map((s) => ({
        id: s.id,
        label: s.label ?? s.url,
        enabled: s.enabled !== false,
      })),
    },
    topProxies: (pool.proxies ?? []).slice(0, 24).map((p) => ({
      type: p.type,
      host: p.host,
      port: p.port,
    })),
  };
}

export async function buildAdminCheckerDashboard() {
  const [state, results] = await Promise.all([loadCheckerState(), loadCheckerResults()]);
  const checked = results.checked ?? results.proxies ?? [];
  const isAlive = (p) => Boolean(p.alive ?? p.status === 'working');
  const aliveRows = checked.filter(isAlive);
  const latencies = aliveRows.map((p) => Number(p.latency)).filter((n) => n > 0);
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
    : (state.avgLatency ?? 0);

  return {
    generatedAt: Date.now(),
    state,
    results: {
      total: checked.length,
      alive: aliveRows.length,
      dead: checked.length - aliveRows.length,
      avgLatency,
      sample: checked.slice(0, 30).map((p) => ({
        type: p.type,
        host: p.host,
        port: p.port,
        alive: isAlive(p),
        latency: p.latency ?? null,
      })),
    },
  };
}

export async function buildAdminReportsDesk() {
  const [reportsDb, accountsDb] = await Promise.all([loadReportsDb(), loadAccountsDb()]);
  const findAccount = (id) => accountsDb.accounts.find((a) => a.id === id) ?? null;

  const reports = [...reportsDb.reports]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .map((r) => {
      const account = findAccount(r.accountId);
      return {
        id: r.id,
        status: r.status,
        note: r.note ?? '',
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        reportedByUsername: r.reportedByUsername,
        account: account
          ? { id: account.id, service: account.service, category: account.category, status: account.status }
          : null,
      };
    });

  const byStatus = { pending: 0, accepted: 0, rejected: 0 };
  for (const r of reports) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  return {
    generatedAt: Date.now(),
    stats: byStatus,
    total: reports.length,
    reports: reports.slice(0, 100),
  };
}

export async function buildAdminChangelogConsole() {
  const raw = await fs.readFile(CHANGELOG_FILE, 'utf8');
  const entries = [];
  const blocks = raw.split(/\{\s*\n\s*version:/).slice(1);

  const readField = (block, field) => {
    const re = new RegExp(`${field}:\\s*'((?:\\\\'|[^'])*)'`);
    return block.match(re)?.[1]?.replace(/\\'/g, "'") ?? null;
  };

  for (const block of blocks) {
    const version = block.match(/^\s*['"]([^'"]+)['"]/)?.[1];
    const title = readField(block, 'title');
    const date = readField(block, 'date');
    const highlight = /highlight:\s*true/.test(block);
    const itemCount = (block.match(/icon:\s*['"]/g) ?? []).length;
    if (version) entries.push({ version, title: title ?? '', date: date ?? '', highlight, itemCount });
  }

  return {
    generatedAt: Date.now(),
    totalReleases: entries.length,
    latest: entries[0] ?? null,
    releases: entries.slice(0, 40),
  };
}

export async function buildAdminAvatars() {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const files = await fs.readdir(AVATAR_DIR);
  const avatars = [];

  for (const f of files) {
    if (!/^[a-f0-9]+\.(jpg|png|gif|webp)$/.test(f)) continue;
    const st = await fs.stat(path.join(AVATAR_DIR, f));
    const userId = f.split('.')[0];
    avatars.push({
      userId,
      filename: f,
      url: `/api/auth/avatars/${f}`,
      bytes: st.size,
      updatedAt: st.mtimeMs,
    });
  }

  avatars.sort((a, b) => b.updatedAt - a.updatedAt);

  const db = await loadUsersDb();
  const userMap = new Map(db.users.map((u) => [u.id, u]));

  return {
    generatedAt: Date.now(),
    stats: {
      onDisk: avatars.length,
      totalBytes: avatars.reduce((s, a) => s + a.bytes, 0),
      membersWithAvatar: db.users.filter((u) => u.avatarUrl).length,
    },
    avatars: avatars.slice(0, 120).map((a) => ({
      ...a,
      username: userMap.get(a.userId)?.username ?? null,
      displayName: userMap.get(a.userId)?.displayName ?? null,
    })),
  };
}

export async function buildAdminStorageMap() {
  const dirs = [
    { id: 'auth', label: 'Auth & Users', path: 'data/auth' },
    { id: 'analytics', label: 'Analytics', path: 'data/analytics' },
    { id: 'paste', label: 'Pastes', path: 'data/paste' },
    { id: 'image-host', label: 'Image Host', path: 'data/image-host' },
    { id: 'avatars', label: 'Avatars', path: 'data/avatars' },
    { id: 'premium-accounts', label: 'Premium Vault', path: 'data/premium-accounts' },
    { id: 'proxy-db', label: 'Proxy DB', path: 'data/proxy-database' },
    { id: 'proxy-scraper', label: 'Proxy Scraper', path: 'data/proxy-scraper' },
    { id: 'proxy-checker', label: 'Proxy Checker', path: 'data/proxy-checker' },
    { id: 'colon-scraper-database', label: 'Colon DB', path: 'data/colon-scraper-database' },
    { id: 'persona-database', label: 'Persona DB', path: 'data/persona-database' },
    { id: 'chat', label: 'Shoutbox', path: 'data/chat' },
    { id: 'feeds', label: 'News Feeds', path: 'data/feeds' },
  ];

  const stores = [];
  let totalBytes = 0;
  let totalFiles = 0;

  for (const d of dirs) {
    const { bytes, files } = await dirStats(path.join(ROOT, d.path));
    totalBytes += bytes;
    totalFiles += files;
    stores.push({ ...d, bytes, files });
  }

  stores.sort((a, b) => b.bytes - a.bytes);

  return {
    generatedAt: Date.now(),
    totals: { bytes: totalBytes, files: totalFiles, stores: stores.length },
    stores,
  };
}

export async function buildAdminOnlineRadar() {
  const [activeToday, db] = await Promise.all([listActiveTodayUsers(60), loadUsersDb()]);
  const users = db.users.filter((u) => u.role !== 'bot' && u.active !== false);
  const online = users
    .filter((u) => isUserOnline(u))
    .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0))
    .map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      verified: Boolean(u.verified),
      lastSeenAt: u.lastSeenAt ?? u.lastLoginAt ?? null,
      onlineMinutes: u.onlineMinutes ?? 0,
      pageVisits: ensureActivity(u).pageVisits ?? 0,
    }));

  return {
    generatedAt: Date.now(),
    activeToday,
    onlineNow: online,
    stats: {
      onlineCount: online.length,
      activeTodayCount: activeToday.count,
      registered: users.length,
    },
  };
}