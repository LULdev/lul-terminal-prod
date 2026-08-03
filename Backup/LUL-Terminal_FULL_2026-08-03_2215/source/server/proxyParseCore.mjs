/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared proxy line/text parsing with bulk auto-detect for common formats.
 */

export const IP_PORT = /(\d{1,3}(?:\.\d{1,3}){3})[:\s,|]+(\d{2,5})/g;
export const VALID_TYPES = new Set(['http', 'https', 'socks4', 'socks5']);

const IPV4 = String.raw`(\d{1,3}(?:\.\d{1,3}){3})`;
const PORT = String.raw`(\d{2,5})`;
const USER = String.raw`([^:\s@/]+)`;
const PASS = String.raw`([^:\s@/]+)`;

function validPort(n) {
  return Number.isFinite(n) && n >= 1 && n <= 65535;
}

function validIpv4(host) {
  const parts = String(host).split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === String(Number(p));
  });
}

function guessTypeFromPort(port) {
  if (port === 1080 || port === 1081 || port === 9050 || port === 9051) return 'socks5';
  if (port === 443 || port === 8443) return 'https';
  return null;
}

/**
 * Parse a single proxy line into { host, port, type, raw, typeExplicit, username?, password? }.
 * Supports:
 *   ip:port
 *   type://ip:port
 *   type://user:pass@ip:port
 *   user:pass@ip:port
 *   ip:port:user:pass
 *   user:pass:ip:port
 *   ip:port@user:pass
 *   host:port (hostname)
 *   ip port / ip,port / ip|port
 */
export function parseProxyLine(line, defaultType = 'http') {
  let s = String(line ?? '').trim();
  if (!s || s.startsWith('#') || s.startsWith('//') || s.startsWith(';')) return null;

  // Strip CSV wrapping quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  let type = VALID_TYPES.has(defaultType) ? defaultType : 'http';
  let typeExplicit = false;
  let username = null;
  let password = null;

  const proto = s.match(/^(https?|socks4|socks5):\/\//i);
  if (proto) {
    type = proto[1].toLowerCase();
    typeExplicit = true;
    s = s.slice(proto[0].length);
  }

  // user:pass@host:port
  const atAuth = s.match(new RegExp(`^${USER}:${PASS}@(.+)$`));
  if (atAuth) {
    username = atAuth[1];
    password = atAuth[2];
    s = atAuth[3];
  }

  // host:port@user:pass
  const atTrail = s.match(new RegExp(`^(.+)@${USER}:${PASS}$`));
  if (atTrail && !username) {
    s = atTrail[1];
    username = atTrail[2];
    password = atTrail[3];
  }

  s = s.split(/[/?#]/)[0].trim();
  // Normalize separators to colon where possible for host:port forms
  s = s.replace(/[\s,|]+/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');

  let host = '';
  let port = 0;

  // ip:port:user:pass
  let m = s.match(new RegExp(`^${IPV4}:${PORT}:${USER}:${PASS}$`));
  if (m && validIpv4(m[1])) {
    host = m[1];
    port = parseInt(m[2], 10);
    if (!username) {
      username = m[3];
      password = m[4];
    }
  }

  // user:pass:ip:port
  if (!host) {
    m = s.match(new RegExp(`^${USER}:${PASS}:${IPV4}:${PORT}$`));
    if (m && validIpv4(m[3])) {
      if (!username) {
        username = m[1];
        password = m[2];
      }
      host = m[3];
      port = parseInt(m[4], 10);
    }
  }

  // ip:port
  if (!host) {
    m = s.match(new RegExp(`^${IPV4}:${PORT}$`));
    if (m && validIpv4(m[1])) {
      host = m[1];
      port = parseInt(m[2], 10);
    }
  }

  // hostname:port
  if (!host) {
    m = s.match(/^([a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]|[a-zA-Z0-9]):(\d{2,5})$/);
    if (m) {
      host = m[1];
      port = parseInt(m[2], 10);
    }
  }

  if (!host || !validPort(port)) return null;
  if (host.includes('.') && /^\d/.test(host) && !validIpv4(host) && !/^[a-zA-Z]/.test(host)) {
    // Invalid partial IP-like host
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host)) return null;
  }

  if (!typeExplicit) {
    const guessed = guessTypeFromPort(port);
    if (guessed) type = guessed;
  }
  if (!VALID_TYPES.has(type)) type = 'http';

  const out = {
    host,
    port,
    type,
    raw: `${host}:${port}`,
    typeExplicit,
  };
  if (username != null) out.username = String(username).slice(0, 128);
  if (password != null) out.password = String(password).slice(0, 128);
  return out;
}

export function normalizeProxyEntry(entry, defaultType = 'http') {
  if (entry == null) return null;
  if (typeof entry === 'string') return parseProxyLine(entry, defaultType);

  const hint = VALID_TYPES.has(entry.type) ? entry.type : defaultType;
  const candidates = [
    entry.raw,
    entry.host != null && entry.port != null
      ? (entry.username && entry.password
        ? `${entry.username}:${entry.password}@${entry.host}:${entry.port}`
        : `${entry.host}:${entry.port}`)
      : null,
    entry.host,
  ].filter(Boolean);

  let base = null;
  for (const c of candidates) {
    base = parseProxyLine(String(c), hint);
    if (base) break;
  }
  if (!base) return null;

  return {
    host: base.host,
    port: base.port,
    type: entry.typeExplicit || base.typeExplicit ? base.type : hint,
    raw: `${base.host}:${base.port}`,
    typeExplicit: Boolean(entry.typeExplicit) || base.typeExplicit,
    username: entry.username ?? base.username,
    password: entry.password ?? base.password,
    sources: entry.sources,
    source: entry.source,
    addedAt: entry.addedAt,
  };
}

export function normalizeProxiesList(list, defaultType = 'http') {
  const seen = new Map();
  for (const item of list ?? []) {
    const p = normalizeProxyEntry(item, defaultType);
    if (!p) continue;
    const key = `${p.host}:${p.port}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

/**
 * Parse bulk text: multi-line, multi-format, aggressive IP:port extraction.
 */
export function parseProxiesFromText(text, defaultType = 'http') {
  const found = new Map();
  if (!text) return [];

  const add = (parsed) => {
    if (!parsed) return;
    const key = `${parsed.type}:${parsed.host}:${parsed.port}`;
    if (!found.has(key)) found.set(key, parsed);
  };

  // Per-line first (preserves auth/type schemes)
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Line may contain multiple proxies separated by spaces/tabs/commas
    const chunks = line.includes(',') || /\s{2,}|\t/.test(line)
      ? line.split(/[\s,;\t]+/).filter(Boolean)
      : [line];

    for (const chunk of chunks) {
      add(parseProxyLine(chunk, defaultType));
    }
  }

  // Aggressive full-text scan for bare IP:port (catches HTML tables, messy pastes)
  let m;
  const re = new RegExp(IP_PORT.source, 'g');
  while ((m = re.exec(String(text))) !== null) {
    if (!validIpv4(m[1])) continue;
    add(parseProxyLine(`${m[1]}:${m[2]}`, defaultType));
  }

  return [...found.values()];
}

/** Live auto-detect summary for paste UIs. */
export function detectProxyPaste(text, defaultType = 'http') {
  const proxies = parseProxiesFromText(text, defaultType);
  const byType = { http: 0, https: 0, socks4: 0, socks5: 0 };
  let withAuth = 0;
  let typeExplicit = 0;
  for (const p of proxies) {
    byType[p.type] = (byType[p.type] ?? 0) + 1;
    if (p.username) withAuth += 1;
    if (p.typeExplicit) typeExplicit += 1;
  }
  return {
    count: proxies.length,
    byType,
    withAuth,
    typeExplicit,
    sample: proxies.slice(0, 5).map((p) => ({
      raw: p.raw,
      type: p.type,
      hasAuth: Boolean(p.username),
    })),
  };
}
