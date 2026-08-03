/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionFetch } from './sessionFetch';
import type { ProxyType } from './proxyScraper';
import { formatProxyUrl } from './proxyScraper';

const API = '/api/proxy-db';

export type DbProxyStatus = 'working' | 'offline';

export type DatabaseProxy = {
  id: string;
  host: string;
  port: number;
  type: ProxyType;
  raw: string;
  status: DbProxyStatus;
  latency: number | null;
  firstSeenAt: number;
  lastAliveAt: number | null;
  lastCheckedAt: number | null;
  consecutiveOfflineDays: number;
  lastOfflineDay: string | null;
};

export type ProxyDatabaseStats = {
  totalCollected: number;
  working: number;
  currentlyOffline: number;
  inDatabase: number;
  byType: Record<ProxyType, number>;
  offlineByType: Record<ProxyType, number>;
  lastDailyCheckAt: number | null;
  lastDailyCheckDay: string | null;
  lastUpsertAt: number | null;
  totalRemovedStale: number;
  nextDailyCheckDue: boolean;
};

export type ProxyLists = Record<ProxyType, DatabaseProxy[]>;

export async function fetchProxyDatabaseStats(): Promise<ProxyDatabaseStats> {
  const res = await fetch(`${API}/stats`);
  if (!res.ok) throw new Error('Proxy database stats unavailable');
  return res.json() as Promise<ProxyDatabaseStats>;
}

export async function fetchProxyDatabaseLists(status: 'all' | DbProxyStatus = 'all'): Promise<{
  lists: ProxyLists;
  stats: ProxyDatabaseStats;
}> {
  const q = status === 'all' ? '' : `?status=${status}`;
  const res = await fetch(`${API}/lists${q}`);
  if (!res.ok) throw new Error('Proxy lists unavailable');
  return res.json() as Promise<{ lists: ProxyLists; stats: ProxyDatabaseStats }>;
}

export async function runProxyDailyCheck(force = false): Promise<{
  skipped: boolean;
  reason?: string;
  checked?: number;
  working?: number;
  offline?: number;
  removed?: number;
  stats?: ProxyDatabaseStats;
}> {
  const res = await sessionFetch(`${API}/daily-check`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Daily check failed');
  }
  return res.json();
}

export function formatDbProxyUrl(p: DatabaseProxy) {
  return formatProxyUrl(p);
}

export function exportDbTxt(proxies: DatabaseProxy[], workingOnly = true) {
  const list = workingOnly ? proxies.filter((p) => p.status === 'working') : proxies;
  return list.map((p) => formatDbProxyUrl(p)).join('\n');
}