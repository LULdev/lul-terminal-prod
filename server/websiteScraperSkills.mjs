/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Advanced website scraper skills — ported from proxy discovery patterns
 * and modern crawl techniques (SPA hydration, feeds, script mining, retries).
 */

import { assertSafeFetchUrl, assertSafeFetchUrlAsync } from './assertSafeFetchUrl.mjs';
import { valueMatchesPattern } from './xmlLinkScraperEngine.mjs';

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'LUL-Terminal-Scraper/1.2 (+admin; colon-discovery)',
];

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_eid', 'ref', 'source', 'spm', 'igshid',
]);

const URL_RE = /(?:https?|ftp|ws|wss|mailto|tel|file):\/\/[^\s<>"')\]]+/gi;
const COLON_TOKEN_RE = /[a-zA-Z][a-zA-Z0-9+.-]*:[^\s<>"')\]]{2,}/g;
const HOST_PORT_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}):\d{2,5}$/;
const FETCH_URL_RE = /(?:fetch|axios\.(?:get|post)|\.open)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const IP_PORT_ARRAY_RE = /['"]([\d.]+:\d{2,5})['"]/g;

const KNOWN_SCHEMES = new Set([
  'http', 'https', 'ftp', 'ftps', 'ws', 'wss', 'mailto', 'tel', 'file', 'data',
  'magnet', 'ssh', 'svn', 'git', 'steam', 'spotify', 'slack', 'discord', 'sms', 'geo',
  'news', 'feed', 'urn', 'blob', 'intent', 'skype', 'viber', 'whatsapp', 'tg',
]);

const CSS_NOISE_SCHEMES = new Set([
  'background', 'font-family', 'font-size', 'font-weight', 'color', 'margin', 'padding',
  'width', 'height', 'display', 'opacity', 'border', 'text-align', 'line-height',
  'box-shadow', 'transform', 'transition', 'position', 'top', 'left', 'right', 'bottom',
  'flex', 'grid', 'overflow', 'z-index', 'content',
]);

export function fetchHeaders(attempt = 0) {
  return {
    'User-Agent': USER_AGENTS[attempt % USER_AGENTS.length],
    Accept: 'text/html,application/xhtml+xml,application/json,text/plain,application/xml,text/xml,application/rss+xml,application/atom+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
    'Cache-Control': 'no-cache',
  };
}

export function stripTrackingParams(href) {
  try {
    const u = new URL(href);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        u.searchParams.delete(key);
      }
    }
    return u.href;
  } catch {
    return href;
  }
}

export function normalizeCrawlUrl(raw, base, stripTracking = true) {
  try {
    const u = new URL(raw, base);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    }
    const href = stripTracking ? stripTrackingParams(u.href) : u.href;
    return assertSafeFetchUrl(href);
  } catch {
    return null;
  }
}

export function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export function parseScheme(value) {
  const m = String(value).match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return m ? m[1].toLowerCase() : 'other';
}

export function isSmartColonCandidate(value) {
  const v = String(value).trim();
  if (!v.includes(':')) return false;
  if (/:\/\//.test(v)) return true;
  if (HOST_PORT_RE.test(v)) return true;
  const scheme = parseScheme(v);
  if (CSS_NOISE_SCHEMES.has(scheme)) return false;
  if (KNOWN_SCHEMES.has(scheme)) return true;
  if (scheme.length <= 12 && /^[a-z][a-z0-9+.-]*$/.test(scheme) && v.length > scheme.length + 3) {
    return !/[{};]/.test(v);
  }
  return false;
}

function stripNoiseRegions(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function collectColonValue(found, raw) {
  const v = String(raw).trim().replace(/[.,;:!?)]+$/, '');
  if (v.includes(':')) found.add(v);
}

/** Extract colon tokens from inline script JSON / SPA hydration blobs. */
export function mineScriptColonTokens(html) {
  const found = new Set();

  const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of scriptBlocks) {
    const inner = block.replace(/<\/?script[^>]*>/gi, '');

    for (const m of inner.matchAll(URL_RE)) collectColonValue(found, m[0]);
    for (const m of inner.matchAll(COLON_TOKEN_RE)) collectColonValue(found, m[0]);
    for (const m of inner.matchAll(FETCH_URL_RE)) collectColonValue(found, m[1]);
    for (const m of inner.matchAll(IP_PORT_ARRAY_RE)) collectColonValue(found, m[1]);

    const hydration = [
      inner.match(/__NEXT_DATA__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/),
      inner.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/),
      inner.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});/),
    ];
    for (const h of hydration) {
      if (!h?.[1]) continue;
      for (const m of h[1].matchAll(/"(?:url|href|src|@id|sameAs|contentUrl|downloadUrl|canonical|link)"\s*:\s*"([^"]+)"/gi)) {
        collectColonValue(found, m[1]);
      }
    }
  }

  const jsonLd = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const ld of jsonLd) {
    for (const m of ld[1].matchAll(/"(?:url|@id|sameAs|contentUrl|downloadUrl|item)"\s*:\s*"([^"]+)"/gi)) {
      collectColonValue(found, m[1]);
    }
  }

  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData?.[1]) {
    for (const m of nextData[1].matchAll(/"(?:url|href|src|canonical)"\s*:\s*"([^"]+)"/gi)) {
      collectColonValue(found, m[1]);
    }
  }

  return [...found];
}

/** OpenGraph, Twitter Card, Dublin Core meta colon values. */
export function mineMetaColonTokens(html) {
  const found = new Set();
  const metaRe = /<meta[^>]+(?:property|name|itemprop)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  const metaRe2 = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']([^"']+)["'][^>]*>/gi;
  for (const re of [metaRe, metaRe2]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const content = re === metaRe ? m[2] : m[1];
      collectColonValue(found, content);
    }
  }
  return [...found];
}

export function parseSrcsetUrls(srcset, baseUrl) {
  const urls = [];
  for (const part of srcset.split(',')) {
    const url = part.trim().split(/\s+/)[0];
    if (url) urls.push(url);
  }
  return urls;
}

function addLink(links, raw, baseUrl, sameOriginOnly, origin, stripTracking) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return;
  const abs = normalizeCrawlUrl(trimmed, baseUrl, stripTracking);
  if (!abs) return;
  if (sameOriginOnly && !sameOrigin(abs, origin)) return;
  links.add(abs);
}

/** Advanced link discovery — feeds, srcset, iframes, pagination, RSS alt links. */
export function discoverAdvancedLinks(html, baseUrl, opts = {}) {
  const { sameOriginOnly = true, origin, stripTracking = true } = opts;
  const links = new Set();
  const feedUrls = new Set();

  const attrPatterns = [
    /(?:href|src|action|cite|poster|data-url|data-href|data-link)\s*=\s*["']([^"']+)["']/gi,
    /<a[^>]+href\s*=\s*["']([^"']+)["']/gi,
    /<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi,
    /<embed[^>]+src\s*=\s*["']([^"']+)["']/gi,
    /<object[^>]+data\s*=\s*["']([^"']+)["']/gi,
    /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^;"']*;\s*url=([^"']+)["']/gi,
  ];

  for (const re of attrPatterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      addLink(links, m[1], baseUrl, sameOriginOnly, origin, stripTracking);
    }
  }

  const srcsetRe = /srcset\s*=\s*["']([^"']+)["']/gi;
  let sm;
  while ((sm = srcsetRe.exec(html)) !== null) {
    for (const u of parseSrcsetUrls(sm[1], baseUrl)) {
      addLink(links, u, baseUrl, sameOriginOnly, origin, stripTracking);
    }
  }

  const feedRelRe = /<link[^>]+rel=["'][^"']*(?:alternate|feed)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*(?:type=["']application\/(?:rss|atom)\+xml["'])?/gi;
  const feedRelRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:alternate|feed)[^"']*["']/gi;
  for (const re of [feedRelRe, feedRelRe2]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const abs = normalizeCrawlUrl(m[1], baseUrl, stripTracking);
      if (abs) feedUrls.add(abs);
      addLink(links, m[1], baseUrl, sameOriginOnly, origin, stripTracking);
    }
  }

  return { links: [...links], feedUrls: [...feedUrls] };
}

/** Parse RSS/Atom XML for item links and colon tokens. */
export function parseFeedDocument(xml, baseUrl, pattern, smartColon) {
  const links = new Set();
  const tokens = new Set();

  const patterns = [
    /<link[^>]+href=["']([^"']+)["']/gi,
    /<guid[^>]*>([^<]+)<\/guid>/gi,
    /<loc[^>]*>([^<]+)<\/loc>/gi,
    /<url[^>]*>([^<]+)<\/url>/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const abs = normalizeCrawlUrl(m[1].trim(), baseUrl, true);
      if (abs) links.add(abs);
      collectColonValue(tokens, m[1]);
    }
  }

  for (const m of xml.matchAll(URL_RE)) collectColonValue(tokens, m[0]);

  const out = [];
  for (const v of tokens) {
    if (smartColon && !isSmartColonCandidate(v)) continue;
    if (valueMatchesPattern(v, pattern)) out.push(v);
  }

  return { links: [...links], tokens: out };
}

export async function parseRobotsTxt(text) {
  const lines = text.split(/\r?\n/);
  let inAll = false;
  const disallow = [];
  let crawlDelayMs = 0;
  const sitemaps = [];

  for (const line of lines) {
    const t = line.trim();
    if (/^user-agent:\s*\*/i.test(t)) { inAll = true; continue; }
    if (/^user-agent:/i.test(t)) { inAll = false; continue; }
    if (/^sitemap:/i.test(t)) {
      const m = t.match(/^sitemap:\s*(.+)$/i);
      if (m?.[1]) sitemaps.push(m[1].trim());
      continue;
    }
    if (inAll) {
      const dis = t.match(/^disallow:\s*(.*)$/i);
      if (dis && dis[1].trim()) disallow.push(dis[1].trim());
      const delay = t.match(/^crawl-delay:\s*([\d.]+)/i);
      if (delay) crawlDelayMs = Math.max(crawlDelayMs, Math.round(parseFloat(delay[1]) * 1000));
    }
  }

  return { disallow, crawlDelayMs, sitemaps };
}

export function isRobotsBlocked(pathname, rules) {
  for (const rule of rules) {
    if (!rule) continue;
    if (rule === '/') return true;
    if (pathname.startsWith(rule)) return true;
  }
  return false;
}

export async function fetchPageWithRetry(url, { timeoutMs = 12000, signal, maxAttempts = 3 } = {}) {
  let last = { ok: false, status: 0, text: '', error: 'fetch failed', finalUrl: url };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) return { ok: false, status: 0, text: '', error: 'cancelled', finalUrl: url, cancelled: true };

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs + attempt * 2000);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);

    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));

    try {
      await assertSafeFetchUrlAsync(url);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: fetchHeaders(attempt),
        redirect: 'follow',
      });
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort);
      const finalUrl = res.url || url;
      await assertSafeFetchUrlAsync(finalUrl);
      const text = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        text,
        contentType: res.headers.get('content-type') ?? '',
        finalUrl,
        bytes: text.length,
      };
    } catch (e) {
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) return { ok: false, status: 0, text: '', error: 'cancelled', finalUrl: url, cancelled: true };
      last = { ok: false, status: 0, text: '', error: e.message, finalUrl: url };
      if (!/abort|timeout|fetch|reset|refused|enotfound|socket/i.test(String(e.message))) break;
    }
  }
  return last;
}

export const SCRAPER_SKILLS = [
  { id: 'script-miner', title: 'Script JSON miner', desc: 'Mines __NEXT_DATA__, fetch(), hydration blobs & JS arrays for : tokens.' },
  { id: 'meta-miner', title: 'Meta / OG miner', desc: 'Extracts OpenGraph, Twitter Card & meta content values with colons.' },
  { id: 'feed-radar', title: 'RSS/Atom feed radar', desc: 'Discovers feed links, parses items, seeds crawl queue.' },
  { id: 'srcset', title: 'Srcset & iframe scan', desc: 'Parses responsive srcset, iframe/embed/object sources.' },
  { id: 'retry', title: 'Retry + rotate UA', desc: '3-attempt fetch with backoff and rotating browser user-agents.' },
  { id: 'tracking-strip', title: 'Tracking param strip', desc: 'Normalizes URLs — removes utm_*, fbclid, gclid for clean dedup.' },
  { id: 'robots-delay', title: 'Robots crawl-delay', desc: 'Honours Crawl-delay from robots.txt when respect is enabled.' },
  { id: 'external-radar', title: 'External link radar', desc: 'Tracks cross-origin links discovered (even when not followed).' },
];