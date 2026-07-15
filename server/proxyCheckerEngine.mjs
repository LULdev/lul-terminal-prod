/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import http from 'http';
import https from 'https';
import {
  checkProxy,
  checkProxiesBatch,
  dedupeProxies,
} from './proxyScraperEngine.mjs';
import {
  normalizeProxiesList,
  normalizeProxyEntry,
  parseProxiesFromText,
} from './proxyParseCore.mjs';

function proxyUrl(proxy) {
  const { type, host, port } = proxy;
  if (type === 'socks4') return `socks4://${host}:${port}`;
  if (type === 'socks5') return `socks5://${host}:${port}`;
  return `http://${host}:${port}`;
}

function fetchThroughProxy(proxy, testUrl, timeoutMs) {
  const start = Date.now();
  const url = proxyUrl(proxy);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ alive: false, latency: null, body: '', headers: {} }), timeoutMs);
    try {
      const agent = proxy.type === 'socks4' || proxy.type === 'socks5'
        ? new SocksProxyAgent(url)
        : new HttpsProxyAgent(url);
      const mod = testUrl.startsWith('https') ? https : http;
      const req = mod.get(testUrl, { agent, timeout: timeoutMs }, (res) => {
        clearTimeout(timer);
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          resolve({
            alive: ok,
            latency: ok ? Date.now() - start : null,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers ?? {},
          });
        });
      });
      req.on('error', () => {
        clearTimeout(timer);
        resolve({ alive: false, latency: null, body: '', headers: {} });
      });
    } catch {
      clearTimeout(timer);
      resolve({ alive: false, latency: null, body: '', headers: {} });
    }
  });
}

export const TEST_URL_PRESETS = {
  google: 'http://www.google.com/generate_204',
  cloudflare: 'http://cp.cloudflare.com/generate_204',
  httpbin: 'http://httpbin.org/get',
  ipify: 'http://api.ipify.org',
  bing: 'http://www.bing.com',
  apple: 'http://captive.apple.com/hotspot-detect.html',
};

const RETRYABLE_ERROR = /timeout|econnreset|econnrefused|etimedout|socket|aborted|hang|reset|refused|enotfound|epipe/i;

export function categorizeError(error) {
  const s = String(error ?? '').toLowerCase();
  if (!s || s === 'dead') return 'dead';
  if (/timeout|timed out|aborted|hang/.test(s)) return 'timeout';
  if (/econnrefused|refused|reset|epipe|socket/.test(s)) return 'connection';
  if (/enotfound|dns|getaddrinfo|host/.test(s)) return 'dns';
  if (/status\s*\d{3}|http\s*\d{3}/.test(s)) return 'http_status';
  return 'unknown';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function latencyGrade(latency) {
  if (latency == null || !Number.isFinite(latency)) return 'dead';
  if (latency < 400) return 'fast';
  if (latency < 1200) return 'medium';
  return 'slow';
}

function isRetryableError(error) {
  return RETRYABLE_ERROR.test(String(error ?? 'timeout'));
}

let cachedDirectIp = null;

async function fetchDirectIp(timeoutMs = 6000) {
  if (cachedDirectIp) return cachedDirectIp;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    const data = await res.json();
    cachedDirectIp = String(data.ip ?? '').trim();
    return cachedDirectIp;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Probe SOCKS4/5/HTTP/HTTPS and return the working protocol for DB column assignment.
 */
export async function detectProxyType(proxy, opts = {}) {
  const {
    testUrl = TEST_URL_PRESETS.google,
    httpsTestUrl = 'https://www.google.com/generate_204',
    timeoutMs = 5000,
  } = opts;
  const probeTimeout = Math.min(4500, Math.max(1800, Math.floor(timeoutMs * 0.65)));
  const base = {
    host: proxy.host,
    port: proxy.port,
    raw: proxy.raw ?? `${proxy.host}:${proxy.port}`,
  };

  const [socks5, socks4] = await Promise.all([
    checkProxy({ ...base, type: 'socks5' }, { testUrl, timeoutMs: probeTimeout }),
    checkProxy({ ...base, type: 'socks4' }, { testUrl, timeoutMs: probeTimeout }),
  ]);

  if (socks5.alive) {
    return { type: 'socks5', detected: true, alive: true, latency: socks5.latency, probe: socks5, originalType: proxy.type };
  }
  if (socks4.alive) {
    return { type: 'socks4', detected: true, alive: true, latency: socks4.latency, probe: socks4, originalType: proxy.type };
  }

  const httpProbe = await checkProxy({ ...base, type: 'http' }, { testUrl, timeoutMs: probeTimeout });
  if (!httpProbe.alive) {
    const fallbackType = proxy.type ?? 'http';
    return {
      type: fallbackType,
      detected: false,
      alive: false,
      latency: null,
      error: httpProbe.error ?? 'dead',
      originalType: proxy.type,
    };
  }

  const httpsProbe = await checkProxy({ ...base, type: 'http' }, { testUrl: httpsTestUrl, timeoutMs: probeTimeout });
  if (httpsProbe.alive) {
    return {
      type: 'https',
      detected: true,
      alive: true,
      latency: httpProbe.latency,
      supportsHttps: true,
      probe: httpProbe,
      originalType: proxy.type,
    };
  }

  return {
    type: 'http',
    detected: true,
    alive: true,
    latency: httpProbe.latency,
    supportsHttps: false,
    probe: httpProbe,
    originalType: proxy.type,
  };
}

function parseExitIp(bodyText) {
  const text = String(bodyText ?? '').trim();
  try {
    const data = JSON.parse(text);
    const ip = data.origin ?? data.ip ?? data.query;
    if (typeof ip === 'string' && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip.split(',')[0].trim())) {
      return ip.split(',')[0].trim();
    }
    if (Array.isArray(data.origin) && data.origin[0]) return String(data.origin[0]);
  } catch {
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(text)) return text;
  }
  return null;
}

function classifyAnonymity(bodyText, headers, directIp) {
  const text = String(bodyText ?? '').toLowerCase();
  const hdr = Object.fromEntries(
    Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()]),
  );
  const forwarded = hdr['x-forwarded-for'] || hdr['via'] || hdr['proxy-connection'];
  if (directIp && text.includes(directIp.toLowerCase())) return 'transparent';
  if (forwarded) return 'anonymous';
  return 'elite';
}

async function checkProxyExtendedOnce(proxy, opts = {}) {
  const {
    testUrl = TEST_URL_PRESETS.google,
    httpsTestUrl = 'https://www.google.com/generate_204',
    timeoutMs = 5000,
    detectAnonymity = true,
    testHttps = true,
    autoDetectType = true,
    detectExitIp = true,
  } = opts;

  let target = { ...proxy };
  let base;
  let preHttps = false;

  if (autoDetectType) {
    const det = await detectProxyType(proxy, { testUrl, httpsTestUrl, timeoutMs });
    target = {
      ...proxy,
      type: det.type,
      typeDetected: det.detected,
      typeCorrected: det.detected && det.originalType && det.originalType !== det.type,
    };
    if (!det.alive) {
      const err = det.error ?? 'dead';
      return canonicalizeCheckedProxy({
        ...target,
        alive: false,
        latency: null,
        error: err,
        errorCategory: categorizeError(err),
        anonymity: 'dead',
        supportsHttps: false,
        testUrl,
        latencyGrade: 'dead',
      });
    }
    base = det.probe ?? await checkProxy(target, { testUrl, timeoutMs });
    preHttps = det.type === 'https' || Boolean(det.supportsHttps);
  } else {
    base = await checkProxy(target, { testUrl, timeoutMs });
  }

  if (!base.alive) {
    const err = base.error ?? 'dead';
    return canonicalizeCheckedProxy({
      ...target,
      ...base,
      error: err,
      errorCategory: categorizeError(err),
      anonymity: 'dead',
      supportsHttps: false,
      testUrl,
      latencyGrade: 'dead',
    });
  }

  let anonymity = 'unknown';
  let supportsHttps = preHttps;
  let exitIp = null;

  if (detectAnonymity || detectExitIp) {
    const directIp = detectAnonymity ? await fetchDirectIp(timeoutMs) : null;
    const probe = await fetchThroughProxy(target, TEST_URL_PRESETS.httpbin, timeoutMs);
    if (probe.alive) {
      exitIp = parseExitIp(probe.body);
      if (detectAnonymity) {
        anonymity = classifyAnonymity(probe.body, probe.headers, directIp);
      }
    }
  }

  if (testHttps && !supportsHttps) {
    const httpsProbe = await checkProxy(target, { testUrl: httpsTestUrl, timeoutMs });
    supportsHttps = Boolean(httpsProbe.alive);
  }

  return canonicalizeCheckedProxy({
    ...target,
    alive: base.alive,
    latency: base.latency,
    error: base.error ?? null,
    errorCategory: null,
    checkedAt: base.checkedAt ?? Date.now(),
    anonymity,
    supportsHttps,
    exitIp,
    testUrl,
    latencyGrade: latencyGrade(base.latency),
  });
}

export async function checkProxyExtended(proxy, opts = {}) {
  const retries = Math.min(Math.max(Number(opts.retries) || 0, 0), 3);
  const retryDelayMs = Math.min(Math.max(Number(opts.retryDelayMs) || 500, 100), 3000);

  let last = await checkProxyExtendedOnce(proxy, opts);
  let attempts = 1;

  while (!last.alive && attempts <= retries && isRetryableError(last.error)) {
    await sleep(retryDelayMs * attempts);
    last = await checkProxyExtendedOnce(proxy, opts);
    attempts++;
    if (last.alive) {
      last = { ...last, recovered: true, checkAttempts: attempts };
      break;
    }
  }

  return {
    ...last,
    checkAttempts: attempts,
    recovered: Boolean(last.recovered),
  };
}

export async function checkProxiesExtendedBatch(proxies, opts, onProgress) {
  const {
    concurrency = 60,
    limit = 0,
    timeoutMs = 5000,
    testUrl,
    httpsTestUrl,
    detectAnonymity = true,
    testHttps = true,
    autoDetectType = true,
    detectExitIp = true,
    retries = 1,
    retryDelayMs = 500,
    shouldCancel,
  } = opts;
  const slice = limit > 0 ? proxies.slice(0, limit) : proxies;
  const results = [];
  let idx = 0;
  let done = 0;
  let aliveCount = 0;
  let recoveredCount = 0;
  let cancelled = false;

  async function worker() {
    while (idx < slice.length) {
      if (shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const i = idx++;
      await sleep(Math.random() * 40);
      if (shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const r = await checkProxyExtended(slice[i], {
        testUrl,
        httpsTestUrl,
        timeoutMs,
        detectAnonymity,
        testHttps,
        autoDetectType,
        detectExitIp,
        retries,
        retryDelayMs,
      });
      results[i] = r;
      done++;
      if (r.alive) aliveCount++;
      if (r.recovered) recoveredCount++;
      onProgress?.({
        done,
        total: slice.length,
        last: r,
        alive: aliveCount,
        recovered: recoveredCount,
        cancelled,
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, slice.length || 1) }, () => worker());
  await Promise.all(workers);
  return { results, cancelled, partial: cancelled && done < slice.length };
}

export function parseProxyInput(text, defaultType = 'http') {
  return normalizeProxiesList(parseProxiesFromText(text, defaultType), defaultType);
}

export function normalizeProxiesForCheck(list, defaultType = 'http') {
  return normalizeProxiesList(list, defaultType);
}

/** Ensure checked result always stores raw as ip:port only. */
export function canonicalizeCheckedProxy(proxy) {
  const base = normalizeProxyEntry(proxy, proxy?.type ?? 'http');
  if (!base) return proxy;
  return { ...proxy, ...base, raw: `${base.host}:${base.port}` };
}

export function dedupeForCheck(proxies, { autoDetectType = true } = {}) {
  return dedupeProxies(proxies, { key: autoDetectType ? 'host:port' : 'type:host:port' });
}

export function summarizeCheck(checked, { before = 0, removed = 0 } = {}) {
  const alive = checked.filter((p) => p.alive);
  const latencies = alive.map((p) => p.latency).filter((n) => typeof n === 'number');
  const anonymity = { transparent: 0, anonymous: 0, elite: 0, unknown: 0, dead: 0 };
  for (const p of checked) {
    const k = p.anonymity ?? (p.alive ? 'unknown' : 'dead');
    if (anonymity[k] !== undefined) anonymity[k]++;
    else anonymity.unknown++;
  }
  return {
    totalInput: before || checked.length,
    uniqueChecked: checked.length,
    duplicatesRemoved: removed,
    alive: alive.length,
    dead: checked.length - alive.length,
    avgLatency: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    supportsHttps: checked.filter((p) => p.supportsHttps).length,
    anonymity,
    byType: {
      http: checked.filter((p) => p.type === 'http' && p.alive).length,
      https: checked.filter((p) => p.type === 'https' && p.alive).length,
      socks4: checked.filter((p) => p.type === 'socks4' && p.alive).length,
      socks5: checked.filter((p) => p.type === 'socks5' && p.alive).length,
    },
    typesDetected: checked.filter((p) => p.typeDetected).length,
    typesCorrected: checked.filter((p) => p.typeCorrected).length,
    recovered: checked.filter((p) => p.recovered).length,
    latencyGrades: {
      fast: checked.filter((p) => p.latencyGrade === 'fast').length,
      medium: checked.filter((p) => p.latencyGrade === 'medium').length,
      slow: checked.filter((p) => p.latencyGrade === 'slow').length,
    },
    errorCategories: {
      timeout: checked.filter((p) => p.errorCategory === 'timeout').length,
      connection: checked.filter((p) => p.errorCategory === 'connection').length,
      dns: checked.filter((p) => p.errorCategory === 'dns').length,
      http_status: checked.filter((p) => p.errorCategory === 'http_status').length,
      unknown: checked.filter((p) => !p.alive && !p.errorCategory).length,
    },
  };
}

export { checkProxiesBatch, dedupeProxies, parseProxiesFromText };