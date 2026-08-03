/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Seeds 146 unique proxy list sources (29 curated repos + 117 proxifly files).
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EXTRA_PROXY_URLS, mergeExtraSources, slugify as slugifyExtra } from './merge-proxy-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'proxy-scraper', 'sources.json');

const BASE_REPOS = [
  ['hookzof/socks5_list', 'master', ['proxy.txt', 'tg/mtproto.json', 'tg/socks.json']],
  ['clarketm/proxy-list', 'master', ['last-status-update.txt', 'proxy-list-raw.txt', 'proxy-list-status.txt', 'proxy-list.txt']],
  ['mmpx12/proxy-list', 'master', ['README.txt', 'http.txt', 'https.txt', 'ips-list.txt', 'proxies.txt', 'socks4.txt', 'socks5.txt', 'tor-exit-nodes.txt', 'update.txt']],
  ['roosterkid/openproxylist', 'main', ['HTTPS.txt', 'HTTPS_RAW.txt', 'SOCKS4.txt', 'SOCKS4_RAW.txt', 'SOCKS5.txt', 'SOCKS5_RAW.txt', 'V2RAY.txt', 'V2RAY_BASE64.txt', 'V2RAY_RAW.txt']],
  ['mzyui/proxy-list', 'main', ['all.txt', 'http.txt', 'socks4.txt', 'socks5.txt']],
  ['TheSpeedX/PROXY-List', 'master', ['http.txt', 'socks4.txt', 'socks5.txt']],
  ['ShiftyTR/Proxy-List', 'master', ['http.txt', 'https.txt', 'socks4.txt', 'socks5.txt']],
  ['monosans/proxy-list', 'main', ['proxies/http.txt', 'proxies/socks4.txt', 'proxies/socks5.txt']],
  ['jetkai/proxy-list', 'master', [
    'archive.txt',
    'online-proxies/txt/proxies-http.txt',
    'online-proxies/txt/proxies-https.txt',
    'online-proxies/txt/proxies-socks4.txt',
    'online-proxies/txt/proxies-socks5.txt',
  ]],
  ['Zaeem20/FREE_PROXIES_LIST', 'master', ['http.txt', 'socks4.txt', 'socks5.txt']],
  ['MuRiot/proxy-list', 'main', ['proxy-list/http.txt', 'proxy-list/https.txt', 'proxy-list/socks4.txt', 'proxy-list/socks5.txt']],
  ['iplocate/free-proxy-list', 'main', ['protocols/http.csv', 'protocols/https.csv', 'protocols/socks4.csv', 'protocols/socks5.csv', 'all-proxies.csv']],
];

/** 36 country codes (alphabetical, ohne BB/DM — 404) → 108 files + 3 all = 111 proxifly sources */
const PROXIFLY_COUNTRIES = [
  'AE', 'AL', 'AM', 'AR', 'AT', 'AU', 'BD', 'BE', 'BG',
  'BR', 'BW', 'CA', 'CH', 'CL', 'CN', 'CO', 'CR', 'CZ', 'DE',
  'DK', 'EC', 'EE', 'EG', 'ES', 'FI', 'FR', 'GB', 'GH',
  'GR', 'HK', 'HN', 'HU', 'ID', 'IE', 'IL', 'IN',
];

function guessType(filename) {
  const l = filename.toLowerCase();
  if (l.includes('socks5')) return 'socks5';
  if (l.includes('socks4')) return 'socks4';
  if (l.includes('https')) return 'https';
  if (l.includes('http')) return 'http';
  if (l.includes('socks')) return 'socks5';
  return 'http';
}

const slugify = slugifyExtra;

function buildSources() {
  const entries = [];

  for (const [repo, branch, files] of BASE_REPOS) {
    for (const file of files) {
      entries.push({
        url: `https://raw.githubusercontent.com/${repo}/${branch}/${file}`,
        name: `${repo}/${file}`,
        type: guessType(file),
        repo,
      });
    }
  }

  const proxiflyRepo = 'proxifly/free-proxy-list';
  for (const file of ['proxies/all/data.csv', 'proxies/all/data.json', 'proxies/all/data.txt']) {
    entries.push({
      url: `https://raw.githubusercontent.com/${proxiflyRepo}/main/${file}`,
      name: `${proxiflyRepo}/${file}`,
      type: 'http',
      repo: proxiflyRepo,
    });
  }

  for (const cc of PROXIFLY_COUNTRIES) {
    for (const ext of ['data.csv', 'data.json', 'data.txt']) {
      const file = `proxies/countries/${cc}/${ext}`;
      entries.push({
        url: `https://raw.githubusercontent.com/${proxiflyRepo}/main/${file}`,
        name: `${proxiflyRepo}/${file}`,
        type: 'http',
        repo: proxiflyRepo,
      });
    }
  }

  const seen = new Set();
  const sources = [];
  const ids = new Set();

  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);

    const file = entry.name.split('/').slice(2).join('/') || 'list';
    let id = slugify(`${entry.repo}-${file}`);
    let n = 2;
    while (ids.has(id)) id = `${id}-${n++}`;
    ids.add(id);

    sources.push({
      id,
      name: entry.name.replace(/\//g, ' · '),
      url: entry.url,
      type: entry.type,
      repo: entry.repo,
    });
  }

  return sources;
}

const built = buildSources();
const { sources, added, skipped } = mergeExtraSources(built, EXTRA_PROXY_URLS);

if (sources.length < 140) {
  console.error('Expected at least 140 sources, got', sources.length);
  process.exit(1);
}

const urls = new Set(sources.map((s) => s.url));
if (urls.size !== sources.length) {
  console.error('Duplicate URLs found:', sources.length - urls.size);
  process.exit(1);
}

console.log(`Extra URLs: +${added} new, ${skipped} duplicates skipped`);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(
  OUT,
  JSON.stringify(
    {
      version: 2,
      updatedAt: new Date().toISOString(),
      count: sources.length,
      sources,
    },
    null,
    2,
  ),
  'utf8',
);

console.log('Wrote', OUT, 'with', sources.length, 'sources');