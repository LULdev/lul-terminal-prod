/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dedupeProxies } from './proxyScraperEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'proxy-scraper');
const SOURCES_FILE = path.join(ROOT, 'sources.json');
const SEED_SCRIPT = path.join(__dirname, '..', 'scripts', 'seed-proxy-sources.mjs');
const STATE_FILE = path.join(ROOT, 'state.json');
const RESULTS_FILE = path.join(ROOT, 'last-results.json');
const CUSTOM_FILE = path.join(ROOT, 'custom-proxies.json');

const EMPTY_STATE = {
  lastScrapeAt: null,
  lastCheckAt: null,
  totalScraped: 0,
  uniqueProxies: 0,
  alive: 0,
  dead: 0,
  avgLatency: 0,
  sourcesOk: 0,
  sourcesFailed: 0,
};

const EMPTY_RESULTS = { proxies: [], checked: [] };
const EMPTY_CUSTOM = { proxies: [], updatedAt: null };

let scraperWriteChain = Promise.resolve();

export function withProxyScraperWrite(task) {
  const run = scraperWriteChain.then(() => task());
  scraperWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(file, data) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

async function readJsonOrDefault(file, empty, label) {
  if (!(await fileExists(file))) return structuredClone(empty);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[proxy-scraper] CRITICAL: ${label} unreadable`, err);
    throw new Error('Proxy scraper data unavailable');
  }
}

export function proxyEntryKey(proxy) {
  return `${proxy.type}:${proxy.host}:${proxy.port}`;
}

const FALLBACK_SOURCES = [
  {
    id: 'thespeedx-http',
    name: 'TheSpeedX · http.txt',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    type: 'http',
    repo: 'TheSpeedX/PROXY-List',
  },
  {
    id: 'thespeedx-socks4',
    name: 'TheSpeedX · socks4.txt',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    type: 'socks4',
    repo: 'TheSpeedX/PROXY-List',
  },
  {
    id: 'thespeedx-socks5',
    name: 'TheSpeedX · socks5.txt',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    type: 'socks5',
    repo: 'TheSpeedX/PROXY-List',
  },
  {
    id: 'monosans-http',
    name: 'monosans · proxies/http.txt',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    type: 'http',
    repo: 'monosans/proxy-list',
  },
  {
    id: 'monosans-socks5',
    name: 'monosans · proxies/socks5.txt',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    type: 'socks5',
    repo: 'monosans/proxy-list',
  },
  {
    id: 'clarketm-raw',
    name: 'clarketm · proxy-list-raw.txt',
    url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
    type: 'http',
    repo: 'clarketm/proxy-list',
  },
];

async function seedSourcesIfNeeded() {
  let needsSeed = false;
  try {
    await fs.access(SOURCES_FILE);
    const raw = await fs.readFile(SOURCES_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sources) || data.sources.length === 0) needsSeed = true;
  } catch {
    needsSeed = true;
  }
  if (!needsSeed) return;

  try {
    const { execFileSync } = await import('child_process');
    execFileSync(process.execPath, [SEED_SCRIPT], {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..'),
      timeout: 60_000,
      windowsHide: true,
    });
  } catch (err) {
    console.warn('[proxy-scraper] Full source seed failed — writing fallback sources', err?.message ?? err);
    await atomicWrite(SOURCES_FILE, {
      version: 1,
      updatedAt: new Date().toISOString(),
      count: FALLBACK_SOURCES.length,
      sources: FALLBACK_SOURCES,
      note: 'fallback — run npm run seed:proxy-sources for the full catalog',
    });
  }

  // If seed produced empty/broken file, still guarantee fallbacks
  try {
    const raw = await fs.readFile(SOURCES_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sources) || data.sources.length === 0) {
      await atomicWrite(SOURCES_FILE, {
        version: 1,
        updatedAt: new Date().toISOString(),
        count: FALLBACK_SOURCES.length,
        sources: FALLBACK_SOURCES,
      });
    }
  } catch {
    await atomicWrite(SOURCES_FILE, {
      version: 1,
      updatedAt: new Date().toISOString(),
      count: FALLBACK_SOURCES.length,
      sources: FALLBACK_SOURCES,
    });
  }
}

export async function ensureStore() {
  await fs.mkdir(ROOT, { recursive: true });
  await seedSourcesIfNeeded();
}

export async function loadSources() {
  await ensureStore();
  const data = await readJsonOrDefault(SOURCES_FILE, { sources: FALLBACK_SOURCES }, 'sources.json');
  const sources = data.sources ?? [];
  if (!sources.length) return [...FALLBACK_SOURCES];
  return sources;
}

export async function saveSources(sources) {
  return withProxyScraperWrite(async () => {
    await ensureStore();
    await atomicWrite(SOURCES_FILE, {
      version: 1,
      updatedAt: new Date().toISOString(),
      count: sources.length,
      sources,
    });
  });
}

export async function mutateSources(mutator) {
  return withProxyScraperWrite(async () => {
    const sources = await loadSources();
    const next = await mutator(sources);
    await ensureStore();
    await atomicWrite(SOURCES_FILE, {
      version: 1,
      updatedAt: new Date().toISOString(),
      count: next.length,
      sources: next,
    });
    return next;
  });
}

export async function loadState() {
  await ensureStore();
  return readJsonOrDefault(STATE_FILE, EMPTY_STATE, 'state.json');
}

export async function saveState(state) {
  return withProxyScraperWrite(async () => {
    await ensureStore();
    await atomicWrite(STATE_FILE, state);
  });
}

export async function saveResults(results) {
  return withProxyScraperWrite(async () => {
    await ensureStore();
    await atomicWrite(RESULTS_FILE, results);
  });
}

export async function loadResults() {
  await ensureStore();
  return readJsonOrDefault(RESULTS_FILE, EMPTY_RESULTS, 'last-results.json');
}

export async function loadCustomProxies() {
  await ensureStore();
  const data = await readJsonOrDefault(CUSTOM_FILE, EMPTY_CUSTOM, 'custom-proxies.json');
  return {
    proxies: Array.isArray(data.proxies) ? data.proxies : [],
    updatedAt: data.updatedAt ?? null,
  };
}

export async function saveCustomProxies(proxies) {
  return withProxyScraperWrite(async () => {
    await ensureStore();
    await atomicWrite(CUSTOM_FILE, {
      version: 1,
      updatedAt: new Date().toISOString(),
      count: proxies.length,
      proxies,
    });
  });
}

export async function mutateCustomProxies(mutator) {
  return withProxyScraperWrite(async () => {
    const existing = await loadCustomProxies();
    const next = await mutator(existing);
    await ensureStore();
    await atomicWrite(CUSTOM_FILE, {
      version: 1,
      updatedAt: new Date().toISOString(),
      count: next.proxies.length,
      proxies: next.proxies,
    });
    return next;
  });
}

/** Merged scrape pool: last scrape + persistent custom proxies (deduped). */
export async function loadScrapePool() {
  const [results, customData] = await Promise.all([loadResults(), loadCustomProxies()]);
  const scraped = results.proxies ?? [];
  const custom = customData.proxies ?? [];
  const { proxies, removed } = dedupeProxies([...scraped, ...custom], { key: 'type:host:port' });

  return {
    proxies,
    scraped,
    custom,
    scrapedCount: scraped.length,
    customCount: custom.length,
    poolCount: proxies.length,
    dedupRemoved: removed,
    checked: results.checked ?? [],
    sourceResults: results.sourceResults,
    scrapedAt: results.scrapedAt ?? null,
    customUpdatedAt: customData.updatedAt,
  };
}