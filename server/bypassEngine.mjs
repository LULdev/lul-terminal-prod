/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Members-only link resolver. Linkvertise is the primary path; other lockers
 * use redirect following, dest-param unwrap, HTML extract, then public APIs.
 */

import { assertSafeFetchUrl, safeFetch } from './assertSafeFetchUrl.mjs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const TIMEOUT_MS = 12_000;
const MAX_HOPS = 6;
const MAX_URLS = 8;
const MAX_URL_LEN = 2048;
const MAX_PASTE_CHARS = 8_000;

const DEST_PARAM_KEYS = ['url', 'r', 'u', 'q', 'target', 'dest', 'destination', 'redirect', 'link', 'goto', 'out', 'to'];

/** @typedef {{ id: string, label: string, kind: 'locker'|'shortener'|'paste'|'unlock'|'generic', hosts: string[] }} BypassService */

/** @type {BypassService[]} */
export const BYPASS_SERVICES = [
  {
    id: 'linkvertise',
    label: 'Linkvertise',
    kind: 'locker',
    hosts: [
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
      'publisher.linkvertise.com',
    ],
  },
  { id: 'workink', label: 'Work.ink', kind: 'locker', hosts: ['work.ink', 'workink.net', 'workink.com', 'wrk.ink', 'workink.link', 'workink.to', 'pastework.ink'] },
  { id: 'lootlabs', label: 'Lootlabs', kind: 'locker', hosts: ['lootlabs.gg', 'lootlinks.com', 'loot-link.com', 'lootdest.com', 'lootdest.info'] },
  { id: 'admaven', label: 'AdMaven', kind: 'locker', hosts: ['ad-maven.com', 'admaven.com', 'admaven.net'] },
  { id: 'adfoc', label: 'AdFoc.us', kind: 'locker', hosts: ['adfoc.us'] },
  { id: 'boostink', label: 'Boost.ink', kind: 'unlock', hosts: ['boost.ink', 'boostfusedgt.com', 'mboost.me', 'letsboost.net', 'letsboost.com'] },
  { id: 'bstlar', label: 'Bstlar', kind: 'unlock', hosts: ['bstlar.com', 'bstlar.net', 'bst.gg', 'booo.st'] },
  { id: 'rekonise', label: 'Rekonise', kind: 'unlock', hosts: ['rekonise.com', 'rkns.link'] },
  { id: 'socialunlock', label: 'Social Unlock', kind: 'unlock', hosts: ['social-unlock.com', 'socialwolvez.com'] },
  { id: 'sub2unlock', label: 'Sub2Unlock', kind: 'unlock', hosts: ['sub2unlock.com', 'sub2unlock.me', 'sub2unlock.net', 'sub4unlock.io', 'sub2get.com', 'sub1s.com', 'subfinal.com', 'unlocknow.net', 'ytsubme.com'] },
  { id: 'leaks', label: 'Leaks / Vault', kind: 'locker', hosts: ['leaked.tools', 'leakslinks.com', 'leakslinks.net', 'leakutopia.com', 'leasurepartment.xyz', 'vaultlinks.net', 'vaultlinks.com', 'dragonslayer.gg', 'egirls.wtf', 'empebau.eu', 'mendationforc.info', 'ecodevs.com', 'linkdirect.com'] },
  { id: 'bitly', label: 'Bitly', kind: 'shortener', hosts: ['bit.ly', 'bitly.com', 'j.mp'] },
  { id: 'tinyurl', label: 'TinyURL', kind: 'shortener', hosts: ['tinyurl.com', 'tiny.cc', 'tinylink.onl'] },
  { id: 'tco', label: 't.co', kind: 'shortener', hosts: ['t.co'] },
  { id: 'googl', label: 'Google URL', kind: 'shortener', hosts: ['goo.gl', 'google.com'] },
  { id: 'isgd', label: 'is.gd / v.gd', kind: 'shortener', hosts: ['is.gd', 'v.gd', 'cl.gy'] },
  { id: 'tly', label: 't.ly', kind: 'shortener', hosts: ['t.ly'] },
  { id: 'rebrandly', label: 'Rebrandly', kind: 'shortener', hosts: ['rebrand.ly'] },
  { id: 'cutty', label: 'Cutty / Shorte', kind: 'shortener', hosts: ['cutt.ly', 'cutty.net', 'shorte.st', 'shorter.me', 'shrinkme.click'] },
  { id: 'pastebin', label: 'Pastebin', kind: 'paste', hosts: ['pastebin.com'] },
  { id: 'rentry', label: 'Rentry', kind: 'paste', hosts: ['rentry.org', 'rentry.co'] },
  { id: 'hastebin', label: 'Hastebin', kind: 'paste', hosts: ['hastebin.com', 'hastebin.skyra.pw', 'www.toptal.com'] },
  { id: 'justpaste', label: 'JustPaste', kind: 'paste', hosts: ['justpaste.it'] },
  { id: 'controlc', label: 'ControlC', kind: 'paste', hosts: ['controlc.com'] },
  { id: 'n0paste', label: 'n0paste', kind: 'paste', hosts: ['n0paste.tk', 'n0paste.com'] },
  { id: 'pastedrop', label: 'Paste Drop', kind: 'paste', hosts: ['paste-drop.com', 'pastedrop.com'] },
  { id: 'paster', label: 'Paster', kind: 'paste', hosts: ['paster.so', 'paster.gg', 'pasterso.com', 'pasteso.com'] },
  { id: 'pastelink', label: 'Paste hosts', kind: 'paste', hosts: ['pastelink.net', 'pastelua.com', 'pastemode.com', 'pastecanyon.com', 'pastehill.com', 'pasteva.com', 'pastesite.com', 'pasteflash.com', 'goldpaster.com'] },
  { id: 'privatebin', label: 'PrivateBin', kind: 'paste', hosts: ['privatebin.net', 'bin.privatebin.info'] },
  { id: 'telegraph', label: 'Telegraph', kind: 'paste', hosts: ['telegra.ph', 'telegraph.ph'] },
  { id: 'generic', label: 'Generic resolver', kind: 'generic', hosts: ['baseresolver.com', 'paramsresolver.com', 'redirectresolver.com'] },
];

const HOST_TO_SERVICE = (() => {
  /** @type {Map<string, BypassService>} */
  const map = new Map();
  for (const svc of BYPASS_SERVICES) {
    for (const host of svc.hosts) map.set(host.toLowerCase(), svc);
  }
  return map;
})();

function apexHost(hostname) {
  const h = String(hostname ?? '').toLowerCase().replace(/^www\./, '');
  return h;
}

export function identifyService(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = apexHost(u.hostname);
    if (HOST_TO_SERVICE.has(host)) return HOST_TO_SERVICE.get(host);
    const parts = host.split('.');
    if (parts.length > 2) {
      const parent = parts.slice(-2).join('.');
      if (HOST_TO_SERVICE.has(parent)) return HOST_TO_SERVICE.get(parent);
    }
    return null;
  } catch {
    return null;
  }
}

export function catalogPublic() {
  return BYPASS_SERVICES
    .filter((s) => s.id !== 'generic')
    .map((s) => ({ id: s.id, label: s.label, kind: s.kind, hosts: s.hosts.slice(0, 8) }));
}

function looksHttpUrl(value) {
  return /^https?:\/\/[^\s<>"']+/i.test(String(value ?? '').trim());
}

function tryDecodeUrlish(value) {
  let v = String(value ?? '').trim();
  if (!v) return null;
  for (let i = 0; i < 2; i += 1) {
    try {
      const d = decodeURIComponent(v);
      if (d && d !== v) v = d;
      else break;
    } catch {
      break;
    }
  }
  if (looksHttpUrl(v)) return v.split(/[\s<>"']/)[0];
  const b64 = v.replace(/-/g, '+').replace(/_/g, '/');
  if (/^[A-Za-z0-9+/]+=*$/.test(b64) && b64.length >= 12) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      if (looksHttpUrl(decoded)) return decoded.trim().split(/[\s<>"']/)[0];
    } catch { /* ignore */ }
  }
  return looksHttpUrl(v) ? v.split(/[\s<>"']/)[0] : null;
}

function unwrapQueryDest(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return null;
  }
  // google.com/url?q=
  if (apexHost(parsed.hostname) === 'google.com' && parsed.pathname.startsWith('/url')) {
    const q = tryDecodeUrlish(parsed.searchParams.get('q') || parsed.searchParams.get('url') || '');
    if (q) return q;
  }
  for (const key of DEST_PARAM_KEYS) {
    const raw = parsed.searchParams.get(key);
    if (!raw) continue;
    const dest = tryDecodeUrlish(raw);
    if (!dest) continue;
    try {
      const d = new URL(dest);
      if (apexHost(d.hostname) === apexHost(parsed.hostname) && d.pathname === parsed.pathname) continue;
    } catch {
      continue;
    }
    return dest;
  }
  return null;
}

function extractUrlsFromText(text) {
  const out = [];
  const re = /https?:\/\/[^\s<>"'\\]+/gi;
  let m;
  while ((m = re.exec(String(text ?? ''))) !== null) {
    let u = m[0].replace(/[),.;]+$/, '');
    try {
      u = new URL(u).href;
    } catch {
      continue;
    }
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

function extractDestFromHtml(html, pageUrl) {
  const text = String(html ?? '');
  const meta = text.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)/i)
    || text.match(/content=["'][^"']*url=([^"']+)["'][^>]*http-equiv=["']refresh["']/i);
  if (meta?.[1]) {
    try {
      return new URL(meta[1].trim(), pageUrl).href;
    } catch { /* ignore */ }
  }

  const patterns = [
    /["'](?:target|destination|dest_url|final_url|redirect_url|redirectUrl|targetUrl|out)["']\s*[:=]\s*["'](https?:[^"']+)/i,
    /(?:window|document)\.location(?:\.href)?\s*=\s*["'](https?:[^"']+)/i,
    /data-(?:url|href|target|link)=["'](https?:[^"']+)/i,
    /rel=["']canonical["'][^>]*href=["'](https?:[^"']+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && looksHttpUrl(m[1])) {
      try {
        const dest = new URL(m[1], pageUrl).href;
        if (apexHost(new URL(dest).hostname) !== apexHost(new URL(pageUrl).hostname)) return dest;
      } catch { /* ignore */ }
    }
  }

  const urls = extractUrlsFromText(text);
  try {
    const pageHost = apexHost(new URL(pageUrl).hostname);
    const external = urls.find((u) => {
      try {
        return apexHost(new URL(u).hostname) !== pageHost && !identifyService(u);
      } catch {
        return false;
      }
    });
    if (external) return external;
    const other = urls.find((u) => {
      try {
        return apexHost(new URL(u).hostname) !== pageHost;
      } catch {
        return false;
      }
    });
    if (other) return other;
  } catch { /* ignore */ }
  return null;
}

function extractJsonDest(obj, depth = 0) {
  if (obj == null || depth > 6) return null;
  if (typeof obj === 'string' && looksHttpUrl(obj)) return obj.trim();
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const d = extractJsonDest(item, depth + 1);
      if (d) return d;
    }
    return null;
  }
  if (typeof obj !== 'object') return null;
  const prefer = ['target', 'destination', 'dest', 'url', 'link', 'redirect', 'result', 'final_url', 'paste'];
  for (const key of prefer) {
    if (obj[key] != null) {
      const d = extractJsonDest(obj[key], depth + 1);
      if (d) return d;
    }
  }
  for (const value of Object.values(obj)) {
    const d = extractJsonDest(value, depth + 1);
    if (d) return d;
  }
  return null;
}

async function request(url, init = {}, { timeoutMs = TIMEOUT_MS, maxRedirects = 6 } = {}) {
  const href = assertSafeFetchUrl(url);
  const headers = {
    'User-Agent': UA,
    Accept: 'text/html,application/json,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    ...(init.headers ?? {}),
  };
  const res = await safeFetch(
    href,
    {
      method: init.method ?? 'GET',
      headers,
      body: init.body,
    },
    { maxRedirects, timeoutMs },
  );
  const text = await res.text();
  let json = null;
  const ct = String(res.headers.get('content-type') ?? '');
  if (ct.includes('json') || (text.startsWith('{') || text.startsWith('['))) {
    try {
      json = JSON.parse(text);
    } catch { /* ignore */ }
  }
  return { ok: res.ok, status: res.status, url: res.url || href, text, json, headers: res.headers };
}

function sameResource(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.hostname.replace(/^www\./, '') === ub.hostname.replace(/^www\./, '')
      && ua.pathname.replace(/\/+$/, '') === ub.pathname.replace(/\/+$/, '');
  } catch {
    return a === b;
  }
}

function isLockerUrl(url) {
  const svc = identifyService(url);
  return Boolean(svc && (svc.kind === 'locker' || svc.kind === 'unlock'));
}

async function followShort(url) {
  const res = await request(url, { method: 'GET' }, { maxRedirects: 8, timeoutMs: TIMEOUT_MS });
  const hops = [];
  if (res.url && !sameResource(res.url, url)) hops.push(res.url);
  const q = unwrapQueryDest(res.url);
  if (q && !sameResource(q, res.url)) return { dest: q, hops: [...hops, q], html: res.text, json: res.json, finalUrl: res.url };
  const htmlDest = extractDestFromHtml(res.text, res.url);
  if (htmlDest && !sameResource(htmlDest, res.url) && !sameResource(htmlDest, url)) {
    return { dest: htmlDest, hops: [...hops, htmlDest], html: res.text, json: res.json, finalUrl: res.url };
  }
  if (res.json) {
    const jd = extractJsonDest(res.json);
    if (jd && !sameResource(jd, url)) return { dest: jd, hops: [...hops, jd], html: res.text, json: res.json, finalUrl: res.url };
  }
  if (res.url && !sameResource(res.url, url)) {
    return { dest: res.url, hops, html: res.text, json: res.json, finalUrl: res.url };
  }
  return { dest: null, hops, html: res.text, json: res.json, finalUrl: res.url };
}

function lvPathFromUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  while (parts[0] && /^(download|view|link)$/i.test(parts[0])) parts.shift();
  const idIdx = parts.findIndex((p) => /^\d+$/.test(p));
  if (idIdx >= 0) {
    const id = parts[idIdx];
    let slug = parts[idIdx + 1] || '';
    slug = slug.replace(/\/+$/, '');
    if (/^(dynamic|captcha|target)$/i.test(slug)) slug = '';
    return slug ? `${id}/${encodeURIComponent(decodeURIComponent(slug))}` : id;
  }
  return null;
}

function lvSerial(linkId) {
  return Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    random: '6548307',
    link_id: Number(linkId) || linkId,
  })).toString('base64');
}

async function resolveLinkvertise(url) {
  const queryDest = unwrapQueryDest(url);
  if (queryDest && !isLockerUrl(queryDest)) return { dest: queryDest, paste: null };

  const path = lvPathFromUrl(url);
  if (!path) {
    const followed = await followShort(url);
    if (followed.dest && !isLockerUrl(followed.dest)) return { dest: followed.dest, paste: null };
    throw new Error('Could not parse Linkvertise URL');
  }

  const staticUrl = `https://publisher.linkvertise.com/api/v1/redirect/link/static/${path}?origin=&resolution=1920x1080`;
  const staticRes = await request(staticUrl, {
    headers: { Accept: 'application/json', Origin: 'https://linkvertise.com', Referer: 'https://linkvertise.com/' },
  });
  const link = staticRes.json?.data?.link ?? staticRes.json?.link ?? null;
  const linkId = link?.id;
  let userToken = staticRes.json?.user_token ?? staticRes.json?.data?.user_token ?? null;

  if (!userToken) {
    const acc = await request('https://publisher.linkvertise.com/api/v1/account', {
      headers: { Accept: 'application/json', Origin: 'https://linkvertise.com', Referer: 'https://linkvertise.com/' },
    });
    userToken = acc.json?.user_token ?? acc.json?.data?.user_token ?? null;
  }

  const typeRaw = String(link?.target_type ?? 'URL').toUpperCase();
  const type = typeRaw === 'PASTE' ? 'paste' : 'target';

  const warmup = [
    `/captcha`,
    `/countdown_impression?trafficOrigin=network`,
    `/todo_impression?mobile=true&trafficOrigin=network`,
    `/click?trafficOrigin=network`,
  ];
  for (const suffix of warmup) {
    try {
      await request(`https://publisher.linkvertise.com/api/v1/redirect/link/${path}${suffix}`, {
        headers: { Accept: 'application/json', Origin: 'https://linkvertise.com', Referer: 'https://linkvertise.com/' },
      }, { timeoutMs: 6_000, maxRedirects: 2 });
    } catch { /* warmup is best-effort */ }
  }

  if (linkId) {
    const serial = lvSerial(linkId);
    const targetUrl = `https://publisher.linkvertise.com/api/v1/redirect/link/${path}/${type}${userToken ? `?X-Linkvertise-UT=${encodeURIComponent(userToken)}` : ''}`;
    const posted = await request(targetUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: 'https://linkvertise.com',
        Referer: 'https://linkvertise.com/',
        ...(userToken ? { 'X-Linkvertise-UT': userToken } : {}),
      },
      body: JSON.stringify({ serial }),
    });
    const dest = posted.json?.data?.target || posted.json?.data?.paste || extractJsonDest(posted.json);
    if (dest && looksHttpUrl(dest)) {
      return { dest, paste: type === 'paste' && posted.json?.data?.paste && !looksHttpUrl(String(posted.json.data.paste)) ? String(posted.json.data.paste) : null };
    }

    const getTarget = await request(
      `https://publisher.linkvertise.com/api/v1/redirect/link/${path}/target?serial=${encodeURIComponent(serial)}${userToken ? `&X-Linkvertise-UT=${encodeURIComponent(userToken)}` : ''}`,
      { headers: { Accept: 'application/json', Origin: 'https://linkvertise.com', Referer: 'https://linkvertise.com/' } },
    );
    const dest2 = getTarget.json?.data?.target || getTarget.json?.data?.paste || extractJsonDest(getTarget.json);
    if (dest2 && looksHttpUrl(dest2)) return { dest: dest2, paste: null };
  }

  const htmlDest = extractDestFromHtml(staticRes.text, url);
  if (htmlDest && !isLockerUrl(htmlDest)) return { dest: htmlDest, paste: null };

  throw new Error('Linkvertise did not return a destination');
}

async function resolvePaste(url, serviceId) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid paste URL');
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  const id = parts.filter((p) => p !== 'raw' && p !== 'embed' && p !== 'clone').pop();

  const rawCandidates = [];
  if (serviceId === 'pastebin' && id) rawCandidates.push(`https://pastebin.com/raw/${id}`);
  if (serviceId === 'rentry' && id) rawCandidates.push(`${parsed.origin}/${id}/raw`);
  if (serviceId === 'hastebin' && id) {
    rawCandidates.push(`${parsed.origin}/raw/${id}`);
    rawCandidates.push(`https://hastebin.com/raw/${id}`);
  }
  if (parsed.pathname.includes('/raw')) rawCandidates.unshift(url);
  rawCandidates.push(url);

  let lastText = '';
  for (const cand of rawCandidates) {
    try {
      const res = await request(cand, {}, { timeoutMs: TIMEOUT_MS, maxRedirects: 5 });
      lastText = res.text || '';
      if (!res.ok || !lastText.trim()) continue;
      if (/<!doctype html|<html/i.test(lastText.slice(0, 400))) {
        const dest = extractDestFromHtml(lastText, res.url);
        if (dest) return { dest, paste: null };
        continue;
      }
      const urls = extractUrlsFromText(lastText);
      if (urls.length === 1) return { dest: urls[0], paste: lastText.slice(0, MAX_PASTE_CHARS) };
      if (urls.length > 1) return { dest: urls[0], paste: lastText.slice(0, MAX_PASTE_CHARS) };
      return { dest: null, paste: lastText.slice(0, MAX_PASTE_CHARS) };
    } catch { /* try next raw candidate */ }
  }
  if (lastText.trim()) return { dest: extractDestFromHtml(lastText, url), paste: lastText.slice(0, MAX_PASTE_CHARS) };
  throw new Error('Could not read paste');
}

async function tryPublicBypassApis(url) {
  const endpoints = [
    (u) => `https://api.bypass.vip/bypass?url=${encodeURIComponent(u)}`,
    (u) => `https://bypass.bot.nu/bypass2?url=${encodeURIComponent(u)}`,
  ];
  for (const build of endpoints) {
    try {
      const res = await request(build(url), { headers: { Accept: 'application/json' } }, { timeoutMs: 8_000, maxRedirects: 3 });
      const dest = res.json?.result || res.json?.destination || res.json?.url || extractJsonDest(res.json);
      if (dest && looksHttpUrl(dest) && !sameResource(dest, url) && !isLockerUrl(dest)) {
        return dest;
      }
    } catch { /* next API */ }
  }
  return null;
}

async function resolveKnown(url, service) {
  const q = unwrapQueryDest(url);
  if (q && !sameResource(q, url) && identifyService(q)?.id !== service.id) {
    return { dest: q, paste: null };
  }

  if (service.id === 'linkvertise') {
    try {
      return await resolveLinkvertise(url);
    } catch (err) {
      const apiDest = await tryPublicBypassApis(url);
      if (apiDest) return { dest: apiDest, paste: null };
      throw err;
    }
  }
  if (service.kind === 'paste') return resolvePaste(url, service.id);
  if (service.kind === 'shortener' || service.kind === 'generic') {
    const followed = await followShort(url);
    if (followed.dest) return { dest: followed.dest, paste: null };
  }

  const followed = await followShort(url);
  if (followed.dest && !sameResource(followed.dest, url)) return { dest: followed.dest, paste: null };
  if (followed.json) {
    const jd = extractJsonDest(followed.json);
    if (jd) return { dest: jd, paste: null };
  }

  const apiDest = await tryPublicBypassApis(url);
  if (apiDest) return { dest: apiDest, paste: null };

  if (followed.html) {
    const htmlDest = extractDestFromHtml(followed.html, followed.finalUrl || url);
    if (htmlDest && !sameResource(htmlDest, url)) return { dest: htmlDest, paste: null };
  }

  throw new Error(`Could not bypass ${service.label}`);
}

async function resolveChain(inputUrl) {
  const hops = [inputUrl];
  let current = inputUrl;
  let pasteText = null;
  let serviceId = identifyService(current)?.id ?? 'unknown';
  let lastKind = 'url';

  for (let i = 0; i < MAX_HOPS; i += 1) {
    const svc = identifyService(current);
    if (!svc && i > 0) {
      const extra = unwrapQueryDest(current);
      if (extra && !sameResource(extra, current)) {
        hops.push(extra);
        current = extra;
        continue;
      }
      break;
    }
    const targetSvc = svc ?? { id: 'generic', label: 'Generic', kind: 'generic', hosts: [] };
    if (i === 0) serviceId = targetSvc.id;
    const resolved = await resolveKnown(current, targetSvc);
    if (resolved.paste) {
      pasteText = resolved.paste;
      lastKind = 'paste';
    }
    if (resolved.dest && looksHttpUrl(resolved.dest) && !sameResource(resolved.dest, current)) {
      hops.push(resolved.dest);
      current = resolved.dest;
      lastKind = resolved.paste && !looksHttpUrl(resolved.dest) ? 'paste' : 'url';
      const nextSvc = identifyService(current);
      if (!nextSvc || nextSvc.kind === 'paste' && lastKind === 'paste') {
        if (nextSvc?.kind === 'paste') {
          try {
            const inner = await resolvePaste(current, nextSvc.id);
            if (inner.dest) {
              hops.push(inner.dest);
              current = inner.dest;
            }
            if (inner.paste) pasteText = inner.paste;
          } catch { /* keep paste dest as-is */ }
        }
        break;
      }
      continue;
    }
    if (resolved.paste) break;
    throw new Error('No destination found');
  }

  const dest = hops[hops.length - 1];
  if (!dest || sameResource(dest, inputUrl) && !pasteText) {
    throw new Error('No destination found');
  }
  return {
    service: serviceId,
    destination: dest,
    hops,
    kind: pasteText && (!dest || dest === inputUrl) ? 'paste' : lastKind,
    pasteText,
  };
}

export function parseInputUrls(raw) {
  const text = String(raw ?? '');
  const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const urls = [];
  for (const part of parts) {
    let candidate = part;
    if (!/^https?:\/\//i.test(candidate) && /^[\w.-]+\.[a-z]{2,}/i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    try {
      const href = new URL(candidate).href;
      if (href.length > MAX_URL_LEN) continue;
      assertSafeFetchUrl(href);
      if (!urls.includes(href)) urls.push(href);
    } catch { /* skip junk */ }
    if (urls.length >= MAX_URLS) break;
  }
  return urls;
}

export async function resolveMany(urlList) {
  const urls = Array.isArray(urlList) ? urlList.slice(0, MAX_URLS) : [];
  const results = [];
  for (const input of urls) {
    try {
      const href = assertSafeFetchUrl(input);
      if (href.length > MAX_URL_LEN) throw new Error('URL too long');
      const resolved = await resolveChain(href);
      results.push({
        input: href,
        service: resolved.service,
        ok: true,
        destination: resolved.destination,
        hops: resolved.hops,
        kind: resolved.kind,
        pasteText: resolved.pasteText || null,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bypass failed';
      const safe = /blocked|private|invalid url|protocol/i.test(msg)
        ? 'URL is not allowed'
        : (msg.length > 140 ? 'Bypass failed' : msg);
      results.push({
        input,
        service: identifyService(input)?.id ?? 'unknown',
        ok: false,
        destination: null,
        hops: [input],
        kind: 'url',
        pasteText: null,
        error: safe,
      });
    }
  }
  return results;
}

export { MAX_URLS, MAX_URL_LEN };
