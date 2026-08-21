/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Members-only link resolver. Linkvertise is the primary path; other lockers
 * use redirect following, dest-param unwrap, HTML extract, then public APIs.
 */

import zlib from 'zlib';
import { AsyncLocalStorage } from 'node:async_hooks';
import { assertSafeFetchUrl, resolveSafeFetchTarget, safeFetch } from './assertSafeFetchUrl.mjs';

const bypassCtx = new AsyncLocalStorage();
function currentSignal() {
  return bypassCtx.getStore()?.signal;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const TIMEOUT_MS = 12_000;
const URL_BUDGET_MS = 25_000;
const MAX_HOPS = 6;
const MAX_URLS = 8;
const MAX_URL_LEN = 2048;
const MAX_PASTE_CHARS = 8_000;

const DEST_PARAM_KEYS = ['url', 'r', 'u', 'q', 'target', 'dest', 'destination', 'redirect', 'link', 'goto', 'out', 'to'];

const JUNK_HOST_RE = /(google-analytics|googletagmanager|doubleclick|googlesyndication|googleadservices|facebook\.net|fbcdn|gstatic\.com|cloudflareinsights|scorecardresearch|hotjar|sentry\.io|newrelic|adnxs|adsystem|taboola|outbrain|quantserve)/i;

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
  { id: 'googl', label: 'Google URL', kind: 'shortener', hosts: ['goo.gl'] },
  { id: 'isgd', label: 'is.gd / v.gd', kind: 'shortener', hosts: ['is.gd', 'v.gd', 'cl.gy'] },
  { id: 'tly', label: 't.ly', kind: 'shortener', hosts: ['t.ly'] },
  { id: 'rebrandly', label: 'Rebrandly', kind: 'shortener', hosts: ['rebrand.ly'] },
  { id: 'cutty', label: 'Cutty / Shorte', kind: 'shortener', hosts: ['cutt.ly', 'cutty.net', 'shorte.st', 'shorter.me', 'shrinkme.click'] },
  { id: 'pastebin', label: 'Pastebin', kind: 'paste', hosts: ['pastebin.com'] },
  { id: 'rentry', label: 'Rentry', kind: 'paste', hosts: ['rentry.org', 'rentry.co'] },
  { id: 'hastebin', label: 'Hastebin', kind: 'paste', hosts: ['hastebin.com', 'hastebin.skyra.pw'] },
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
  return String(hostname ?? '').toLowerCase().replace(/^www\./, '');
}

export function identifyService(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = apexHost(u.hostname);

    if (host === 'google.com' || host.endsWith('.google.com')) {
      if (u.pathname.startsWith('/url')) return HOST_TO_SERVICE.get('goo.gl') ?? null;
      return null;
    }
    if (host === 'toptal.com' || host.endsWith('.toptal.com')) {
      if (u.pathname.toLowerCase().includes('hastebin')) {
        return HOST_TO_SERVICE.get('hastebin.com') ?? null;
      }
      return null;
    }

    if (HOST_TO_SERVICE.has(host)) return HOST_TO_SERVICE.get(host);
    const parts = host.split('.');
    if (parts.length > 2) {
      const parent = parts.slice(-2).join('.');
      if (parent === 'google.com' || parent === 'toptal.com') return null;
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

function isJunkDest(url, fromUrl) {
  try {
    const u = new URL(url);
    if (JUNK_HOST_RE.test(u.hostname)) return true;
    if (/\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ico|map)(\?|$)/i.test(u.pathname)) return true;
    if (fromUrl && sameResource(url, fromUrl)) return true;
    return false;
  } catch {
    return true;
  }
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
  if (apexHost(parsed.hostname) === 'google.com' && parsed.pathname.startsWith('/url')) {
    const q = tryDecodeUrlish(parsed.searchParams.get('q') || parsed.searchParams.get('url') || '');
    if (q && !isJunkDest(q, urlStr)) return q;
  }
  const svc = identifyService(urlStr);
  const allow = !svc
    || svc.kind === 'generic'
    || svc.kind === 'shortener'
    || svc.kind === 'locker'
    || svc.kind === 'unlock'
    || svc.id === 'googl';
  if (!allow) return null;
  for (const key of DEST_PARAM_KEYS) {
    const raw = parsed.searchParams.get(key);
    if (!raw) continue;
    const dest = tryDecodeUrlish(raw);
    if (!dest || isJunkDest(dest, urlStr)) continue;
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
      const dest = new URL(meta[1].trim(), pageUrl).href;
      if (looksHttpUrl(dest) && !isJunkDest(dest, pageUrl)) return dest;
    } catch { /* ignore */ }
  }

  const patterns = [
    /["'](?:target|destination|dest_url|final_url|redirect_url|redirectUrl|targetUrl|out)["']\s*[:=]\s*["'](https?:[^"']+)/i,
    /(?:window|document)\.location(?:\.href)?\s*=\s*["'](https?:[^"']+)/i,
    /data-(?:url|href|target|link)=["'](https?:[^"']+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && looksHttpUrl(m[1])) {
      try {
        const dest = new URL(m[1], pageUrl).href;
        if (!isJunkDest(dest, pageUrl) && apexHost(new URL(dest).hostname) !== apexHost(new URL(pageUrl).hostname)) {
          return dest;
        }
      } catch { /* ignore */ }
    }
  }

  const jsonUrl = text.match(/"(?:target|destination|dest_url|final_url)"\s*:\s*"((?:https?:|\\u002F\\u002F)[^"]+)"/i);
  if (jsonUrl?.[1]) {
    let raw = jsonUrl[1];
    try {
      raw = JSON.parse(`"${raw}"`);
    } catch {
      raw = raw.replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
    }
    if (looksHttpUrl(raw) && !isJunkDest(raw, pageUrl) && !isLockerUrl(raw)) return raw;
  }

  return null;
}

function extractJsonDest(obj, depth = 0) {
  if (obj == null || depth > 6) return null;
  if (typeof obj === 'string' && looksHttpUrl(obj) && !isJunkDest(obj)) return obj.trim();
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const d = extractJsonDest(item, depth + 1);
      if (d) return d;
    }
    return null;
  }
  if (typeof obj !== 'object') return null;
  const prefer = ['target', 'destination', 'dest', 'result', 'final_url', 'redirect', 'paste', 'link', 'url'];
  for (const key of prefer) {
    if (obj[key] != null) {
      const d = extractJsonDest(obj[key], depth + 1);
      if (d) return d;
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const d = extractJsonDest(value, depth + 1);
      if (d) return d;
    }
  }
  return null;
}

function createJar() {
  /** @type {Map<string, string>} */
  const map = new Map();
  return {
    apply(headers) {
      if (!map.size) return;
      headers.Cookie = [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    eat(res) {
      const fromRes = typeof res.getSetCookie === 'function' ? res.getSetCookie() : [];
      const fromHeaders = typeof res.headers?.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      const all = (fromRes && fromRes.length) ? fromRes : (fromHeaders || []);
      for (const c of all) {
        const nv = String(c).split(';')[0];
        const eq = nv.indexOf('=');
        if (eq <= 0) continue;
        const name = nv.slice(0, eq).trim();
        const val = nv.slice(eq + 1).trim();
        // Reject CTL / separators so Cookie cannot inject request headers
        if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]{1,128}$/.test(name)) continue;
        if (val.length > 4096 || /[\x00-\x1f\x7f;,\\]/.test(val)) continue;
        map.set(name, val);
      }
    },
  };
}

async function request(url, init = {}, { timeoutMs = TIMEOUT_MS, maxRedirects } = {}) {
  const signal = init.signal || currentSignal();
  if (signal?.aborted) throw new Error('Aborted');
  const href = assertSafeFetchUrl(url);
  const method = String(init.method ?? 'GET').toUpperCase();
  const headers = {
    'User-Agent': UA,
    Accept: 'text/html,application/json,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    ...(init.headers ?? {}),
  };
  headers['Accept-Encoding'] = 'identity';
  if (init.jar) init.jar.apply(headers);
  const body = init.body;
  if (body != null && body !== '' && !headers['Content-Length'] && !headers['content-length']) {
    headers['Content-Length'] = String(Buffer.byteLength(String(body)));
  }
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const hops = maxRedirects ?? (isWrite ? 0 : 6);
  const res = await safeFetch(
    href,
    { method, headers, body, signal },
    { maxRedirects: hops, timeoutMs, stopOnRedirect: isWrite || hops === 0 },
  );
  if (init.jar) init.jar.eat(res);

  let finalUrl = res.url || href;
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (loc) {
      try {
        finalUrl = assertSafeFetchUrl(new URL(loc, href).href);
      } catch { /* keep finalUrl */ }
    }
  }

  const encoding = String(res.headers.get('content-encoding') ?? '').toLowerCase();
  let text;
  if (encoding.includes('gzip') || encoding.includes('deflate')) {
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      text = (encoding.includes('gzip') ? zlib.gunzipSync(buf) : zlib.inflateSync(buf)).toString('utf8');
    } catch {
      text = buf.toString('utf8');
    }
  } else {
    text = await res.text();
  }

  let json = null;
  const ct = String(res.headers.get('content-type') ?? '');
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (ct.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      json = JSON.parse(trimmed);
    } catch { /* ignore */ }
  }
  return { ok: res.ok, status: res.status, url: finalUrl, text, json, headers: res.headers };
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

function sameHref(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    ua.hash = '';
    ub.hash = '';
    return ua.href === ub.href;
  } catch {
    return a === b;
  }
}

function isLockerUrl(url) {
  const svc = identifyService(url);
  return Boolean(svc && (svc.kind === 'locker' || svc.kind === 'unlock'));
}

function usableDest(dest, fromUrl) {
  if (!dest || !looksHttpUrl(dest) || isJunkDest(dest, fromUrl) || sameResource(dest, fromUrl)) return false;
  try {
    const href = assertSafeFetchUrl(dest);
    const u = new URL(href);
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

/** DNS-checked public http(s) dest — blocks private/literal/rebind hosts before we return them. */
async function asPublicDest(urlStr) {
  if (!looksHttpUrl(urlStr)) return null;
  try {
    const { href } = await resolveSafeFetchTarget(urlStr);
    const u = new URL(href);
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

async function followShort(url) {
  const res = await request(url, { method: 'GET' }, { maxRedirects: 8, timeoutMs: TIMEOUT_MS });
  const hops = [];
  const landed = res.url || url;
  const redirected = Boolean(res.url && !sameResource(res.url, url));
  if (redirected) hops.push(res.url);
  const stillLocker = isLockerUrl(landed);
  const svc = identifyService(landed);

  const canUnwrap = stillLocker || svc?.kind === 'generic' || svc?.kind === 'shortener' || svc?.id === 'googl';
  if (canUnwrap) {
    const q = unwrapQueryDest(landed);
    if (usableDest(q, landed)) return { dest: q, hops: [...hops, q], html: res.text, json: res.json, finalUrl: landed };
  }

  if (redirected && !stillLocker) {
    return { dest: landed, hops, html: res.text, json: res.json, finalUrl: landed };
  }

  const htmlDest = extractDestFromHtml(res.text, landed);
  if (usableDest(htmlDest, url) && !sameResource(htmlDest, landed)) {
    return { dest: htmlDest, hops: [...hops, htmlDest], html: res.text, json: res.json, finalUrl: landed };
  }
  if (res.json) {
    const jd = extractJsonDest(res.json);
    if (usableDest(jd, url)) return { dest: jd, hops: [...hops, jd], html: res.text, json: res.json, finalUrl: landed };
  }
  if (redirected) {
    return { dest: landed, hops, html: res.text, json: res.json, finalUrl: landed };
  }
  return { dest: null, hops, html: res.text, json: res.json, finalUrl: landed };
}

function safeDecodeUri(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
    if (!slug) return id;
    const decoded = safeDecodeUri(slug);
    return `${id}/${encodeURIComponent(decoded)}`;
  }
  return null;
}

function lvSerial(linkId) {
  const n = Number(linkId);
  return Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    random: '6548307',
    link_id: Number.isFinite(n) ? n : linkId,
  })).toString('base64');
}

const LV_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://linkvertise.com',
  Referer: 'https://linkvertise.com/',
};

async function resolveLinkvertise(url) {
  const queryDest = unwrapQueryDest(url);
  if (usableDest(queryDest, url) && !isLockerUrl(queryDest)) return { dest: queryDest, paste: null };

  const jar = createJar();
  try {
    const page = await request(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      jar,
    });
    if (page.url && usableDest(page.url, url) && !isLockerUrl(page.url)) {
      return { dest: page.url, paste: null };
    }
    const fromPage = extractDestFromHtml(page.text, page.url || url);
    if (usableDest(fromPage, url) && !isLockerUrl(fromPage)) return { dest: fromPage, paste: null };
  } catch { /* landing HTML is best-effort */ }

  const path = lvPathFromUrl(url);
  if (!path) {
    const followed = await followShort(url);
    if (usableDest(followed.dest, url) && !isLockerUrl(followed.dest)) return { dest: followed.dest, paste: null };
    throw new Error('Could not parse Linkvertise URL');
  }

  const idOnly = path.split('/')[0];
  // encoded path + numeric id only — never interpolate decoded slugs (CRLF/header injection)
  const pathVariants = [...new Set([path, idOnly])];

  let link = null;
  let userToken = null;
  let staticRes = null;
  let usedPath = path;

  for (const p of pathVariants) {
    staticRes = await request(
      `https://publisher.linkvertise.com/api/v1/redirect/link/static/${p}?origin=&resolution=1920x1080`,
      { headers: LV_HEADERS, jar },
    );
    link = staticRes.json?.data?.link ?? staticRes.json?.link ?? null;
    userToken = staticRes.json?.user_token ?? staticRes.json?.data?.user_token ?? userToken;
    if (link?.id) {
      usedPath = p;
      break;
    }
  }

  if (!userToken) {
    const acc = await request('https://publisher.linkvertise.com/api/v1/account', { headers: LV_HEADERS, jar });
    userToken = acc.json?.user_token ?? acc.json?.data?.user_token ?? null;
  }

  const typeRaw = String(link?.target_type ?? 'URL').toUpperCase();
  const type = typeRaw === 'PASTE' ? 'paste' : 'target';
  const linkId = link?.id;

  const warmup = [
    `/captcha`,
    `/countdown_impression?trafficOrigin=network`,
    `/todo_impression?mobile=true&trafficOrigin=network`,
    `/click?trafficOrigin=network`,
  ];
  for (const suffix of warmup) {
    try {
      await request(
        `https://publisher.linkvertise.com/api/v1/redirect/link/${usedPath}${suffix}`,
        { headers: LV_HEADERS, jar },
        { timeoutMs: 6_000, maxRedirects: 2 },
      );
    } catch { /* warmup is best-effort */ }
  }

  if (linkId) {
    const serial = lvSerial(linkId);
    const ut = userToken ? `?X-Linkvertise-UT=${encodeURIComponent(userToken)}` : '';
    const posted = await request(
      `https://publisher.linkvertise.com/api/v1/redirect/link/${usedPath}/${type}${ut}`,
      {
        method: 'POST',
        headers: {
          ...LV_HEADERS,
          'Content-Type': 'application/json',
          ...(userToken ? { 'X-Linkvertise-UT': userToken } : {}),
        },
        body: JSON.stringify({ serial }),
        jar,
      },
    );
    const dest = posted.json?.data?.target
      || posted.json?.data?.paste
      || extractJsonDest(posted.json)
      || (posted.status >= 300 && posted.status < 400 && looksHttpUrl(posted.url) ? posted.url : null);
    if (usableDest(dest, url)) {
      const paste = type === 'paste' && posted.json?.data?.paste && !looksHttpUrl(String(posted.json.data.paste))
        ? String(posted.json.data.paste)
        : null;
      return { dest, paste };
    }

    const getTarget = await request(
      `https://publisher.linkvertise.com/api/v1/redirect/link/${usedPath}/target?serial=${encodeURIComponent(serial)}${userToken ? `&X-Linkvertise-UT=${encodeURIComponent(userToken)}` : ''}`,
      { headers: LV_HEADERS, jar },
    );
    const dest2 = getTarget.json?.data?.target || getTarget.json?.data?.paste || extractJsonDest(getTarget.json);
    if (usableDest(dest2, url)) return { dest: dest2, paste: null };
  }

  const htmlDest = staticRes ? extractDestFromHtml(staticRes.text, url) : null;
  if (usableDest(htmlDest, url) && !isLockerUrl(htmlDest)) return { dest: htmlDest, paste: null };

  throw new Error('Linkvertise did not return a destination');
}

async function resolveWorkink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid work.ink URL');
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  const code = parts[0] || '';
  const apis = [];
  if (code) {
    apis.push(`https://work.ink/_api/v2/link/${encodeURIComponent(code)}`);
    apis.push(`https://work.ink/api/v2/public/links/${encodeURIComponent(code)}`);
    apis.push(`https://work.ink/_api/v1/link/${encodeURIComponent(code)}`);
  }
  if (parts.length >= 2) {
    apis.push(`https://work.ink/_api/v2/link/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`);
  }
  for (const api of apis) {
    try {
      const res = await request(api, {
        headers: { Accept: 'application/json', Referer: url, Origin: 'https://work.ink' },
      }, { timeoutMs: 8_000, maxRedirects: 3 });
      const dest = res.json?.destination || res.json?.data?.destination || extractJsonDest(res.json);
      if (usableDest(dest, url) && !isLockerUrl(dest)) return { dest, paste: null };
    } catch { /* next */ }
  }
  const followed = await followShort(url);
  if (usableDest(followed.dest, url) && !isLockerUrl(followed.dest)) return { dest: followed.dest, paste: null };
  throw new Error('Could not bypass Work.ink');
}

async function resolveAdfoc(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid AdFoc URL');
  }
  const id = parsed.pathname.split('/').filter(Boolean)[0];
  if (id && /^\d+$/.test(id)) {
    for (const proto of ['https', 'http']) {
      try {
        const followed = await followShort(`${proto}://adfoc.us/serve/sitelinks/?id=${id}`);
        if (usableDest(followed.dest, url) && !isLockerUrl(followed.dest)) return { dest: followed.dest, paste: null };
      } catch { /* next */ }
    }
  }
  const followed = await followShort(url);
  if (usableDest(followed.dest, url) && !isLockerUrl(followed.dest)) return { dest: followed.dest, paste: null };
  throw new Error('Could not bypass AdFoc.us');
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
        if (usableDest(dest, url)) return { dest, paste: null };
        continue;
      }
      const urls = extractUrlsFromText(lastText).filter((u) => usableDest(u, url));
      if (urls.length) return { dest: urls[0], paste: lastText.slice(0, MAX_PASTE_CHARS) };
      return { dest: null, paste: lastText.slice(0, MAX_PASTE_CHARS) };
    } catch { /* try next raw candidate */ }
  }
  if (lastText.trim()) {
    const dest = extractDestFromHtml(lastText, url);
    return { dest: usableDest(dest, url) ? dest : null, paste: lastText.slice(0, MAX_PASTE_CHARS) };
  }
  throw new Error('Could not read paste');
}

async function tryPublicBypassApis(url) {
  const tries = [
    { href: `https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`, method: 'GET' },
    { href: 'https://api.bypass.vip/bypass', method: 'POST', body: JSON.stringify({ url }) },
    { href: `https://bypass.bot.nu/bypass2?url=${encodeURIComponent(url)}`, method: 'GET' },
  ];
  for (const t of tries) {
    try {
      const res = await request(t.href, {
        method: t.method,
        headers: {
          Accept: 'application/json',
          ...(t.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: t.body,
      }, { timeoutMs: 8_000, maxRedirects: 3 });
      const dest = res.json?.result
        || res.json?.destination
        || res.json?.data?.destination
        || res.json?.data?.target
        || extractJsonDest(res.json);
      if (usableDest(dest, url) && !isLockerUrl(dest)) return dest;
    } catch { /* next API */ }
  }
  return null;
}

async function resolveKnown(url, service) {
  const q = unwrapQueryDest(url);
  if (usableDest(q, url)) {
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
  if (service.id === 'workink') {
    try {
      return await resolveWorkink(url);
    } catch (err) {
      const apiDest = await tryPublicBypassApis(url);
      if (apiDest) return { dest: apiDest, paste: null };
      throw err;
    }
  }
  if (service.id === 'adfoc') return resolveAdfoc(url);
  if (service.kind === 'paste') return resolvePaste(url, service.id);

  const followed = await followShort(url);
  if (usableDest(followed.dest, url)) return { dest: followed.dest, paste: null };
  if (followed.json) {
    const jd = extractJsonDest(followed.json);
    if (usableDest(jd, url)) return { dest: jd, paste: null };
  }

  const apiDest = await tryPublicBypassApis(url);
  if (apiDest) return { dest: apiDest, paste: null };

  if (followed.html) {
    const htmlDest = extractDestFromHtml(followed.html, followed.finalUrl || url);
    if (usableDest(htmlDest, url)) return { dest: htmlDest, paste: null };
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
      if (usableDest(extra, current)) {
        const pub = await asPublicDest(extra);
        if (!pub || hops.some((h) => sameHref(h, pub))) break;
        hops.push(pub);
        current = pub;
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
    if (resolved.dest && looksHttpUrl(resolved.dest) && !sameResource(resolved.dest, current) && !isJunkDest(resolved.dest, current)) {
      const pub = await asPublicDest(resolved.dest);
      if (!pub) throw new Error('No destination found');
      if (hops.some((h) => sameHref(h, pub))) {
        throw new Error('No destination found');
      }
      hops.push(pub);
      current = pub;
      lastKind = resolved.paste && !looksHttpUrl(resolved.dest) ? 'paste' : 'url';
      const nextSvc = identifyService(current);
      if (!nextSvc) break;
      if (nextSvc.kind === 'paste' && lastKind === 'paste') break;
      continue;
    }
    if (resolved.paste) break;
    throw new Error('No destination found');
  }

  const dest = hops[hops.length - 1];
  if (!dest || (sameResource(dest, inputUrl) && !pasteText)) {
    throw new Error('No destination found');
  }
  if (isLockerUrl(dest) && !pasteText) {
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
  const parts = text.split(/\s+/).map((s) => s.trim().replace(/^["'<\[]+|["'>\]]+$/g, '')).filter(Boolean);
  const urls = [];
  for (const part of parts) {
    let candidate = part.replace(/[,\s]+$/g, '');
    if (!/^https?:\/\//i.test(candidate) && /^[\w.-]+\.[a-z]{2,}/i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    try {
      const parsed = new URL(candidate);
      if (parsed.username || parsed.password) continue;
      const href = parsed.href;
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
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), URL_BUDGET_MS);
    if (typeof timer.unref === 'function') timer.unref();
    try {
      const href = assertSafeFetchUrl(input);
      if (href.length > MAX_URL_LEN) throw new Error('URL too long');
      const resolved = await bypassCtx.run({ signal: ac.signal }, () => resolveChain(href));
      const dest = resolved.destination ? await asPublicDest(resolved.destination) : null;
      if (!dest && !resolved.pasteText) throw new Error('No destination found');
      results.push({
        input: href,
        service: resolved.service,
        ok: true,
        destination: dest,
        hops: resolved.hops,
        kind: resolved.kind,
        pasteText: resolved.pasteText || null,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bypass failed';
      const timedOut = ac.signal.aborted || /aborted|timeout/i.test(msg);
      const safe = timedOut
        ? 'Bypass timed out'
        : (/blocked|private|invalid url|protocol/i.test(msg)
          ? 'URL is not allowed'
          : (msg.length > 140 ? 'Bypass failed' : msg));
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
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}

export { MAX_URLS, MAX_URL_LEN };
