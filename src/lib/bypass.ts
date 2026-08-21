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
  const data = await sessionJson<BypassResponse>(API, {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });
  return Array.isArray(data.results) ? data.results : [];
}

export function parseLocalUrls(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
    .filter((s) => {
      try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    })
    .slice(0, 8);
}

export function guessServiceLabel(url: string, catalog: BypassServiceInfo[]): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    for (const svc of catalog) {
      if (svc.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return svc.label;
    }
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
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BypassHistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_MAX) : [];
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
