/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import http from 'http';
import https from 'https';
import {
  normalizeProxiesList,
  normalizeProxyEntry,
  parseProxyLine,
  parseProxiesFromText,
} from './proxyParseCore.mjs';
import { expandSourceUrls } from './proxyScraperAdapters.mjs';
import { discoverListUrls } from './proxyScraperDiscover.mjs';
import { detectContentFormat, parseSourceBody } from './proxyScraperParsers.mjs';
import { assertSafeFetchUrl, assertSafeFetchUrlAsync } from './assertSafeFetchUrl.mjs';

export {
  parseProxyLine,
  normalizeProxyEntry,
  normalizeProxiesList,
  parseProxiesFromText,
} from './proxyParseCore.mjs';

export { parseSourceBody, detectContentFormat, extractProxiesAggressive } from './proxyScraperParsers.mjs';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

function fetchHeaders(attempt = 0) {
  return {
    'User-Agent': USER_AGENTS[attempt % USER_AGENTS.length],
    Accept: 'text/html,application/xhtml+xml,application/json,text/plain,text/csv,application/xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: 'https://www.google.com/',
  };
}

async function fetchUrlTextOnce(url, timeoutMs, attempt = 0) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: fetchHeaders(attempt),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await assertSafeFetchUrlAsync(res.url || url);
    const text = await res.text();
    return { ok: true, text, bytes: text.length, contentType: res.headers.get('content-type') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Fetch failed' };
  } finally {
    clearTimeout(t);
  }
}

async function fetchUrlText(url, timeoutMs = 18000, attempt = 0) {
  await assertSafeFetchUrlAsync(url);
  const maxAttempts = 3;
  let last = { ok: false, error: 'Fetch failed' };
  for (let i = 0; i < maxAttempts; i++) {
    const wait = i === 0 ? 0 : 400 * i;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = await fetchUrlTextOnce(url, timeoutMs + i * 2000, attempt + i);
    if (last.ok) return last;
    if (!/abort|timeout|fetch|reset|refused|enotfound|socket/i.test(String(last.error))) break;
  }
  return last;
}

function mergeProxies(target, list, sourceId) {
  for (const p of list) {
    const key = `${p.host}:${p.port}`;
    if (!target.has(key)) {
      target.set(key, { ...p, sources: [sourceId] });
      continue;
    }
    const ex = target.get(key);
    if (!ex.sources.includes(sourceId)) ex.sources.push(sourceId);
  }
}

export async function fetchSource(source, timeoutMs = 18000, { deep = true } = {}) {
  const sourceId = source.id ?? 'unknown';
  const pool = new Map();
  let totalBytes = 0;
  let primaryFormat = null;
  let fetched = 0;
  let errors = [];

  const urls = deep ? expandSourceUrls(source) : [source.url];
  const subUrls = new Set();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let result = await fetchUrlText(url, timeoutMs, i);
    if (!result.ok && i < 2) {
      result = await fetchUrlText(url, timeoutMs, i + 1);
    }
    if (!result.ok) {
      errors.push(`${url}: ${result.error}`);
      continue;
    }

    fetched++;
    totalBytes += result.bytes ?? 0;
    const childSource = { ...source, url };
    const format = detectContentFormat(result.text, childSource);
    if (!primaryFormat) primaryFormat = format;

    mergeProxies(pool, normalizeProxiesList(parseSourceBody(result.text, childSource), source.type ?? 'http'), sourceId);

    if (deep && (format === 'html' || /<html/i.test(result.text.slice(0, 500)))) {
      for (const discovered of discoverListUrls(result.text, url, { limit: 8 })) {
        subUrls.add(discovered);
      }
    }
  }

  if (deep && subUrls.size) {
    const subList = [...subUrls].filter((sub) => !urls.includes(sub));
    const batchSize = 4;
    for (let i = 0; i < subList.length; i += batchSize) {
      const batch = subList.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((sub, j) => fetchUrlText(sub, Math.min(timeoutMs, 12000), i + j)),
      );
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (!result.ok) continue;
        fetched++;
        totalBytes += result.bytes ?? 0;
        const childSource = { ...source, url: batch[j] };
        mergeProxies(pool, normalizeProxiesList(parseSourceBody(result.text, childSource), source.type ?? 'http'), sourceId);
      }
    }
  }

  const proxies = [...pool.values()];
  if (proxies.length) {
    return {
      ok: true,
      count: proxies.length,
      proxies,
      bytes: totalBytes,
      format: primaryFormat,
      fetched,
      discovered: subUrls.size,
    };
  }

  return {
    ok: false,
    error: errors[0] ?? 'No proxies extracted',
    count: 0,
    proxies: [],
    format: primaryFormat,
    fetched,
    discovered: subUrls.size,
  };
}

function proxyUrl(proxy) {
  const { type, host, port } = proxy;
  if (type === 'socks4') return `socks4://${host}:${port}`;
  if (type === 'socks5') return `socks5://${host}:${port}`;
  return `http://${host}:${port}`;
}

export function checkProxy(proxy, { testUrl = 'http://www.google.com/generate_204', timeoutMs = 5000 } = {}) {
  const start = Date.now();
  const url = proxyUrl(proxy);

  return new Promise((resolve) => {
    const done = (alive, latency, error) => {
      resolve({ ...proxy, alive, latency: alive ? latency : null, error: error ?? null, checkedAt: Date.now() });
    };

    const timer = setTimeout(() => done(false, null, 'timeout'), timeoutMs);

    try {
      if (proxy.type === 'socks4' || proxy.type === 'socks5') {
        const agent = new SocksProxyAgent(url);
        const mod = testUrl.startsWith('https') ? https : http;
        const req = mod.get(testUrl, { agent, timeout: timeoutMs }, (res) => {
          clearTimeout(timer);
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          res.resume();
          done(ok, Date.now() - start, ok ? null : `status ${res.statusCode}`);
        });
        req.on('error', (e) => { clearTimeout(timer); done(false, null, e.message); });
        return;
      }

      const agent = new HttpsProxyAgent(url);
      const mod = testUrl.startsWith('https') ? https : http;
      const req = mod.get(testUrl, { agent, timeout: timeoutMs }, (res) => {
        clearTimeout(timer);
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        res.resume();
        done(ok, Date.now() - start, ok ? null : `status ${res.statusCode}`);
      });
      req.on('error', (e) => { clearTimeout(timer); done(false, null, e.message); });
    } catch (e) {
      clearTimeout(timer);
      done(false, null, e instanceof Error ? e.message : 'check error');
    }
  });
}

const TYPE_PRIORITY = { socks5: 4, socks4: 3, https: 2, http: 1 };

export function dedupeProxies(proxies, { key = 'host:port' } = {}) {
  const seen = new Map();
  let removed = 0;

  for (const proxy of proxies) {
    const dedupeKey = key === 'type:host:port'
      ? `${proxy.type}:${proxy.host}:${proxy.port}`
      : `${proxy.host}:${proxy.port}`;

    if (!seen.has(dedupeKey)) {
      seen.set(dedupeKey, { ...proxy });
      continue;
    }

    removed++;
    let existing = seen.get(dedupeKey);
    if (key === 'host:port') {
      const curPri = TYPE_PRIORITY[proxy.type] ?? 0;
      const exPri = TYPE_PRIORITY[existing.type] ?? 0;
      if (curPri > exPri) {
        existing = { ...proxy, sources: existing.sources };
        seen.set(dedupeKey, existing);
      }
    }
    if (proxy.sources?.length) {
      const merged = new Set([...(existing.sources ?? []), ...proxy.sources]);
      existing.sources = [...merged];
    }
  }

  return {
    proxies: [...seen.values()],
    before: proxies.length,
    after: seen.size,
    removed,
  };
}

export async function checkProxiesBatch(proxies, opts, onProgress) {
  const { concurrency = 40, limit = 0, timeoutMs = 5000, testUrl } = opts;
  const slice = limit > 0 ? proxies.slice(0, limit) : proxies;
  const results = [];
  let idx = 0;
  let done = 0;

  async function worker() {
    while (idx < slice.length) {
      const i = idx++;
      const r = await checkProxy(slice[i], { timeoutMs, testUrl });
      results[i] = r;
      done++;
      onProgress?.({ done, total: slice.length, last: r });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, slice.length || 1) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function scrapeAllSources(sources, onProgress, { concurrency = 12, fetchTimeoutMs = 18000 } = {}) {
  const all = new Map();
  const sourceResults = new Array(sources.length);
  let completed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const i = cursor++;
      const source = sources[i];
      onProgress?.({ phase: 'scrape', current: completed + 1, total: sources.length, source: source.name });

      const result = await fetchSource(source, fetchTimeoutMs);
      sourceResults[i] = { id: source.id, name: source.name, ...result, at: Date.now() };

      if (result.ok) {
        for (const p of result.proxies) {
          const key = `${p.host}:${p.port}`;
          if (!all.has(key)) {
            all.set(key, { ...p, sources: [source.id] });
          } else {
            const ex = all.get(key);
            if (!ex.sources.includes(source.id)) ex.sources.push(source.id);
            const curPri = TYPE_PRIORITY[p.type] ?? 0;
            const exPri = TYPE_PRIORITY[ex.type] ?? 0;
            if (curPri > exPri) {
              all.set(key, { ...p, sources: ex.sources });
            }
          }
        }
      }

      completed++;
      onProgress?.({
        phase: 'scrape',
        current: completed,
        total: sources.length,
        source: source.name,
        lastCount: result.count ?? 0,
        lastResult: result,
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, sources.length || 1) }, () => worker());
  await Promise.all(workers);

  return {
    proxies: normalizeProxiesList([...all.values()]),
    sourceResults,
    scrapedAt: Date.now(),
  };
}