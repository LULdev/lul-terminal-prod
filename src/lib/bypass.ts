/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseRetryAfterMs } from './retryAfter';
import { sessionFetch, sessionJson } from './sessionFetch';

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

function isAbortError(err: unknown): boolean {
  return (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError';
}

export async function runBypass(urls: string[], signal?: AbortSignal): Promise<BypassResult[]> {
  try {
    const res = await sessionFetch(API, {
      method: 'POST',
      body: JSON.stringify({ urls }),
      signal,
    });
    const data = (await res.json().catch(() => ({}))) as BypassResponse & { error?: string };
    if (res.status === 429) {
      const sec = Math.max(1, Math.ceil(parseRetryAfterMs(res.headers.get('Retry-After')) / 1000));
      throw new Error(`Too many requests — retry in ${sec}s.`);
    }
    if (!res.ok) {
      const msg = String(data.error ?? `HTTP ${res.status}`);
      if (/permission denied|not logged|sign in/i.test(msg)) throw new Error('Sign in required');
      throw new Error(msg);
    }
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw err;
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
  for (const part of raw.split(/\s+/).map((s) => s.trim().replace(/^["'<\[]+|["'>\]]+$/g, '').replace(/[,\s]+$/g, '')).filter(Boolean)) {
    let candidate = part;
    if (!/^https?:\/\//i.test(candidate) && /^[\w.-]+\.[a-z]{2,}/i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    if (!/^https?:\/\//i.test(candidate)) continue;
    try {
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (u.username || u.password) continue;
      if (isBlockedOpenHost(u.hostname)) continue;
      if (u.href.length > 2048) continue;
      if (seen.has(u.href)) continue;
      seen.add(u.href);
      out.push(u.href);
    } catch { /* skip */ }
    if (out.length >= 8) break;
  }
  return out;
}

function isBlockedOpenHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h || h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }
  if (h.includes(':')) {
    if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('ff')) return true;
    if (h.startsWith('::ffff:')) return isBlockedOpenHost(h.slice(7));
  }
  return false;
}

/** http(s) only, no credentials, no loopback/private — for the Open button. */
export function safeBypassOpenHref(href: string | null | undefined): string | null {
  const raw = String(href ?? '').trim();
  if (!raw || raw.startsWith('/') || raw.startsWith('\\') || raw.startsWith('//')) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (isBlockedOpenHost(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
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
  const incoming = items.filter((x) => x && typeof x.input === 'string');
  const seen = new Set(incoming.map((x) => x.input));
  const prev = loadBypassHistory().filter((p) => !seen.has(p.input));
  const next = [...incoming, ...prev].slice(0, HISTORY_MAX);
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
