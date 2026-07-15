/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const IP_PORT = /(\d{1,3}(?:\.\d{1,3}){3})[:\s]+(\d{2,5})/g;
export const VALID_TYPES = new Set(['http', 'https', 'socks4', 'socks5']);

export function parseProxyLine(line, defaultType = 'http') {
  let s = String(line ?? '').trim();
  if (!s || s.startsWith('#') || s.startsWith('//')) return null;

  let type = VALID_TYPES.has(defaultType) ? defaultType : 'http';
  let typeExplicit = false;

  const proto = s.match(/^(https?|socks4|socks5):\/\//i);
  if (proto) {
    type = proto[1].toLowerCase();
    typeExplicit = true;
    s = s.slice(proto[0].length);
  }

  const at = s.lastIndexOf('@');
  if (at >= 0) s = s.slice(at + 1);

  s = s.split(/[/?#]/)[0].replace(/\s+/g, '').trim();

  let host = '';
  let port = 0;

  const ipMatch = s.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$/);
  if (ipMatch) {
    host = ipMatch[1];
    port = parseInt(ipMatch[2], 10);
  } else {
    const hostMatch = s.match(/^([a-zA-Z0-9][a-zA-Z0-9.-]*):(\d{2,5})$/);
    if (hostMatch) {
      host = hostMatch[1];
      port = parseInt(hostMatch[2], 10);
    }
  }

  if (!host || port < 1 || port > 65535) return null;
  if (!VALID_TYPES.has(type)) type = 'http';

  return { host, port, type, raw: `${host}:${port}`, typeExplicit };
}

export function normalizeProxyEntry(entry, defaultType = 'http') {
  if (entry == null) return null;
  if (typeof entry === 'string') return parseProxyLine(entry, defaultType);

  const hint = VALID_TYPES.has(entry.type) ? entry.type : defaultType;
  const candidates = [
    entry.raw,
    entry.host != null && entry.port != null ? `${entry.host}:${entry.port}` : null,
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
    type: entry.typeExplicit ? base.type : hint,
    raw: `${base.host}:${base.port}`,
    typeExplicit: Boolean(entry.typeExplicit) || base.typeExplicit,
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

export function parseProxiesFromText(text, defaultType = 'http') {
  const found = new Map();
  if (!text) return [];

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseProxyLine(line, defaultType);
    if (!parsed) continue;
    const key = `${parsed.type}:${parsed.host}:${parsed.port}`;
    if (!found.has(key)) found.set(key, parsed);
  }

  if (found.size === 0) {
    let m;
    const re = new RegExp(IP_PORT.source, 'g');
    while ((m = re.exec(text)) !== null) {
      const parsed = parseProxyLine(`${m[1]}:${m[2]}`, defaultType);
      if (!parsed) continue;
      const key = `${parsed.type}:${parsed.host}:${parsed.port}`;
      if (!found.has(key)) found.set(key, parsed);
    }
  }

  return [...found.values()];
}