/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Visitor profile tracking — referrers, return visits, device/locale aggregates.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_FILE = path.join(__dirname, '..', 'data', 'analytics', 'visitor-profiles.json');
const MAX_PROFILES = 3000;

const EMPTY_PROFILES = {
  version: 1,
  updatedAt: null,
  profiles: {},
};

function visitorKey(event) {
  return event.userId ? `u:${event.userId}` : event.guestId ? `g:${event.guestId}` : null;
}

function bumpCounter(map, key, inc = 1) {
  if (!key || key === 'unknown' || key === 'direct') return;
  map[key] = (map[key] ?? 0) + inc;
}

function pickMeta(meta, key) {
  const v = meta?.[key];
  if (v === undefined || v === null || v === '') return null;
  return v;
}

async function profilesFileExists() {
  try {
    await fs.access(PROFILES_FILE);
    return true;
  } catch {
    return false;
  }
}

export async function loadVisitorProfiles() {
  await fs.mkdir(path.dirname(PROFILES_FILE), { recursive: true });
  if (!(await profilesFileExists())) return structuredClone(EMPTY_PROFILES);
  try {
    const raw = await fs.readFile(PROFILES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      ...EMPTY_PROFILES,
      ...data,
      profiles: data.profiles && typeof data.profiles === 'object' ? data.profiles : {},
    };
  } catch (err) {
    console.error('[visitor-tracking] CRITICAL: visitor-profiles.json unreadable', err);
    throw new Error('Visitor profiles unavailable');
  }
}

async function saveVisitorProfiles(db) {
  await fs.mkdir(path.dirname(PROFILES_FILE), { recursive: true });
  db.updatedAt = new Date().toISOString();
  const tmp = `${PROFILES_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, PROFILES_FILE);
}

/**
 * Upsert visitor profile on session_start.
 * Must NOT take withAnalyticsWrite — callers (recordEvent) already hold that lock.
 * Nesting the chain would deadlock.
 */
export async function upsertVisitorProfile(event) {
  if (event.type !== 'session_start') return;
  const key = visitorKey(event);
  if (!key) return;

  const db = await loadVisitorProfiles();
  const m = event.meta ?? {};
  const now = event.ts ?? Date.now();
  const existing = db.profiles[key];

  const profile = existing ?? {
    key,
    userId: event.userId ?? null,
    guestId: event.guestId ?? null,
    username: event.username ?? null,
    firstSeenAt: now,
    visitCount: 0,
    sessionCount: 0,
    referrers: {},
    referrerDomains: {},
    devices: {},
    languages: {},
    timezones: {},
    landingPaths: {},
    utmSources: {},
    lastMeta: {},
  };

  profile.lastSeenAt = now;
  profile.sessionCount += 1;
  profile.visitCount = profile.sessionCount;
  profile.username = event.username ?? profile.username;
  profile.userId = event.userId ?? profile.userId;
  profile.guestId = event.guestId ?? profile.guestId;
  profile.lastReferrer = pickMeta(m, 'referrer') ?? profile.lastReferrer ?? '';
  profile.lastReferrerDomain = pickMeta(m, 'referrerDomain') ?? profile.lastReferrerDomain ?? 'direct';
  profile.lastLandingUrl = pickMeta(m, 'landingUrl') ?? profile.lastLandingUrl ?? '';
  profile.lastLandingPath = pickMeta(m, 'landingPath') ?? profile.lastLandingPath ?? '';
  profile.returnVisitor = Boolean(m.returnVisitor);
  profile.lastMeta = { ...m };

  const refDom = String(m.referrerDomain ?? 'direct');
  profile.referrerDomains[refDom] = (profile.referrerDomains[refDom] ?? 0) + 1;
  if (m.referrer) {
    const ref = String(m.referrer).slice(0, 120);
    profile.referrers[ref] = (profile.referrers[ref] ?? 0) + 1;
  }
  if (m.deviceType) profile.devices[String(m.deviceType)] = (profile.devices[String(m.deviceType)] ?? 0) + 1;
  if (m.language) profile.languages[String(m.language)] = (profile.languages[String(m.language)] ?? 0) + 1;
  if (m.timezone) profile.timezones[String(m.timezone)] = (profile.timezones[String(m.timezone)] ?? 0) + 1;
  if (m.landingPath) profile.landingPaths[String(m.landingPath)] = (profile.landingPaths[String(m.landingPath)] ?? 0) + 1;
  if (m.utmSource) profile.utmSources[String(m.utmSource)] = (profile.utmSources[String(m.utmSource)] ?? 0) + 1;

  db.profiles[key] = profile;

  const keys = Object.keys(db.profiles);
  if (keys.length > MAX_PROFILES) {
    const sorted = keys.sort((a, b) => (db.profiles[b].lastSeenAt ?? 0) - (db.profiles[a].lastSeenAt ?? 0));
    for (const drop of sorted.slice(MAX_PROFILES)) delete db.profiles[drop];
  }

  await saveVisitorProfiles(db);
  return profile;
}

export async function bumpVisitorAggregates(agg, event) {
  if (!agg.visitorStats) {
    agg.visitorStats = {
      returnVisits: 0,
      newVisits: 0,
      referrerDomains: {},
      referrerTypes: {},
      devices: {},
      languages: {},
      timezones: {},
      connections: {},
      colorSchemes: {},
      landingPaths: {},
      utmSources: {},
      utmMediums: {},
      utmCampaigns: {},
      platforms: {},
    };
  }
  const vs = agg.visitorStats;
  const m = event.meta ?? {};

  if (event.type === 'session_start') {
    if (m.returnVisitor) vs.returnVisits += 1;
    else vs.newVisits += 1;
    bumpCounter(vs.referrerDomains, m.referrerDomain);
    bumpCounter(vs.referrerTypes, m.referrerType);
    bumpCounter(vs.devices, m.deviceType);
    bumpCounter(vs.languages, m.language);
    bumpCounter(vs.timezones, m.timezone);
    bumpCounter(vs.connections, m.connection);
    bumpCounter(vs.colorSchemes, m.colorScheme);
    bumpCounter(vs.platforms, m.platform);
    bumpCounter(vs.landingPaths, m.landingPath);
    bumpCounter(vs.utmSources, m.utmSource);
    bumpCounter(vs.utmMediums, m.utmMedium);
    bumpCounter(vs.utmCampaigns, m.utmCampaign);
  }

  if (event.type === 'tab_dwell') {
    if (!agg.dwellByTab) agg.dwellByTab = {};
    const tab = event.tab || 'unknown';
    const sec = Number(m.dwellSec) || 0;
    if (sec > 0) {
      if (!agg.dwellByTab[tab]) agg.dwellByTab[tab] = { totalSec: 0, count: 0 };
      agg.dwellByTab[tab].totalSec += sec;
      agg.dwellByTab[tab].count += 1;
    }
  }
}

function topEntries(map, limit = 12) {
  return Object.entries(map ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function visitorOverviewFromProfiles(profiles) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const active24h = profiles.filter((p) => (p.lastSeenAt ?? 0) >= dayAgo);
  const returnVisitors = profiles.filter((p) => (p.visitCount ?? 0) > 1);
  const avgVisits = profiles.length
    ? Math.round((profiles.reduce((s, p) => s + (p.visitCount ?? 1), 0) / profiles.length) * 10) / 10
    : 0;
  return {
    totalProfiles: profiles.length,
    activeLast24h: active24h.length,
    returnVisitorCount: returnVisitors.length,
    newVisitorCount: profiles.length - returnVisitors.length,
    avgVisitsPerVisitor: avgVisits,
  };
}

export async function buildVisitorOverview() {
  const db = await loadVisitorProfiles();
  const profiles = Object.values(db.profiles);
  const overview = visitorOverviewFromProfiles(profiles);

  const recent = [...profiles]
    .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0))
    .slice(0, 40)
    .map((p) => ({
      key: p.key,
      username: p.username,
      userId: p.userId,
      guestId: p.guestId,
      visitCount: p.visitCount ?? 1,
      sessionCount: p.sessionCount ?? 1,
      returnVisitor: (p.visitCount ?? 1) > 1,
      lastReferrerDomain: p.lastReferrerDomain ?? 'direct',
      lastReferrer: p.lastReferrer ?? '',
      lastLandingPath: p.lastLandingPath ?? '',
      lastLandingUrl: p.lastLandingUrl ?? '',
      deviceType: p.lastMeta?.deviceType ?? 'unknown',
      language: p.lastMeta?.language ?? '',
      timezone: p.lastMeta?.timezone ?? '',
      lastSeenAt: p.lastSeenAt,
      firstSeenAt: p.firstSeenAt,
      utmSource: p.lastMeta?.utmSource ?? '',
      refCode: p.lastMeta?.refCode ?? '',
    }));

  return {
    ...overview,
    recentVisitors: recent,
  };
}

export function analyzeVisitorFromEvents(events) {
  const sessionStarts = events.filter((e) => e.type === 'session_start');
  const referrers = {};
  const referrerDomains = {};
  const devices = {};
  const landingPaths = {};
  let totalVisits = 0;
  let maxVisitCount = 0;
  let lastSession = null;

  for (const e of sessionStarts) {
    const m = e.meta ?? {};
    totalVisits += 1;
    const vc = Number(m.visitCount) || 1;
    if (vc > maxVisitCount) maxVisitCount = vc;
    if (!lastSession || e.ts > lastSession.ts) lastSession = { ...m, ts: e.ts };
    if (m.referrerDomain) referrerDomains[m.referrerDomain] = (referrerDomains[m.referrerDomain] ?? 0) + 1;
    if (m.referrer) referrers[String(m.referrer).slice(0, 120)] = (referrers[String(m.referrer).slice(0, 120)] ?? 0) + 1;
    if (m.deviceType) devices[m.deviceType] = (devices[m.deviceType] ?? 0) + 1;
    if (m.landingPath) landingPaths[m.landingPath] = (landingPaths[m.landingPath] ?? 0) + 1;
  }

  return {
    sessionCount: sessionStarts.length,
    maxVisitCount,
    lastSession,
    referrerDomains: topEntries(referrerDomains, 8),
    referrers: topEntries(referrers, 6),
    devices: topEntries(devices, 4),
    landingPaths: topEntries(landingPaths, 6),
  };
}

export async function getVisitorProfile(key) {
  const db = await loadVisitorProfiles();
  return db.profiles[key] ?? null;
}

export async function adminListVisitorProfiles({ limit = 80, q } = {}) {
  const cap = Math.min(200, Math.max(1, Number(limit) || 80));
  const db = await loadVisitorProfiles();
  let profiles = Object.values(db.profiles);

  if (q) {
    const needle = String(q).toLowerCase();
    profiles = profiles.filter(
      (p) =>
        (p.key ?? '').toLowerCase().includes(needle) ||
        (p.username ?? '').toLowerCase().includes(needle) ||
        (p.guestId ?? '').toLowerCase().includes(needle) ||
        (p.lastReferrerDomain ?? '').toLowerCase().includes(needle) ||
        (p.lastLandingPath ?? '').toLowerCase().includes(needle) ||
        (p.lastMeta?.utmSource ?? '').toLowerCase().includes(needle),
    );
  }

  profiles.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  const overview = visitorOverviewFromProfiles(profiles);

  return {
    total: profiles.length,
    profiles: profiles.slice(0, cap).map((p) => ({
      key: p.key,
      username: p.username,
      userId: p.userId,
      guestId: p.guestId,
      visitCount: p.visitCount ?? 1,
      sessionCount: p.sessionCount ?? 1,
      returnVisitor: (p.visitCount ?? 1) > 1,
      lastReferrerDomain: p.lastReferrerDomain ?? 'direct',
      lastReferrer: p.lastReferrer ?? '',
      lastLandingPath: p.lastLandingPath ?? '',
      deviceType: p.lastMeta?.deviceType ?? 'unknown',
      language: p.lastMeta?.language ?? '',
      timezone: p.lastMeta?.timezone ?? '',
      utmSource: p.lastMeta?.utmSource ?? '',
      refCode: p.lastMeta?.refCode ?? '',
      firstSeenAt: p.firstSeenAt,
      lastSeenAt: p.lastSeenAt,
    })),
    overview: {
      totalProfiles: overview.totalProfiles,
      activeLast24h: overview.activeLast24h,
      returnVisitorCount: overview.returnVisitorCount,
      avgVisitsPerVisitor: overview.avgVisitsPerVisitor,
    },
  };
}

export { topEntries };