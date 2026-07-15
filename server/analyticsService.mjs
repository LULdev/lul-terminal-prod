/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Private-use analytics — event log + aggregates.
 */

import crypto from 'crypto';
import { loadUsersDb } from './auth/authStore.mjs';
import { isUserOnline, localDayStart, ONLINE_WINDOW_MS } from './profileStats.mjs';
import { ensureActivity, userAchievementIds } from './auth/achievements.mjs';
import { getAllPostViews } from './postViewsStore.mjs';
import { loadState as loadProxyState } from './proxyScraperStore.mjs';
import { loadCheckerState } from './proxyCheckerStore.mjs';
import {
  loadAggregatesDb,
  loadEventsDb,
  MAX_EVENTS,
  saveAggregatesDb,
  saveEventsDb,
  withAnalyticsWrite,
} from './analyticsStore.mjs';
import {
  analyzeVisitorFromEvents,
  buildVisitorOverview,
  bumpVisitorAggregates,
  getVisitorProfile,
  topEntries,
  upsertVisitorProfile,
} from './visitorTracking.mjs';

function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

export const ALLOWED_ANALYTICS_TYPES = new Set([
  'session_start',
  'session_end',
  'tab_visit',
  'tab_dwell',
  'profile_view',
  'command_run',
  'login',
  'logout',
  'faq_visit',
  'search',
  'feature_use',
]);

const META_URL_KEYS = new Set(['referrer', 'landingUrl', 'landingPath', 'languages']);

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = String(k).slice(0, 40);
    if (typeof v === 'string') {
      out[key] = v.slice(0, META_URL_KEYS.has(key) ? 256 : 120);
    } else if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

async function bumpAggregates(event) {
  const agg = await loadAggregatesDb();
  const dk = dayKey(event.ts);
  if (!agg.daily[dk]) {
    agg.daily[dk] = { events: 0, uniqueUsers: [], logins: 0, tabVisits: 0 };
  }
  const day = agg.daily[dk];
  day.events = (day.events ?? 0) + 1;
  if (event.userId && !day.uniqueUsers.includes(event.userId)) {
    day.uniqueUsers.push(event.userId);
  }
  if (event.type === 'login') day.logins = (day.logins ?? 0) + 1;
  if (event.type === 'tab_visit' && event.tab) day.tabVisits = (day.tabVisits ?? 0) + 1;

  agg.eventCounts[event.type] = (agg.eventCounts[event.type] ?? 0) + 1;
  if (event.tab) {
    agg.tabHits[event.tab] = (agg.tabHits[event.tab] ?? 0) + 1;
  }

  await bumpVisitorAggregates(agg, event);

  const keys = Object.keys(agg.daily).sort();
  if (keys.length > 90) {
    for (const old of keys.slice(0, keys.length - 90)) delete agg.daily[old];
  }

  await saveAggregatesDb(agg);
}

export async function recordEvent(input) {
  const {
    type,
    userId = null,
    username = null,
    guestId = null,
    sessionId = null,
    tab = null,
    meta = {},
  } = input;

  if (!type) return null;
  const normalizedType = String(type).slice(0, 48);
  if (!ALLOWED_ANALYTICS_TYPES.has(normalizedType)) return null;

  const event = {
    id: crypto.randomBytes(6).toString('hex'),
    type: normalizedType,
    userId: userId ? String(userId).slice(0, 48) : null,
    username: username ? String(username).slice(0, 48) : null,
    guestId: guestId ? String(guestId).slice(0, 48) : null,
    sessionId: sessionId ? String(sessionId).slice(0, 48) : null,
    tab: tab ? String(tab).slice(0, 24) : null,
    meta: sanitizeMeta(meta),
    ts: Date.now(),
  };

  return withAnalyticsWrite(async () => {
    const db = await loadEventsDb();
    db.events.push(event);
    if (db.events.length > MAX_EVENTS) {
      db.events = db.events.slice(-MAX_EVENTS);
    }
    await saveEventsDb(db);
    await bumpAggregates(event);
    await upsertVisitorProfile(event);
    return event;
  });
}

function analyzeUserEvents(events) {
  const tabBreakdown = {};
  const eventBreakdown = {};
  const sessions = new Set();
  const commands = [];
  const profileTargets = {};
  let firstEventAt = null;
  let lastEventAt = null;

  for (const e of events) {
    if (e.type) eventBreakdown[e.type] = (eventBreakdown[e.type] ?? 0) + 1;
    if (e.tab) tabBreakdown[e.tab] = (tabBreakdown[e.tab] ?? 0) + 1;
    if (e.sessionId) sessions.add(e.sessionId);
    if (e.type === 'command_run' && e.meta?.cmd) {
      commands.push({ cmd: String(e.meta.cmd), ts: e.ts });
    }
    if (e.type === 'profile_view' && e.meta?.target) {
      const target = String(e.meta.target);
      profileTargets[target] = (profileTargets[target] ?? 0) + 1;
    }
    if (!firstEventAt || e.ts < firstEventAt) firstEventAt = e.ts;
    if (!lastEventAt || e.ts > lastEventAt) lastEventAt = e.ts;
  }

  return {
    tabBreakdown: Object.entries(tabBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([tab, count]) => ({ tab, count })),
    eventBreakdown: Object.entries(eventBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count })),
    sessionCount: sessions.size,
    totalEvents: events.length,
    firstEventAt,
    lastEventAt,
    recentCommands: commands.slice(-15).reverse(),
    profileTargets: Object.entries(profileTargets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([target, count]) => ({ target, count })),
  };
}

const EXPORT_EPHEMERAL_FLAGS = new Set([
  'achProofNonce',
  'achProofExp',
  'achProofTab',
  'lastMemeBotAt',
  'lastChatActionAt',
  'lastAchievementEventAt',
  'lastTerminalCommandAt',
]);

function sanitizeActivityFlags(flags) {
  const out = { ...(flags ?? {}) };
  for (const key of EXPORT_EPHEMERAL_FLAGS) delete out[key];
  for (const key of Object.keys(out)) {
    if (key.startsWith('claw_daily_') || key.startsWith('terminal_cmd_daily_')) delete out[key];
  }
  return out;
}

function redactUserActivityRow(row) {
  if (!row) return row;
  const { email, ...rest } = row;
  return rest;
}

function sanitizeExportEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const out = { ...event };
  delete out.email;
  if (out.meta && typeof out.meta === 'object') {
    const meta = { ...out.meta };
    delete meta.email;
    delete meta.password;
    out.meta = meta;
  }
  return out;
}

function userActivityRow(user) {
  const act = ensureActivity(user);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    verified: user.verified,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    lastSeenAt: user.lastSeenAt,
    onlineMinutes: user.onlineMinutes ?? 0,
    profileViews: user.profileViews ?? 0,
    imagesUploaded: user.imagesUploaded ?? 0,
    memesCreated: user.memesCreated ?? 0,
    pastesCreated: user.pastesCreated ?? 0,
    pasteViewsTotal: user.pasteViewsTotal ?? 0,
    referralsCount: user.referralsCount ?? 0,
    website: user.website ?? null,
    isOnline: isUserOnline(user),
    activity: {
      loginCount: act.loginCount,
      commandsRun: act.commandsRun,
      pageVisits: act.pageVisits,
      profileVisits: act.profileVisits,
      shoutboxSent: act.shoutboxSent,
      changelogReads: act.changelogReads,
      changelogLastReadVersion: act.changelogLastReadVersion,
      newsReads: act.newsReads,
      newsLastReadVersion: act.newsLastReadVersion,
      tabsVisited: act.tabsVisited ?? [],
      flags: sanitizeActivityFlags(act.flags),
    },
    achievements: userAchievementIds(user.achievements).length,
    achievementIds: userAchievementIds(user.achievements),
  };
}

export async function buildUserActivitySummary(userId) {
  const db = await loadUsersDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;

  const eventsDb = await loadEventsDb();
  const userEvents = eventsDb.events.filter((e) => e.userId === userId);
  const recentEvents = userEvents.slice(-80).reverse();
  const visitorProfile = await getVisitorProfile(`u:${userId}`);

  return {
    user: userActivityRow(user),
    recentEvents,
    insights: {
      ...analyzeUserEvents(userEvents),
      visitor: analyzeVisitorFromEvents(userEvents),
      visitorProfile,
    },
  };
}

export async function buildAdminOverview() {
  const [usersDb, eventsDb, agg, postViews, proxyState, checkerState] = await Promise.all([
    loadUsersDb(),
    loadEventsDb(),
    loadAggregatesDb(),
    getAllPostViews().catch(() => ({ changelog: {}, news: {} })),
    loadProxyState().catch(() => ({})),
    loadCheckerState().catch(() => ({})),
  ]);

  const users = usersDb.users.filter((u) => u.role !== 'bot' && u.active !== false);
  const now = Date.now();
  const today = dayKey(now);
  const todayStart = localDayStart(now);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const onlineUsers = users.filter((u) => isUserOnline(u));
  const newUsersWeek = users.filter((u) => (u.createdAt ?? 0) >= weekAgo);
  const activeToday = users.filter((u) => {
    const seen = Number(u.lastSeenAt) || Number(u.lastLoginAt) || 0;
    return seen >= todayStart;
  });

  const tabHits = Object.entries(agg.tabHits ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tab, count]) => ({ tab, count }));

  const eventCounts = Object.entries(agg.eventCounts ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  const dailySeries = Object.entries(agg.daily ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, d]) => ({
      date,
      events: d.events ?? 0,
      uniqueUsers: (d.uniqueUsers ?? []).length,
      logins: d.logins ?? 0,
      tabVisits: d.tabVisits ?? 0,
    }));

  const changelogViews = Object.values(postViews.changelog ?? {}).reduce((a, b) => a + Number(b), 0);
  const newsViews = Object.values(postViews.news ?? {}).reduce((a, b) => a + Number(b), 0);

  const leaderboard = users
    .map(userActivityRow)
    .sort((a, b) => b.activity.pageVisits - a.activity.pageVisits)
    .slice(0, 20);

  const vs = agg.visitorStats ?? {};
  const dwellByTab = Object.entries(agg.dwellByTab ?? {})
    .map(([tab, d]) => ({
      tab,
      avgSec: d.count ? Math.round(d.totalSec / d.count) : 0,
      totalSec: d.totalSec ?? 0,
      visits: d.count ?? 0,
    }))
    .sort((a, b) => b.totalSec - a.totalSec)
    .slice(0, 12);

  const visitorOverview = await buildVisitorOverview();

  return {
    generatedAt: now,
    disclaimer: 'Private use · local analytics',
    totals: {
      users: users.length,
      onlineNow: onlineUsers.length,
      newUsersWeek: newUsersWeek.length,
      activeToday: activeToday.length,
      eventsStored: eventsDb.events.length,
    },
    engagement: {
      totalPageVisits: users.reduce((s, u) => s + (ensureActivity(u).pageVisits ?? 0), 0),
      totalCommands: users.reduce((s, u) => s + (ensureActivity(u).commandsRun ?? 0), 0),
      totalShoutbox: users.reduce((s, u) => s + (ensureActivity(u).shoutboxSent ?? 0), 0),
      totalOnlineMinutes: users.reduce((s, u) => s + (u.onlineMinutes ?? 0), 0),
      changelogViews,
      newsViews,
    },
    system: {
      proxyPool: proxyState.totalScraped ?? proxyState.uniqueProxies ?? 0,
      proxySourcesOk: proxyState.sourcesOk ?? 0,
      proxySourcesFailed: proxyState.sourcesFailed ?? 0,
      lastProxyCheck: checkerState.lastCheckAt ?? null,
      proxyAlive: checkerState.alive ?? 0,
    },
    tabHits,
    eventCounts,
    dailySeries,
    onlineUsers: onlineUsers.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      lastSeenAt: u.lastSeenAt,
    })),
    recentEvents: eventsDb.events.slice(-60).reverse(),
    leaderboard,
    onlineWindowMs: ONLINE_WINDOW_MS,
    visitorIntelligence: {
      ...visitorOverview,
      returnVisits: vs.returnVisits ?? 0,
      newVisits: vs.newVisits ?? 0,
      referrerDomains: topEntries(vs.referrerDomains),
      referrerTypes: topEntries(vs.referrerTypes),
      devices: topEntries(vs.devices),
      languages: topEntries(vs.languages),
      timezones: topEntries(vs.timezones),
      connections: topEntries(vs.connections),
      colorSchemes: topEntries(vs.colorSchemes),
      platforms: topEntries(vs.platforms),
      landingPaths: topEntries(vs.landingPaths),
      utmSources: topEntries(vs.utmSources),
      utmMediums: topEntries(vs.utmMediums),
      utmCampaigns: topEntries(vs.utmCampaigns),
      dwellByTab,
    },
  };
}

export async function listAdminUserActivity({ search, limit = 100 } = {}) {
  const db = await loadUsersDb();
  let list = db.users.filter((u) => u.role !== 'bot').map(userActivityRow);
  const q = search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (u) =>
        u.username.includes(q) ||
        (u.displayName ?? '').toLowerCase().includes(q),
    );
  }
  list.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  return { users: list.slice(0, Math.min(limit, 500)), total: list.length };
}

export async function exportAnalyticsBundle() {
  const [events, aggregates, overview] = await Promise.all([
    loadEventsDb(),
    loadAggregatesDb(),
    buildAdminOverview(),
  ]);
  return {
    exportedAt: Date.now(),
    events: events.events.map(sanitizeExportEvent),
    aggregates,
    overview: {
      ...overview,
      leaderboard: (overview.leaderboard ?? []).map(redactUserActivityRow),
    },
  };
}

export async function purgeOldEvents(keep = 2000) {
  const capped = Math.max(1, Math.min(Number(keep) || 2000, MAX_EVENTS));
  return withAnalyticsWrite(async () => {
    const db = await loadEventsDb();
    const before = db.events.length;
    db.events = db.events.slice(-capped);
    await saveEventsDb(db);
    return { before, after: db.events.length, removed: before - db.events.length };
  });
}

export async function listActiveTodayUsers(limit = 48) {
  const db = await loadUsersDb();
  const users = db.users.filter((u) => u.role !== 'bot' && u.active !== false);
  const now = Date.now();
  const today = dayKey(now);
  const todayStart = localDayStart(now);

  const allActive = users
    .filter((u) => {
      const seen = Number(u.lastSeenAt) || Number(u.lastLoginAt) || 0;
      return seen >= todayStart;
    })
    .sort((a, b) => {
      const aOnline = isUserOnline(a);
      const bOnline = isUserOnline(b);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      const aSeen = Number(a.lastSeenAt) || Number(a.lastLoginAt) || 0;
      const bSeen = Number(b.lastSeenAt) || Number(b.lastLoginAt) || 0;
      return bSeen - aSeen;
    });

  const onlineNow = users.filter((u) => isUserOnline(u)).length;

  return {
    date: today,
    count: allActive.length,
    onlineNow,
    users: allActive.slice(0, Math.min(limit, 80)).map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      role: u.role,
      verified: Boolean(u.verified),
      isOnline: isUserOnline(u),
      lastSeenAt: Number(u.lastSeenAt) || Number(u.lastLoginAt) || null,
    })),
  };
}