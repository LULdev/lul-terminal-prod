/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionJson } from './sessionFetch';

export type BypassServiceKind = 'locker' | 'shortener' | 'paste' | 'unlock' | 'generic';

export type BypassServiceInfo = {
  id: string;
  label: string;
  kind: BypassServiceKind;
  hosts: string[];
};

export type BypassResult = {
  input: string;
  service: string;
  ok: boolean;
  destination: string | null;
  hops: string[];
  kind: 'url' | 'paste';
  pasteText: string | null;
  error: string | null;
};

export type BypassResponse = { results: BypassResult[] };

const API = '/api/bypass';

export async function fetchBypassCatalog(): Promise<BypassServiceInfo[]> {
  const data = await sessionJson<{ services: BypassServiceInfo[] }>(`${API}/catalog`, undefined, { soft401: true });
  return Array.isArray(data.services) ? data.services : [];
}

export async function runBypass(urls: string[]): Promise<BypassResult[]> {
  try {
    const data = await sessionJson<BypassResponse>(API, {
      method: 'POST',
      body: JSON.stringify({ urls }),
    });
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/permission denied|not logged|sign in/i.test(msg)) {
      throw new Error('Sign in required');
    }
    throw err;
  }
}

const LV_HOSTS = [
  'linkvertise.com',
  'linkvertise.net',
  'link-to.net',
  'linkvertise.download',
  'direct-link.net',
  'up-to-down.net',
  'file-link.net',
  'link-center.net',
  'link-target.net',
  'link-hub.net',
  'lvturbo.com',
  'linkvertise.io',
];

export function parseLocalUrls(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/\s+/).map((s) => s.trim()).filter(Boolean)) {
    const candidate = /^https?:\/\//i.test(part) ? part : `https://${part}`;
    try {
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (u.href.length > 2048) continue;
      if (seen.has(u.href)) continue;
      seen.add(u.href);
      out.push(u.href);
    } catch { /* skip */ }
    if (out.length >= 8) break;
  }
  return out;
}

export function guessServiceLabel(url: string, catalog: BypassServiceInfo[]): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    for (const svc of catalog) {
      if (svc.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return svc.label;
    }
    if (LV_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return 'Linkvertise';
  } catch { /* ignore */ }
  return null;
}

const HISTORY_KEY = 'lul_bypass_history';
const HISTORY_MAX = 20;

export type BypassHistoryItem = {
  at: number;
  input: string;
  destination: string | null;
  ok: boolean;
  service: string;
};

export function loadBypassHistory(): BypassHistoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BypassHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === 'object' && typeof x.input === 'string')
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

export function pushBypassHistory(items: BypassHistoryItem[]): BypassHistoryItem[] {
  const prev = loadBypassHistory();
  const next = [...items, ...prev].slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* quota */ }
  return next;
}

export function clearBypassHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch { /* ignore */ }
}
