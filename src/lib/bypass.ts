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
  if (!Array.isArray(data.services)) return [];
  return data.services
    .filter((s) => s && typeof s.id === 'string' && typeof s.label === 'string')
    .slice(0, 80)
    .map((s) => ({
      id: s.id.slice(0, 32),
      label: s.label.slice(0, 64),
      kind: (['locker', 'shortener', 'paste', 'unlock', 'generic'] as const).includes(
        s.kind as BypassServiceKind,
      )
        ? (s.kind as BypassServiceKind)
        : 'generic',
      hosts: Array.isArray(s.hosts)
        ? s.hosts
            .filter((h) => typeof h === 'string' && h.length > 0 && h.length <= 128)
            .map((h) => h.slice(0, 64).toLowerCase())
            .slice(0, 12)
        : [],
    }));
}

function isAbortError(err: unknown): boolean {
  return (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError';
}

function normalizeBypassResult(raw: BypassResult): BypassResult {
  const input = typeof raw?.input === 'string' ? raw.input.slice(0, 2048) : '';
  const dest = typeof raw?.destination === 'string' ? raw.destination.slice(0, 2048) : null;
  const pasteRaw = typeof raw?.pasteText === 'string' ? raw.pasteText.slice(0, 8000) : null;
  const paste = pasteRaw && pasteRaw.trim() ? pasteRaw : null;
  const hops = Array.isArray(raw?.hops)
    ? raw.hops.filter((h) => typeof h === 'string').map((h) => h.slice(0, 2048)).slice(0, 8)
    : [];
  const openOk = dest ? Boolean(safeBypassOpenHref(dest)) && !isBypassLockerDest(dest) : false;
  const ok = Boolean(raw?.ok) && (openOk || Boolean(paste));
  return {
    input,
    service: typeof raw?.service === 'string' ? raw.service.slice(0, 32) : 'unknown',
    ok,
    destination: openOk ? dest : null,
    hops,
    kind: raw?.kind === 'paste' || paste ? 'paste' : 'url',
    pasteText: paste,
    error: ok ? null : (typeof raw?.error === 'string' ? raw.error.slice(0, 200) : (dest && !openOk ? 'Destination is not allowed' : 'Bypass failed')),
  };
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
    const ct = String(res.headers.get('content-type') ?? '').toLowerCase();
    if (!res.ok) {
      const msg = String(data.error ?? `HTTP ${res.status}`).slice(0, 200);
      if (/permission denied|not logged|sign in/i.test(msg)) throw new Error('Sign in required');
      throw new Error(msg);
    }
    if (!ct.includes('json')) throw new Error('Bypass failed');
    const list = (Array.isArray(data.results) ? data.results : []).slice(0, 8).map(normalizeBypassResult);
    if (!list.length) throw new Error('Bypass failed');
    return list;
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw err;
    if (err instanceof Error && err.name === 'SessionExpiredError') throw new Error('Sign in required');
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

function dottedPrivate(a: number, b: number): boolean {
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function mapped6RestToV4(rest: string): string {
  if (rest.includes('.')) return rest;
  const hex = rest.split(':');
  if (hex.length === 2 && hex.every((p) => /^[0-9a-f]{1,4}$/i.test(p))) {
    const n = ((Number.parseInt(hex[0], 16) << 16) + Number.parseInt(hex[1], 16)) >>> 0;
    return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
  }
  return rest;
}

function isBlockedOpenHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h || h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal') || h === 'metadata' || h.endsWith('.metadata.google.internal')) return true;
  // Integer / hex / short / octal IPv4 — browsers may map these to loopback
  if (/^0x[0-9a-f]+$/i.test(h) || /^\d+$/.test(h)) return true;
  if (/^\d+\.\d+$/.test(h) || /^\d+\.\d+\.\d+$/.test(h)) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    if (m.slice(1).some((p) => /^0\d+$/.test(p))) return true; // 0177.0.0.1
    return dottedPrivate(Number(m[1]), Number(m[2]));
  }
  if (h.includes(':')) {
    if (h === '::' || h === '::1' || /^(0+:){7}0$/.test(h) || /^(0+:){7}1$/.test(h)) return true;
    if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('ff')) return true;
    if (h.startsWith('::ffff:')) return isBlockedOpenHost(mapped6RestToV4(h.slice(7)));
    const mapped = /(?:^|:)ffff:(.+)$/.exec(h);
    if (mapped) return isBlockedOpenHost(mapped6RestToV4(mapped[1]));
  }
  return false;
}

function hostMatchesListed(host: string, listed: string): boolean {
  return host === listed || host.endsWith(`.${listed}`);
}

/** True when dest is still a locker/unlock host (false success). */
export function isBypassLockerDest(url: string, catalog: BypassServiceInfo[] = []): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (LV_HOSTS.some((h) => hostMatchesListed(host, h))) return true;
    for (const s of catalog) {
      if (s.kind !== 'locker' && s.kind !== 'unlock') continue;
      if (s.hosts.some((h) => hostMatchesListed(host, h))) return true;
    }
  } catch { /* ignore */ }
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
      .filter((x) => x && typeof x === 'object' && typeof x.input === 'string' && x.input.length > 0 && x.input.length <= 2048)
      .slice(0, HISTORY_MAX)
      .map((x) => {
        const dest = typeof x.destination === 'string' ? x.destination.slice(0, 2048) : null;
        const safeDest = dest && safeBypassOpenHref(dest) && !isBypassLockerDest(dest) ? dest : null;
        return {
          at: typeof x.at === 'number' && Number.isFinite(x.at) ? x.at : 0,
          input: x.input.slice(0, 2048),
          destination: safeDest,
          ok: Boolean(x.ok),
          service: typeof x.service === 'string' ? x.service.slice(0, 32) : 'unknown',
        };
      });
  } catch {
    return [];
  }
}

export function pushBypassHistory(items: BypassHistoryItem[]): BypassHistoryItem[] {
  const incoming = items
    .filter((x) => x && typeof x.input === 'string' && x.input.length > 0 && x.input.length <= 2048)
    .map((x) => {
      const dest = typeof x.destination === 'string' ? x.destination.slice(0, 2048) : null;
      const safeDest = dest && safeBypassOpenHref(dest) && !isBypassLockerDest(dest) ? dest : null;
      return {
        at: typeof x.at === 'number' && Number.isFinite(x.at) ? x.at : Date.now(),
        input: x.input.slice(0, 2048),
        destination: safeDest,
        ok: Boolean(x.ok),
        service: typeof x.service === 'string' ? x.service.slice(0, 32) : 'unknown',
      };
    });
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
