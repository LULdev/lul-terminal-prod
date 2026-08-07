/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadUsersDb, loadSessionsDb } from './auth/authStore.mjs';
import { loadEventsDb, loadAggregatesDb, MAX_EVENTS } from './analyticsStore.mjs';
import { loadAccessControl } from './accessControlStore.mjs';
import { loadLobbyDb } from './chatStore.mjs';
import { readStats as readPasteStats } from './pasteStore.mjs';
import { readStats as readImageStats } from './imageHostStore.mjs';
import { getAllPostViews } from './postViewsStore.mjs';
import { getAllPageViews } from './pageViewsStore.mjs';
import { listPublishedArticles } from './newsStore.mjs';
import { buildLeaderboards } from './leaderboardService.mjs';
import { getPublicAccountStats } from './premiumAccountsService.mjs';
import { loadState as loadProxyScraperState } from './proxyScraperStore.mjs';
import { loadCheckerState } from './proxyCheckerStore.mjs';
import { getDatabaseStats } from './proxyDatabaseService.mjs';
import { getColonDbStats } from './colonScraperDatabaseService.mjs';
import { getPersonaStats } from './personaDatabaseStore.mjs';
import { buildAdminStorageMap } from './adminModulesService.mjs';
import { getLatestChangelogVersion } from './changelogMeta.mjs';
import { isUserOnline } from './profileStats.mjs';

const STARTED_AT = Date.now();

/** Sum numeric values from a map/object, treating non-finite as 0 (avoids NaN metrics). */
function finiteSum(values) {
  let total = 0;
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function finiteNonNeg(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** Probes that expose operational intelligence — redacted on public /api/status. */
const PUBLIC_REDACTED_CHECK_IDS = new Set([
  'sessions',
  'analytics',
  'storage',
  'aggregates',
  'terminal-stats',
  'access-control',
]);

function redactCheckForPublic(check) {
  if (!PUBLIC_REDACTED_CHECK_IDS.has(check.id)) return check;
  return {
    ...check,
    message: check.status === 'operational' ? 'Operational' : check.message,
    metric: null,
  };
}

async function probe(id, label, group, icon, run) {
  const t0 = Date.now();
  try {
    const detail = await run();
    const latencyMs = Date.now() - t0;
    const status = detail.status ?? 'operational';
    return {
      id,
      label,
      group,
      icon,
      status,
      latencyMs,
      message: detail.message ?? 'OK',
      metric: detail.metric ?? null,
    };
  } catch (e) {
    return {
      id,
      label,
      group,
      icon,
      status: 'down',
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : 'Check failed',
      metric: null,
    };
  }
}

function summarize(checks) {
  const operational = checks.filter((c) => c.status === 'operational').length;
  const degraded = checks.filter((c) => c.status === 'degraded').length;
  const down = checks.filter((c) => c.status === 'down').length;
  const avgLatencyMs = checks.length
    ? Math.round(checks.reduce((s, c) => s + c.latencyMs, 0) / checks.length)
    : 0;

  let overall = 'operational';
  if (down > 0) overall = down >= 3 ? 'major' : 'partial';
  else if (degraded > 0) overall = 'degraded';

  return { operational, degraded, down, total: checks.length, avgLatencyMs, overall };
}

export async function buildSystemStatus() {
  const version = getLatestChangelogVersion();
  const checks = await Promise.all([
    probe('auth', 'Auth & Users', 'core', '🔐', async () => {
      const db = await loadUsersDb();
      const accounts = Array.isArray(db.users) ? db.users.length : 0;
      const active = Array.isArray(db.users)
        ? db.users.filter((u) => u.active !== false && u.role !== 'bot').length
        : 0;
      return { message: `${accounts} accounts`, metric: `${active} active` };
    }),
    probe('sessions', 'Sessions', 'core', '🍪', async () => {
      const db = await loadSessionsDb();
      const live = Array.isArray(db.sessions)
        ? db.sessions.filter((s) => Number(s.expiresAt) > Date.now()).length
        : 0;
      return { message: `${live} active sessions`, metric: String(live) };
    }),
    probe('analytics', 'Analytics Engine', 'core', '📊', async () => {
      const db = await loadEventsDb();
      const count = Array.isArray(db.events) ? db.events.length : 0;
      const cap = Number.isFinite(MAX_EVENTS) && MAX_EVENTS > 0 ? MAX_EVENTS : 1;
      const status = count >= cap * 0.95 ? 'degraded' : 'operational';
      const pct = Math.min(100, Math.max(0, Math.round((count / cap) * 100)));
      return {
        status,
        message: `${count} events stored`,
        metric: `${pct}% cap`,
      };
    }),
    probe('access-control', 'Page Visibility', 'core', '👁️', async () => {
      const db = await loadAccessControl();
      const publicPages = Object.values(db.pages ?? {}).filter((v) => v === 'public').length;
      return { message: `${publicPages} public pages`, metric: String(publicPages) };
    }),
    probe('terminal-stats', 'Terminal Stats API', 'core', '📡', async () => {
      const [usersDb] = await Promise.all([loadUsersDb(), loadEventsDb()]);
      const online = Array.isArray(usersDb.users) ? usersDb.users.filter((u) => isUserOnline(u)).length : 0;
      return { message: 'Stats pipeline ready', metric: `${online} online` };
    }),

    probe('shoutbox', 'Shoutbox / Chat', 'community', '💬', async () => {
      const db = await loadLobbyDb();
      const count = Array.isArray(db.messages) ? db.messages.length : 0;
      return { message: `${count} messages stored`, metric: String(count) };
    }),
    probe('leaderboards', 'Leaderboards', 'community', '🏆', async () => {
      const data = await buildLeaderboards();
      const boards = Array.isArray(data.boards) ? data.boards.length : 0;
      return { message: `${boards} live boards`, metric: String(boards) };
    }),
    probe('news', 'News Feed', 'community', '📰', async () => {
      const feed = await listPublishedArticles();
      const articles = Array.isArray(feed.articles) ? feed.articles.length : 0;
      return { message: `${articles} articles`, metric: feed.feedVersion ?? '—' };
    }),
    probe('post-views', 'Post View Tracking', 'community', '👀', async () => {
      const views = await getAllPostViews();
      const total = finiteSum(Object.values(views.changelog ?? {}))
        + finiteSum(Object.values(views.news ?? {}));
      return { message: 'Changelog & news views', metric: String(finiteNonNeg(total)) };
    }),

    probe('paste', 'Paste Service', 'content', '📋', async () => {
      const stats = await readPasteStats();
      // readStats fields: pastesCreated / pasteViewsTotal / activePastes (not `.total`)
      const total = finiteNonNeg(stats.pastesCreated ?? stats.total);
      const active = finiteNonNeg(stats.activePastes);
      return { message: `${total} pastes`, metric: `${active} active` };
    }),
    probe('image-host', 'Image Hosting', 'content', '☁️', async () => {
      const stats = await readImageStats();
      const images = finiteNonNeg(stats.imagesHosted);
      const viewsTotal = finiteNonNeg(stats.imageViewsTotal);
      return {
        message: `${images} images`,
        metric: `${viewsTotal} views`,
      };
    }),
    probe('page-views', 'Page View Counter', 'content', '📄', async () => {
      const views = await getAllPageViews();
      const pages = Object.keys(views.pages ?? {}).length;
      const total = finiteNonNeg(finiteSum(Object.values(views.pages ?? {})));
      return { message: `${pages} pages tracked`, metric: String(total) };
    }),

    probe('proxy-scraper', 'Proxy Scraper', 'network', '🕸️', async () => {
      const state = await loadProxyScraperState();
      const pool = finiteNonNeg(state.uniqueProxies ?? state.totalScraped ?? 0);
      const ok = finiteNonNeg(state.sourcesOk);
      const failed = finiteNonNeg(state.sourcesFailed);
      const status = failed > ok ? 'degraded' : 'operational';
      return {
        status,
        message: `Pool ${pool} · ${ok} sources OK`,
        metric: String(pool),
      };
    }),
    probe('proxy-checker', 'Proxy Checker', 'network', '✅', async () => {
      const state = await loadCheckerState();
      const checked = finiteNonNeg(state.totalChecked);
      const alive = finiteNonNeg(state.alive);
      const status = !state.lastCheckAt && checked === 0 ? 'degraded' : 'operational';
      return {
        status,
        message: state.lastCheckAt ? 'Last check recorded' : 'No checks yet',
        metric: `${alive} alive`,
      };
    }),
    probe('proxy-database', 'Proxy Database', 'network', '🗄️', async () => {
      const stats = await getDatabaseStats();
      const status = stats.inDatabase > 0 && stats.working === 0 ? 'degraded' : 'operational';
      const working = Number.isFinite(Number(stats.working)) ? Math.max(0, Math.floor(Number(stats.working))) : 0;
      const stored = Number.isFinite(Number(stats.inDatabase)) ? Math.max(0, Math.floor(Number(stats.inDatabase))) : 0;
      return {
        status,
        message: `${working} working / ${stored} stored`,
        metric: stats.nextDailyCheckDue ? 'check due' : 'checked',
      };
    }),
    probe('colon-db', 'Colon Scraper DB', 'network', '🔗', async () => {
      const stats = await getColonDbStats();
      const total = Number.isFinite(Number(stats.total)) ? Math.max(0, Math.floor(Number(stats.total))) : 0;
      const sites = Number.isFinite(Number(stats.websites)) ? Math.max(0, Math.floor(Number(stats.websites))) : 0;
      return { message: `${total} U:P entries`, metric: `${sites} sites` };
    }),
    probe('persona-db', 'Persona Database', 'network', '🎭', async () => {
      const stats = await getPersonaStats();
      const total = Number.isFinite(Number(stats.total)) ? Math.max(0, Math.floor(Number(stats.total))) : 0;
      const countries = Array.isArray(stats.countries) ? stats.countries.length : 0;
      return { message: `${total} personas`, metric: `${countries} countries` };
    }),

    probe('premium-vault', 'Premium Vault', 'vault', '👑', async () => {
      const stats = await getPublicAccountStats();
      const premium = Number.isFinite(Number(stats.premium)) ? Math.max(0, Math.floor(Number(stats.premium))) : 0;
      const free = Number.isFinite(Number(stats.free)) ? Math.max(0, Math.floor(Number(stats.free))) : 0;
      const total = premium + free;
      return { message: `${total} accounts in vault`, metric: `${premium} premium` };
    }),

    probe('storage', 'Data Storage', 'storage', '💾', async () => {
      const map = await buildAdminStorageMap();
      const files = Number.isFinite(Number(map.totals.files)) ? Math.max(0, Math.floor(Number(map.totals.files))) : 0;
      const bytes = Number.isFinite(Number(map.totals.bytes)) ? Math.max(0, Number(map.totals.bytes)) : 0;
      const stores = Number.isFinite(Number(map.totals.stores)) ? Math.max(0, Math.floor(Number(map.totals.stores))) : 0;
      const mb = Math.round(bytes / 1024 / 1024);
      return {
        message: `${files} files · ${mb} MB`,
        metric: `${stores} stores`,
      };
    }),
    probe('aggregates', 'Visitor Aggregates', 'storage', '🛰️', async () => {
      const agg = await loadAggregatesDb();
      const tabs = Object.keys(agg.tabHits ?? {}).length;
      const returns = Number.isFinite(Number(agg.visitorStats?.returnVisits))
        ? Math.max(0, Math.floor(Number(agg.visitorStats.returnVisits)))
        : 0;
      return { message: `${tabs} tabs in heatmap`, metric: `${returns} returns` };
    }),
  ]);

  const summary = summarize(checks);
  const groups = [...new Set(checks.map((c) => c.group))];

  const publicChecks = checks.map(redactCheckForPublic);
  const publicSummary = summarize(publicChecks);

  return {
    generatedAt: Date.now(),
    version,
    uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
    summary: publicSummary,
    groups: groups.map((id) => ({
      id,
      label: GROUP_LABELS[id] ?? id,
      checks: publicChecks.filter((c) => c.group === id),
    })),
    checks: publicChecks,
  };
}

const GROUP_LABELS = {
  core: 'Core Platform',
  community: 'Community & Social',
  content: 'Content Services',
  network: 'Network & Proxies',
  vault: 'Premium Vault',
  storage: 'Data & Analytics',
};