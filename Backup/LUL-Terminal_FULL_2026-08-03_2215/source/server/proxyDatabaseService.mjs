/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { checkProxiesBatch } from './proxyScraperEngine.mjs';
import { loadDatabase, persistDatabase, saveDatabase, withProxyDbWrite } from './proxyDatabaseStore.mjs';

const STALE_OFFLINE_DAYS = 3;
const TYPES = ['http', 'https', 'socks4', 'socks5'];

let dailyCheckPromise = null;

export function proxyKey(proxy) {
  return `${proxy.type}:${proxy.host}:${proxy.port}`;
}

export function dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function emptyStats() {
  return {
    totalCollected: 0,
    working: 0,
    currentlyOffline: 0,
    byType: { http: 0, https: 0, socks4: 0, socks5: 0 },
    offlineByType: { http: 0, https: 0, socks4: 0, socks5: 0 },
    lastDailyCheckAt: null,
    lastDailyCheckDay: null,
    lastUpsertAt: null,
    totalRemovedStale: 0,
    nextDailyCheckDue: true,
  };
}

export function computeStats(db) {
  const working = db.proxies.filter((p) => p.status === 'working');
  const offline = db.proxies.filter((p) => p.status === 'offline');
  const byType = Object.fromEntries(TYPES.map((t) => [t, working.filter((p) => p.type === t).length]));
  const offlineByType = Object.fromEntries(TYPES.map((t) => [t, offline.filter((p) => p.type === t).length]));

  return {
    totalCollected: db.meta.totalEverCollected,
    working: working.length,
    currentlyOffline: offline.length,
    inDatabase: db.proxies.length,
    byType,
    offlineByType,
    lastDailyCheckAt: db.meta.lastDailyCheckAt,
    lastDailyCheckDay: db.meta.lastDailyCheckDay,
    lastUpsertAt: db.meta.lastUpsertAt,
    totalRemovedStale: db.meta.totalRemovedStale,
    nextDailyCheckDue: db.meta.lastDailyCheckDay !== dayKey(),
  };
}

export async function getDatabaseStats() {
  const db = await loadDatabase();
  return computeStats(db);
}

export async function getProxiesGrouped({ status, type } = {}) {
  const db = await loadDatabase();
  let list = [...db.proxies];

  if (status === 'working' || status === 'offline') {
    list = list.filter((p) => p.status === status);
  }
  if (type && TYPES.includes(type)) {
    list = list.filter((p) => p.type === type);
  }

  list.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'working' ? -1 : 1;
    const la = a.latency ?? 99999;
    const lb = b.latency ?? 99999;
    return la - lb;
  });

  const lists = Object.fromEntries(
    TYPES.map((t) => [
      t,
      list.filter((p) => p.type === t),
    ]),
  );

  return { lists, stats: computeStats(db) };
}

/** Insert/update ALL checked proxies — working + offline. Dedup by type:host:port. */
export async function upsertCheckedProxies(checkedProxies) {
  if (!checkedProxies?.length) return { added: 0, updated: 0, skipped: 0, total: 0 };

  return withProxyDbWrite(async () => {
  const db = await loadDatabase();
  const index = new Map(db.proxies.map((p, i) => [proxyKey(p), i]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const now = Date.now();
  const today = dayKey(now);

  for (const proxy of checkedProxies) {
    if (!proxy?.host || !proxy?.port || !proxy?.type) {
      skipped++;
      continue;
    }
    const key = proxyKey(proxy);
    const existingIdx = index.get(key);

    if (existingIdx === undefined) {
      const alive = Boolean(proxy.alive);
      db.proxies.push({
        id: key,
        host: proxy.host,
        port: proxy.port,
        type: proxy.type,
        raw: proxy.raw ?? `${proxy.host}:${proxy.port}`,
        status: alive ? 'working' : 'offline',
        latency: alive ? (proxy.latency ?? null) : null,
        anonymity: proxy.anonymity ?? null,
        supportsHttps: Boolean(proxy.supportsHttps),
        firstSeenAt: now,
        lastAliveAt: alive ? now : null,
        lastCheckedAt: now,
        consecutiveOfflineDays: alive ? 0 : 1,
        lastOfflineDay: alive ? null : today,
      });
      index.set(key, db.proxies.length - 1);
      db.meta.totalEverCollected += 1;
      added++;
      continue;
    }

    const existing = db.proxies[existingIdx];
    existing.lastCheckedAt = now;
    if (proxy.anonymity) existing.anonymity = proxy.anonymity;
    if (proxy.supportsHttps !== undefined) existing.supportsHttps = Boolean(proxy.supportsHttps);

    if (proxy.alive) {
      existing.status = 'working';
      existing.latency = proxy.latency ?? existing.latency;
      existing.lastAliveAt = now;
      existing.consecutiveOfflineDays = 0;
      existing.lastOfflineDay = null;
    } else {
      applyOfflineDay(existing, today);
    }
    updated++;
  }

  db.meta.lastUpsertAt = now;
  await persistDatabase(db);
  return { added, updated, skipped, total: db.proxies.length };
  });
}

export async function upsertWorkingProxies(aliveProxies) {
  if (!aliveProxies?.length) return { added: 0, updated: 0, total: 0 };

  return withProxyDbWrite(async () => {
  const db = await loadDatabase();
  const index = new Map(db.proxies.map((p, i) => [proxyKey(p), i]));
  let added = 0;
  let updated = 0;
  const now = Date.now();

  for (const proxy of aliveProxies) {
    if (!proxy?.host || !proxy?.port || !proxy?.alive) continue;
    const key = proxyKey(proxy);
    const existingIdx = index.get(key);

    if (existingIdx === undefined) {
      db.proxies.push({
        id: key,
        host: proxy.host,
        port: proxy.port,
        type: proxy.type,
        raw: proxy.raw ?? `${proxy.host}:${proxy.port}`,
        status: 'working',
        latency: proxy.latency ?? null,
        firstSeenAt: now,
        lastAliveAt: now,
        lastCheckedAt: now,
        consecutiveOfflineDays: 0,
        lastOfflineDay: null,
      });
      index.set(key, db.proxies.length - 1);
      db.meta.totalEverCollected += 1;
      added += 1;
      continue;
    }

    const existing = db.proxies[existingIdx];
    existing.status = 'working';
    existing.latency = proxy.latency ?? existing.latency;
    existing.lastAliveAt = now;
    existing.lastCheckedAt = now;
    existing.consecutiveOfflineDays = 0;
    existing.lastOfflineDay = null;
    updated += 1;
  }

  db.meta.lastUpsertAt = now;
  await persistDatabase(db);

  return { added, updated, total: db.proxies.length };
  });
}

function applyOfflineDay(proxy, today) {
  if (proxy.lastOfflineDay === today) return;

  if (!proxy.lastOfflineDay || proxy.status === 'working') {
    proxy.consecutiveOfflineDays = 1;
  } else {
    const prev = new Date(`${proxy.lastOfflineDay}T12:00:00Z`);
    const cur = new Date(`${today}T12:00:00Z`);
    const diffDays = Math.round((cur - prev) / 86400000);
    proxy.consecutiveOfflineDays = diffDays === 1
      ? (proxy.consecutiveOfflineDays ?? 0) + 1
      : 1;
  }

  proxy.status = 'offline';
  proxy.lastOfflineDay = today;
  proxy.latency = null;
}

export async function runDailyCheck({ force = false, timeoutMs = 5000, concurrency = 40 } = {}) {
  if (dailyCheckPromise) return dailyCheckPromise;

  dailyCheckPromise = runDailyCheckImpl({ force, timeoutMs, concurrency }).finally(() => {
    dailyCheckPromise = null;
  });
  return dailyCheckPromise;
}

async function runDailyCheckImpl({ force, timeoutMs, concurrency }) {
  const db = await loadDatabase();
  const today = dayKey();

  if (!force && db.meta.lastDailyCheckDay === today) {
    return { skipped: true, reason: 'already_checked_today', stats: computeStats(db) };
  }

  if (!db.proxies.length) {
    return withProxyDbWrite(async () => {
      const fresh = await loadDatabase();
      if (!force && fresh.meta.lastDailyCheckDay === today) {
        return { skipped: true, reason: 'already_checked_today', stats: computeStats(fresh) };
      }
      fresh.meta.lastDailyCheckAt = Date.now();
      fresh.meta.lastDailyCheckDay = today;
      await persistDatabase(fresh);
      return { skipped: false, checked: 0, removed: 0, working: 0, offline: 0, stats: computeStats(fresh) };
    });
  }

  const toCheck = db.proxies.map((p) => ({
    host: p.host,
    port: p.port,
    type: p.type,
    raw: p.raw,
  }));

  const results = await checkProxiesBatch(toCheck, {
    limit: toCheck.length,
    timeoutMs,
    concurrency,
    testUrl: 'http://www.google.com/generate_204',
  });

  const resultMap = new Map(results.map((r) => [proxyKey(r), r]));

  return withProxyDbWrite(async () => {
    const fresh = await loadDatabase();
    if (!force && fresh.meta.lastDailyCheckDay === today) {
      return { skipped: true, reason: 'already_checked_today', stats: computeStats(fresh) };
    }

    const kept = [];
    let removed = 0;
    let working = 0;
    let offline = 0;
    const now = Date.now();

    for (const proxy of fresh.proxies) {
      const result = resultMap.get(proxyKey(proxy));
      proxy.lastCheckedAt = now;

      if (result?.alive) {
        proxy.status = 'working';
        proxy.latency = result.latency ?? proxy.latency;
        proxy.lastAliveAt = now;
        proxy.consecutiveOfflineDays = 0;
        proxy.lastOfflineDay = null;
        working += 1;
        kept.push(proxy);
        continue;
      }

      applyOfflineDay(proxy, today);
      offline += 1;

      if (proxy.consecutiveOfflineDays > STALE_OFFLINE_DAYS) {
        removed += 1;
        fresh.meta.totalRemovedStale += 1;
        continue;
      }

      kept.push(proxy);
    }

    fresh.proxies = kept;
    fresh.meta.lastDailyCheckAt = now;
    fresh.meta.lastDailyCheckDay = today;
    await persistDatabase(fresh);

    return {
      skipped: false,
      checked: toCheck.length,
      working,
      offline,
      removed,
      stats: computeStats(fresh),
    };
  });
}

export function isDailyCheckDue(db) {
  return db.meta.lastDailyCheckDay !== dayKey();
}