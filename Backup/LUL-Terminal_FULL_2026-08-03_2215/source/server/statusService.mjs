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
      const active = db.users.filter((u) => u.active !== false && u.role !== 'bot').length;
      return { message: `${db.users.length} accounts`, metric: `${active} active` };
    }),
    probe('sessions', 'Sessions', 'core', '🍪', async () => {
      const db = await loadSessionsDb();
      const live = db.sessions.filter((s) => s.expiresAt > Date.now()).length;
      return { message: `${live} active sessions`, metric: String(live) };
    }),
    probe('analytics', 'Analytics Engine', 'core', '📊', async () => {
      const db = await loadEventsDb();
      const count = db.events?.length ?? 0;
      const status = count >= MAX_EVENTS * 0.95 ? 'degraded' : 'operational';
      return {
        status,
        message: `${count} events stored`,
        metric: `${Math.round((count / MAX_EVENTS) * 100)}% cap`,
      };
    }),
    probe('access-control', 'Page Visibility', 'core', '👁️', async () => {
      const db = await loadAccessControl();
      const publicPages = Object.values(db.pages).filter((v) => v === 'public').length;
      return { message: `${publicPages} public pages`, metric: String(publicPages) };
    }),
    probe('terminal-stats', 'Terminal Stats API', 'core', '📡', async () => {
      const [usersDb, eventsDb] = await Promise.all([loadUsersDb(), loadEventsDb()]);
      const online = usersDb.users.filter((u) => isUserOnline(u)).length;
      return { message: 'Stats pipeline ready', metric: `${online} online` };
    }),

    probe('shoutbox', 'Shoutbox / Chat', 'community', '💬', async () => {
      const db = await loadLobbyDb();
      const count = db.messages?.length ?? 0;
      return { message: `${count} messages stored`, metric: String(count) };
    }),
    probe('leaderboards', 'Leaderboards', 'community', '🏆', async () => {
      const data = await buildLeaderboards();
      const boards = data.boards?.length ?? 0;
      return { message: `${boards} live boards`, metric: String(boards) };
    }),
    probe('news', 'News Feed', 'community', '📰', async () => {
      const feed = await listPublishedArticles();
      return { message: `${feed.articles?.length ?? 0} articles`, metric: feed.feedVersion ?? '—' };
    }),
    probe('post-views', 'Post View Tracking', 'community', '👀', async () => {
      const views = await getAllPostViews();
      const total = Object.values(views.changelog ?? {}).reduce((a, b) => a + Number(b), 0)
        + Object.values(views.news ?? {}).reduce((a, b) => a + Number(b), 0);
      return { message: 'Changelog & news views', metric: String(total) };
    }),

    probe('paste', 'Paste Service', 'content', '📋', async () => {
      const stats = await readPasteStats();
      return { message: `${stats.total ?? 0} pastes`, metric: String(stats.activePastes ?? 0) + ' active' };
    }),
    probe('image-host', 'Image Hosting', 'content', '☁️', async () => {
      const stats = await readImageStats();
      return {
        message: `${stats.imagesHosted ?? 0} images`,
        metric: `${stats.imageViewsTotal ?? 0} views`,
      };
    }),
    probe('page-views', 'Page View Counter', 'content', '📄', async () => {
      const views = await getAllPageViews();
      const pages = Object.keys(views.pages ?? {}).length;
      const total = Object.values(views.pages ?? {}).reduce((a, b) => a + Number(b), 0);
      return { message: `${pages} pages tracked`, metric: String(total) };
    }),

    probe('proxy-scraper', 'Proxy Scraper', 'network', '🕸️', async () => {
      const state = await loadProxyScraperState();
      const pool = state.uniqueProxies ?? state.totalScraped ?? 0;
      const status = (state.sourcesFailed ?? 0) > (state.sourcesOk ?? 0) ? 'degraded' : 'operational';
      return {
        status,
        message: `Pool ${pool} · ${state.sourcesOk ?? 0} sources OK`,
        metric: String(pool),
      };
    }),
    probe('proxy-checker', 'Proxy Checker', 'network', '✅', async () => {
      const state = await loadCheckerState();
      const status = !state.lastCheckAt && (state.totalChecked ?? 0) === 0 ? 'degraded' : 'operational';
      return {
        status,
        message: state.lastCheckAt ? 'Last check recorded' : 'No checks yet',
        metric: `${state.alive ?? 0} alive`,
      };
    }),
    probe('proxy-database', 'Proxy Database', 'network', '🗄️', async () => {
      const stats = await getDatabaseStats();
      const status = stats.inDatabase > 0 && stats.working === 0 ? 'degraded' : 'operational';
      return {
        status,
        message: `${stats.working ?? 0} working / ${stats.inDatabase ?? 0} stored`,
        metric: stats.nextDailyCheckDue ? 'check due' : 'checked',
      };
    }),
    probe('colon-db', 'Colon Scraper DB', 'network', '🔗', async () => {
      const stats = await getColonDbStats();
      return { message: `${stats.total ?? 0} U:P entries`, metric: `${stats.websites ?? 0} sites` };
    }),
    probe('persona-db', 'Persona Database', 'network', '🎭', async () => {
      const stats = await getPersonaStats();
      return { message: `${stats.total ?? 0} personas`, metric: `${stats.countries?.length ?? 0} countries` };
    }),

    probe('premium-vault', 'Premium Vault', 'vault', '👑', async () => {
      const stats = await getPublicAccountStats();
      const total = (stats.premium ?? 0) + (stats.free ?? 0);
      return { message: `${total} accounts in vault`, metric: `${stats.premium ?? 0} premium` };
    }),

    probe('storage', 'Data Storage', 'storage', '💾', async () => {
      const map = await buildAdminStorageMap();
      const mb = Math.round(map.totals.bytes / 1024 / 1024);
      return {
        message: `${map.totals.files} files · ${mb} MB`,
        metric: `${map.totals.stores} stores`,
      };
    }),
    probe('aggregates', 'Visitor Aggregates', 'storage', '🛰️', async () => {
      const agg = await loadAggregatesDb();
      const tabs = Object.keys(agg.tabHits ?? {}).length;
      return { message: `${tabs} tabs in heatmap`, metric: String(agg.visitorStats?.returnVisits ?? 0) + ' returns' };
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