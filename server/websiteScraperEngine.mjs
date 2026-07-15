/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { valueMatchesPattern } from './xmlLinkScraperEngine.mjs';
import {
  SCRAPER_SKILLS,
  discoverAdvancedLinks,
  fetchPageWithRetry,
  isRobotsBlocked,
  isSmartColonCandidate,
  mineMetaColonTokens,
  mineScriptColonTokens,
  normalizeCrawlUrl,
  parseFeedDocument,
  parseRobotsTxt,
  parseScheme,
  sameOrigin,
} from './websiteScraperSkills.mjs';

const URL_RE = /(?:https?|ftp|ws|wss|mailto|tel|file):\/\/[^\s<>"')\]]+/gi;
const COLON_TOKEN_RE = /[a-zA-Z][a-zA-Z0-9+.-]*:[^\s<>"')\]]{2,}/g;
const HREF_RE = /(?:href|src|action|data-[a-z-]+|content|cite|poster|srcset)\s*=\s*["']([^"']+)["']/gi;
const A_HREF_RE = /<a[^>]+href\s*=\s*["']([^"']+)["']/gi;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function normalizeStartUrl(input) {
  let raw = String(input ?? '').trim();
  if (!raw) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    raw = `https://${raw.replace(/^\/+/, '')}`;
  }
  return normalizeCrawlUrl(raw, raw, true);
}

function stripNoiseRegions(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 120) : '';
}

function isFeedContent(contentType, text) {
  const ct = String(contentType).toLowerCase();
  if (/rss|atom|xml/.test(ct)) return true;
  return /<(rss|feed|urlset|rdf:RDF)\b/i.test(String(text).slice(0, 800));
}

function passesColonFilter(value, pattern, smartColon) {
  if (!value.includes(':')) return false;
  if (smartColon && !isSmartColonCandidate(value)) return false;
  return valueMatchesPattern(value, pattern);
}

/** Single-pass colon extraction — mines script/meta once and returns source sets for attribution. */
function extractColonTokens(html, pattern, opts = {}) {
  const { smartColon = true, mineScripts = true, mineMeta = true } = opts;
  const found = new Set();
  const scriptSet = new Set();
  const metaSet = new Set();
  const clean = stripNoiseRegions(html);

  if (mineScripts) {
    for (const v of mineScriptColonTokens(html)) {
      if (!passesColonFilter(v, pattern, smartColon)) continue;
      scriptSet.add(v);
      found.add(v);
    }
  }
  if (mineMeta) {
    for (const v of mineMetaColonTokens(html)) {
      if (!passesColonFilter(v, pattern, smartColon)) continue;
      metaSet.add(v);
      found.add(v);
    }
  }

  for (const re of [HREF_RE, A_HREF_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const v = m[1].trim().replace(/[.,;:!?)]+$/, '');
      if (passesColonFilter(v, pattern, smartColon)) found.add(v);
    }
  }

  for (const m of clean.matchAll(URL_RE)) {
    const v = m[0];
    if (passesColonFilter(v, pattern, smartColon)) found.add(v);
  }
  for (const m of clean.matchAll(COLON_TOKEN_RE)) {
    const v = m[0].replace(/[.,;:!?)]+$/, '');
    if (passesColonFilter(v, pattern, smartColon)) found.add(v);
  }

  return { tokens: [...found], scriptSet, metaSet };
}

async function parseSitemapLocs(xml, origin, limit = 500, stripTracking = true) {
  const seeds = new Set();
  const locRe = /<loc[^>]*>([^<]+)<\/loc>/gi;
  let m;
  while ((m = locRe.exec(xml)) !== null) {
    const norm = normalizeCrawlUrl(m[1].trim(), origin, stripTracking);
    if (norm) seeds.add(norm);
    if (seeds.size >= limit) break;
  }
  return [...seeds];
}

async function discoverSitemapUrls(origin, signal, stripTracking, extraSitemaps = []) {
  const seeds = new Set();
  const sitemapCandidates = new Set(extraSitemaps);

  for (const fallback of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`]) {
    sitemapCandidates.add(fallback);
  }

  for (const sitemapUrl of sitemapCandidates) {
    const res = await fetchPageWithRetry(sitemapUrl, { timeoutMs: 8000, signal, maxAttempts: 2 });
    if (!res.ok || !res.text.includes('<')) continue;

    const locs = await parseSitemapLocs(res.text, origin, 500, stripTracking);
    const isIndex = /<sitemapindex/i.test(res.text);

    if (isIndex) {
      for (const child of locs.slice(0, 8)) {
        const childRes = await fetchPageWithRetry(child, { timeoutMs: 8000, signal, maxAttempts: 2 });
        if (!childRes.ok) continue;
        for (const u of await parseSitemapLocs(childRes.text, origin, 200, stripTracking)) {
          seeds.add(u);
        }
      }
    } else {
      for (const u of locs) seeds.add(u);
    }
    if (seeds.size) break;
  }

  return [...seeds];
}

/**
 * BFS crawl from start URL — auto-discover pages, extract colon tokens, dedupe at end.
 */
export async function crawlWebsite(startUrl, options = {}, onProgress) {
  const started = Date.now();
  const pattern = String(options.pattern ?? '*:*');
  const maxPages = Math.min(500, Math.max(1, Number(options.maxPages) || 80));
  const maxDepth = Math.min(12, Math.max(0, Number(options.maxDepth) || 4));
  const sameOriginOnly = options.sameOriginOnly !== false;
  const useSitemap = options.useSitemap !== false;
  const respectRobots = Boolean(options.respectRobots);
  const smartColon = options.smartColon !== false;
  const mineScripts = options.mineScripts !== false;
  const discoverFeeds = options.discoverFeeds !== false;
  const stripTracking = options.stripTracking !== false;
  const retryFetch = options.retryFetch !== false;
  const concurrency = Math.min(6, Math.max(1, Number(options.concurrency) || 3));
  const delayMs = Math.max(0, Number(options.delayMs) || 120);
  const signal = options.signal;

  const seed = normalizeStartUrl(startUrl);
  if (!seed) throw new Error('Invalid start URL');

  const origin = new URL(seed).origin;
  const siteName = new URL(seed).hostname;

  const queue = [{ url: seed, depth: 0 }];
  let queueHead = 0;
  const queued = new Set([seed]);
  const visited = new Set();
  const uniqueColonValues = new Set();
  const colonHits = [];
  const pages = [];
  let pagesFailed = 0;
  let sitemapSeeded = 0;
  let feedSeeded = 0;
  let linksDiscovered = 0;
  let externalLinksFound = 0;
  let scriptTokensFound = 0;
  let metaTokensFound = 0;
  let feedTokensFound = 0;
  let crawlDelayMs = 0;
  const externalDomains = new Map();
  const logs = [];

  let wasCancelled = false;
  const checkCancelled = () => {
    if (signal?.aborted) wasCancelled = true;
    return wasCancelled;
  };

  const enqueue = (url, depth) => {
    if (visited.has(url) || queued.has(url) || depth > maxDepth) return;
    queued.add(url);
    queue.push({ url, depth });
  };

  const queueSize = () => queue.length - queueHead;

  let robotsRules = [];
  let robotsSitemaps = [];
  if (respectRobots) {
    const robotsRes = await fetchPageWithRetry(`${origin}/robots.txt`, { timeoutMs: 5000, signal, maxAttempts: 2 });
    if (robotsRes.ok) {
      const parsed = await parseRobotsTxt(robotsRes.text);
      robotsRules = parsed.disallow;
      crawlDelayMs = parsed.crawlDelayMs;
      robotsSitemaps = parsed.sitemaps;
      if (robotsRules.length) logs.push(`robots.txt: ${robotsRules.length} disallow rule(s)`);
      if (crawlDelayMs) logs.push(`robots.txt: crawl-delay ${crawlDelayMs}ms`);
    }
  }

  if (useSitemap && !checkCancelled()) {
    const sitemapUrls = await discoverSitemapUrls(origin, signal, stripTracking, robotsSitemaps);
    for (const u of sitemapUrls.slice(0, maxPages)) {
      if (sameOrigin(u, origin) && !visited.has(u) && !queued.has(u)) {
        enqueue(u, 1);
        sitemapSeeded++;
      }
    }
    if (sitemapSeeded) logs.push(`Sitemap turbo-seed: +${sitemapSeeded} URL(s)`);
  }

  const effectiveDelay = Math.max(delayMs, respectRobots ? crawlDelayMs : 0);

  let lastReportAt = 0;
  const report = (msg, extra = {}, force = false) => {
    const now = Date.now();
    if (!force && now - lastReportAt < 400) return;
    lastReportAt = now;
    const elapsed = now - started;
    const crawled = pages.length;
    onProgress?.({
      pagesCrawled: crawled,
      queueSize: queueSize(),
      colonHits: colonHits.length,
      maxPages,
      maxDepth,
      linksDiscovered,
      pagesFailed,
      sitemapSeeded,
      feedSeeded,
      externalLinksFound,
      scriptTokensFound,
      metaTokensFound,
      elapsedMs: elapsed,
      pagesPerSecond: elapsed > 0 ? Math.round((crawled / (elapsed / 1000)) * 100) / 100 : 0,
      uniqueColonsEstimate: uniqueColonValues.size,
      message: msg,
      ...extra,
    });
  };

  report('Crawl started…', {}, true);

  while (queueHead < queue.length && pages.length < maxPages && !wasCancelled) {
    if (checkCancelled()) break;

    const batch = [];
    while (batch.length < concurrency && queueHead < queue.length && pages.length + batch.length < maxPages) {
      const item = queue[queueHead++];
      if (!item || visited.has(item.url)) continue;
      if (item.depth > maxDepth) continue;
      try {
        const path = new URL(item.url).pathname;
        if (respectRobots && isRobotsBlocked(path, robotsRules)) continue;
      } catch { continue; }
      visited.add(item.url);
      batch.push(item);
    }

    if (!batch.length) break;

    const results = await Promise.all(
      batch.map((item) => fetchPageWithRetry(item.url, {
        timeoutMs: 12000,
        signal,
        maxAttempts: retryFetch ? 3 : 1,
      })),
    );

    for (let i = 0; i < batch.length; i++) {
      if (checkCancelled()) break;
      const { url, depth } = batch[i];
      const res = results[i];
      if (res.cancelled) {
        wasCancelled = true;
        break;
      }
      if (!res.ok || !res.text) {
        pagesFailed++;
        continue;
      }

      const title = extractTitle(res.text);
      const base = res.finalUrl || url;
      const colonOpts = { smartColon, mineScripts, mineMeta: true };
      const { tokens: pageTokens, scriptSet, metaSet } = extractColonTokens(res.text, pattern, colonOpts);
      const tokenSet = new Set(pageTokens);

      if (isFeedContent(res.contentType, res.text)) {
        const feed = parseFeedDocument(res.text, base, pattern, smartColon);
        feedTokensFound += feed.tokens.length;
        for (const t of feed.tokens) tokenSet.add(t);
        for (const fl of feed.links) {
          if (!sameOrigin(fl, origin)) {
            externalLinksFound++;
            try {
              const h = new URL(fl).hostname;
              externalDomains.set(h, (externalDomains.get(h) ?? 0) + 1);
            } catch { /* ignore */ }
          } else {
            enqueue(fl, depth + 1);
          }
        }
      }

      scriptTokensFound += scriptSet.size;
      metaTokensFound += metaSet.size;

      for (const value of tokenSet) {
        uniqueColonValues.add(value);
        colonHits.push({
          value,
          pageUrl: base,
          title,
          depth,
          scheme: parseScheme(value),
          source: scriptSet.has(value) ? 'script' : metaSet.has(value) ? 'meta' : 'html',
        });
      }

      pages.push({
        url: base,
        title,
        depth,
        colonCount: tokenSet.size,
        status: res.status,
        bytes: res.bytes ?? res.text.length,
      });

      const { links, feedUrls } = discoverAdvancedLinks(res.text, base, {
        sameOriginOnly: false,
        origin,
        stripTracking,
      });

      for (const link of links) {
        linksDiscovered++;
        if (!sameOrigin(link, origin)) {
          externalLinksFound++;
          try {
            const h = new URL(link).hostname;
            externalDomains.set(h, (externalDomains.get(h) ?? 0) + 1);
          } catch { /* ignore */ }
          continue;
        }
        enqueue(link, depth + 1);
      }

      if (discoverFeeds) {
        for (const feedUrl of feedUrls) {
          if (sameOrigin(feedUrl, origin) && !visited.has(feedUrl) && !queued.has(feedUrl)) {
            enqueue(feedUrl, depth + 1);
            feedSeeded++;
          }
        }
      }

      report(`Crawled ${pages.length}/${maxPages} — ${colonHits.length} colon hits`, { currentUrl: url });
    }

    if (wasCancelled) break;
    report(`Batch done — ${pages.length}/${maxPages}`, {}, true);
    if (effectiveDelay > 0) await sleep(effectiveDelay);
  }

  if (wasCancelled) logs.push(`Crawl stopped — ${pages.length} page(s), ${colonHits.length} colon hit(s) saved`);

  const atlasMap = new Map();
  for (const hit of colonHits) {
    const key = hit.value;
    if (!atlasMap.has(key)) {
      atlasMap.set(key, {
        value: key,
        scheme: hit.scheme,
        pages: [],
        pageSet: new Set(),
        hitCount: 0,
      });
    }
    const entry = atlasMap.get(key);
    entry.hitCount++;
    const pageKey = hit.pageUrl;
    if (!entry.pageSet.has(pageKey)) {
      entry.pageSet.add(pageKey);
      entry.pages.push({ url: hit.pageUrl, title: hit.title, depth: hit.depth, siteName });
    }
  }

  const colonAtlas = [...atlasMap.values()]
    .map(({ pageSet, ...rest }) => rest)
    .sort((a, b) => b.hitCount - a.hitCount || b.pages.length - a.pages.length);

  const schemeMap = new Map();
  const depthMap = new Map();
  const sourceMap = new Map();
  const pageColonMap = new Map();
  for (const hit of colonHits) {
    schemeMap.set(hit.scheme, (schemeMap.get(hit.scheme) ?? 0) + 1);
    depthMap.set(hit.depth, (depthMap.get(hit.depth) ?? 0) + 1);
    sourceMap.set(hit.source ?? 'html', (sourceMap.get(hit.source ?? 'html') ?? 0) + 1);
    pageColonMap.set(hit.pageUrl, (pageColonMap.get(hit.pageUrl) ?? 0) + 1);
  }

  const crawlMs = Date.now() - started;
  const uniqueColons = colonAtlas.length;
  const pagesCrawled = pages.length;
  const colonHitsCount = colonHits.length;
  const maxDepthReached = pages.reduce((m, p) => Math.max(m, p.depth), 0);
  const pagesWithColons = pageColonMap.size;
  const totalBytes = pages.reduce((s, p) => s + (p.bytes ?? 0), 0);
  const statusBreakdown = {};
  for (const p of pages) {
    statusBreakdown[p.status] = (statusBreakdown[p.status] ?? 0) + 1;
  }

  const topPages = [...pageColonMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([url, count]) => {
      const pg = pages.find((p) => p.url === url);
      return { url, title: pg?.title ?? '', depth: pg?.depth ?? 0, colonCount: count, status: pg?.status ?? 0 };
    });

  const topExternalDomains = [...externalDomains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return {
    startUrl: seed,
    siteName,
    pattern,
    smartColon,
    stats: {
      pagesCrawled,
      pagesFailed,
      pagesQueued: visited.size,
      colonHits: colonHitsCount,
      uniqueColons,
      linksDiscovered,
      sitemapSeeded,
      feedSeeded,
      externalLinksFound,
      scriptTokensFound,
      metaTokensFound,
      feedTokensFound,
      totalBytes,
      crawlMs,
      schemes: Object.fromEntries(schemeMap),
      sources: Object.fromEntries(sourceMap),
      maxDepthReached,
      pagesWithColons,
      avgColonsPerPage: pagesCrawled ? Math.round((colonHitsCount / pagesCrawled) * 10) / 10 : 0,
      pagesPerSecond: crawlMs > 0 ? Math.round((pagesCrawled / (crawlMs / 1000)) * 100) / 100 : 0,
      dedupeRatio: colonHitsCount ? Math.round((uniqueColons / colonHitsCount) * 1000) / 1000 : 1,
      successRate: visited.size ? Math.round((pagesCrawled / visited.size) * 1000) / 10 : 100,
      statusBreakdown,
      schemeCount: schemeMap.size,
      queueRemaining: queueSize(),
      externalDomainCount: externalDomains.size,
      cancelled: wasCancelled,
    },
    topPages,
    topExternalDomains,
    depthBreakdown: Object.fromEntries([...depthMap.entries()].sort((a, b) => a[0] - b[0])),
    colonAtlas,
    pages: pages.sort((a, b) => a.depth - b.depth || a.url.localeCompare(b.url)),
    logs,
  };
}

export const CRAWL_PRESETS = [
  { id: 'quick', label: 'Quick', labelDe: 'Schnell', maxPages: 25, maxDepth: 2, hint: 'Fast snapshot — homepage + nearby links' },
  { id: 'standard', label: 'Standard', labelDe: 'Standard', maxPages: 80, maxDepth: 4, hint: 'Balanced full-site scan (recommended)' },
  { id: 'deep', label: 'Deep', labelDe: 'Tief', maxPages: 200, maxDepth: 8, hint: 'Thorough crawl for large sites' },
];

export const WEBSITE_SCRAPER_FEATURES = SCRAPER_SKILLS;