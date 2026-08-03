/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multi-format proxy extraction: plain text, CSV/TSV, JSON, XML, HTML, base64, aggressive regex.
 */

import { parseProxyLine, parseProxiesFromText } from './proxyParseCore.mjs';
import { extractDataAttributes, extractJsStringArrayProxies, extractScriptJsonBlobs } from './proxyScraperDiscover.mjs';

const VALID_TYPES = new Set(['http', 'https', 'socks4', 'socks5']);
const IP = String.raw`\d{1,3}(?:\.\d{1,3}){3}`;

const HTML_ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeHtmlEntities(text) {
  let out = String(text ?? '');
  for (const [ent, ch] of Object.entries(HTML_ENTITIES)) {
    out = out.split(ent).join(ch);
  }
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return out;
}

function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '');
}

function normalizeType(raw, fallback = 'http') {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('socks5') || s === 's5') return 'socks5';
  if (s.includes('socks4') || s === 's4') return 'socks4';
  if (s.includes('https') || s === 'ssl') return 'https';
  if (s.includes('http')) return 'http';
  if (s.includes('socks')) return 'socks5';
  return VALID_TYPES.has(fallback) ? fallback : 'http';
}

function pushProxy(found, proxy, sourceId) {
  if (!proxy?.host || !proxy?.port) return;
  const key = `${proxy.type}:${proxy.host}:${proxy.port}`;
  if (!found.has(key)) {
    found.set(key, { ...proxy, raw: `${proxy.host}:${proxy.port}`, sources: sourceId ? [sourceId] : [] });
    return;
  }
  const ex = found.get(key);
  if (sourceId && !ex.sources.includes(sourceId)) ex.sources.push(sourceId);
}

function collectFromLines(lines, defaultType, found, sourceId) {
  for (const line of lines) {
    const p = parseProxyLine(line, defaultType);
    if (p) pushProxy(found, p, sourceId);
  }
}

/** ProxyScrape / pipe formats: HTTP://ip:port, SOCKS5|ip|port, socks5:ip:port */
export function parseProtocolIpPortText(text, defaultType = 'http', sourceId = null) {
  const found = new Map();
  for (const line of stripBom(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const pipe = trimmed.match(/^(https?|socks4|socks5|http|https)[\s:|]+(\d{1,3}(?:\.\d{1,3}){3})[\s:|]+(\d{2,5})$/i);
    if (pipe) {
      const type = normalizeType(pipe[1], defaultType);
      pushProxy(found, { host: pipe[2], port: parseInt(pipe[3], 10), type, raw: `${pipe[2]}:${pipe[3]}` }, sourceId);
      continue;
    }

    const p = parseProxyLine(trimmed, defaultType);
    if (p) pushProxy(found, p, sourceId);
  }
  return [...found.values()];
}

export function parseNdjson(text, defaultType = 'http', sourceId = null) {
  const found = new Map();
  for (const line of stripBom(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      walkJson(JSON.parse(t), defaultType, found, sourceId);
    } catch {
      /* skip */
    }
  }
  return [...found.values()];
}

/** Scan entire blob for ip:port, protocol URLs, JSON fragments, table cells. */
export function extractProxiesAggressive(text, defaultType = 'http', sourceId = null) {
  const found = new Map();
  const body = decodeHtmlEntities(stripBom(text));

  const patterns = [
    /(?:https?|socks4|socks5):\/\/(?:[^@\s<>"']+@)?(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})/gi,
    /(?:https?|socks4|socks5)[\s:|]+(\d{1,3}(?:\.\d{1,3}){3})[\s:|]+(\d{2,5})/gi,
    new RegExp(String.raw`\b(${IP})[:\s|,;|]+(\d{2,5})\b`, 'g'),
    new RegExp(String.raw`(${IP})[\s]+(\d{2,5})(?:\s|$)`, 'g'),
    new RegExp(String.raw`"ip"\s*:\s*"(${IP})"\s*,\s*"port"\s*:\s*"?(\d{2,5})"?`, 'gi'),
    new RegExp(String.raw`"host"\s*:\s*"(${IP})"\s*,\s*"port"\s*:\s*"?(\d{2,5})"?`, 'gi'),
    new RegExp(String.raw`<td[^>]*>\s*(${IP})\s*</td>\s*<td[^>]*>\s*(\d{2,5})\s*</td>`, 'gi'),
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) {
      const host = m[1];
      const port = parseInt(m[2], 10);
      if (port < 1 || port > 65535) continue;
      let type = defaultType;
      const prefix = body.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
      if (prefix.includes('socks5')) type = 'socks5';
      else if (prefix.includes('socks4')) type = 'socks4';
      else if (prefix.includes('https')) type = 'https';
      pushProxy(found, { host, port, type, raw: `${host}:${port}` }, sourceId);
    }
  }

  collectFromLines(body.split(/\r?\n/), defaultType, found, sourceId);
  return [...found.values()];
}

function tryDecodeBase64(text) {
  const s = text.replace(/\s+/g, '').trim();
  if (s.length < 32 || s.length % 4 !== 0 || !/^[A-Za-z0-9+/=]+$/.test(s)) return null;
  try {
    const decoded = Buffer.from(s, 'base64').toString('utf8');
    if (/[\x00-\x08\x0e-\x1f]/.test(decoded)) return null;
    if (new RegExp(IP).test(decoded)) return decoded;
  } catch {
    /* ignore */
  }
  return null;
}

function detectDelimiter(line) {
  const candidates = [',', ';', '|', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    const n = line.split(d).length;
    if (n > bestCount) {
      bestCount = n;
      best = d;
    }
  }
  return best;
}

function columnIndex(headers, names) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const name of names) {
    const idx = lower.indexOf(name);
    if (idx >= 0) return idx;
  }
  for (let i = 0; i < lower.length; i++) {
    if (names.some((n) => lower[i].includes(n))) return i;
  }
  return -1;
}

export function parseProxiesFromCsv(text, defaultType = 'http', sourceId = null) {
  const found = new Map();
  const lines = stripBom(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const delim = detectDelimiter(lines[0]);
  const header = lines[0].split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
  const hasHeader = /ip|host|port|address|proxy/i.test(header.join(' '));

  let ipIdx = -1;
  let portIdx = -1;
  let typeIdx = -1;
  let start = 0;

  if (hasHeader) {
    ipIdx = columnIndex(header, ['ip', 'host', 'address', 'server', 'hostname', 'proxy']);
    portIdx = columnIndex(header, ['port', 'proxy_port', 'server_port']);
    typeIdx = columnIndex(header, ['type', 'protocol', 'scheme', 'proxy_type']);
    start = 1;
  }

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (!cols.length) continue;

    let host = '';
    let port = 0;
    let type = defaultType;

    if (ipIdx >= 0 && portIdx >= 0 && cols[ipIdx] && cols[portIdx]) {
      host = cols[ipIdx];
      port = parseInt(cols[portIdx], 10);
      if (typeIdx >= 0 && cols[typeIdx]) type = normalizeType(cols[typeIdx], defaultType);
    } else {
      const ipCol = cols.find((c) => new RegExp(`^${IP}$`).test(c));
      const portCol = cols.find((c) => /^\d{2,5}$/.test(c));
      if (ipCol && portCol) {
        host = ipCol;
        port = parseInt(portCol, 10);
        const protoCol = cols.find((c) => /^(https?|socks4|socks5)$/i.test(c));
        if (protoCol) type = normalizeType(protoCol, defaultType);
      } else {
        const joined = cols.join(':');
        const p = parseProxyLine(joined, defaultType) || parseProxyLine(cols[0], defaultType);
        if (p) pushProxy(found, p, sourceId);
        continue;
      }
    }

    if (!host || port < 1 || port > 65535) continue;
    const parsed = parseProxyLine(`${host}:${port}`, type) || { host, port, type, raw: `${host}:${port}` };
    pushProxy(found, { ...parsed, type }, sourceId);
  }

  if (!found.size) {
    return extractProxiesAggressive(text, defaultType, sourceId);
  }
  return [...found.values()];
}

function walkJson(node, defaultType, found, sourceId, depth = 0) {
  if (depth > 12 || node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, defaultType, found, sourceId, depth + 1);
    return;
  }

  if (typeof node === 'string') {
    if (new RegExp(IP).test(node)) {
      for (const p of parseProxiesFromText(node, defaultType)) pushProxy(found, p, sourceId);
    }
    return;
  }

  if (typeof node !== 'object') return;

  const host = node.ip ?? node.IP ?? node.host ?? node.Host ?? node.address ?? node.server ?? node.hostname ?? node.proxy_host;
  const port = parseInt(
    node.port ?? node.Port ?? node.proxy_port ?? node.server_port ?? node.proxyPort,
    10,
  );
  const typeRaw = node.protocol ?? node.type ?? node.scheme ?? node.proxy_type ?? node.ProxyType;

  if (host && Number.isFinite(port) && port > 0 && port <= 65535) {
    const type = normalizeType(typeRaw, defaultType);
    const p = parseProxyLine(`${host}:${port}`, type) || { host: String(host), port, type, raw: `${host}:${port}` };
    pushProxy(found, p, sourceId);
  }

  const nestedKeys = ['proxies', 'data', 'list', 'results', 'items', 'records', 'rows', 'socks', 'http', 'https'];
  for (const key of nestedKeys) {
    if (node[key]) walkJson(node[key], normalizeType(key, defaultType), found, sourceId, depth + 1);
  }

  for (const value of Object.values(node)) {
    if (value && (typeof value === 'object' || typeof value === 'string')) {
      walkJson(value, defaultType, found, sourceId, depth + 1);
    }
  }
}

export function parseProxiesFromJson(text, defaultType = 'http', sourceId = null) {
  const found = new Map();
  try {
    const data = JSON.parse(stripBom(text));
    walkJson(data, defaultType, found, sourceId);
    if (found.size) return [...found.values()];
  } catch {
    /* fall through */
  }
  return extractProxiesAggressive(text, defaultType, sourceId);
}

export function parseProxiesFromXml(text, defaultType = 'http', sourceId = null) {
  const found = new Map();
  const body = stripBom(text);

  const blockRe = /<(?:proxy|item|row|server)[^>]*>([\s\S]*?)<\/(?:proxy|item|row|server)>/gi;
  let block;
  while ((block = blockRe.exec(body)) !== null) {
    const chunk = block[1];
    const ip = chunk.match(new RegExp(`<(?:ip|host|address)>([^<]+)</`, 'i'));
    const port = chunk.match(/<port>(\d{2,5})<\//i);
    const proto = chunk.match(/<(?:type|protocol)>([^<]+)</i);
    if (ip && port) {
      const type = normalizeType(proto?.[1], defaultType);
      const p = parseProxyLine(`${ip[1]}:${port[1]}`, type);
      if (p) pushProxy(found, p, sourceId);
    }
  }

  if (!found.size) return extractProxiesAggressive(body, defaultType, sourceId);
  return [...found.values()];
}

export function parseProxiesFromHtml(text, defaultType = 'http', sourceId = null) {
  const decoded = decodeHtmlEntities(stripBom(text));
  const found = new Map();

  for (const blob of extractScriptJsonBlobs(decoded)) {
    if (/^https?:\/\//i.test(blob)) {
      /* URL discovered in script — handled by engine discovery */
      continue;
    }
    for (const p of parseProxiesFromJson(blob, defaultType, sourceId)) {
      pushProxy(found, p, sourceId);
    }
  }

  for (const line of extractJsStringArrayProxies(decoded)) {
    const p = parseProxyLine(line, defaultType);
    if (p) pushProxy(found, p, sourceId);
  }

  for (const { host, port } of extractDataAttributes(decoded)) {
    if (port > 0 && port <= 65535) {
      const p = parseProxyLine(`${host}:${port}`, defaultType);
      if (p) pushProxy(found, p, sourceId);
    }
  }

  const textareaBlocks = decoded.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/gi) ?? [];
  for (const block of textareaBlocks) {
    const inner = block.replace(/<[^>]+>/g, '');
    for (const p of parseProtocolIpPortText(inner, defaultType, sourceId)) {
      pushProxy(found, p, sourceId);
    }
  }

  const hrefRe = /href=["']([^"']+)["']/gi;
  let href;
  while ((href = hrefRe.exec(decoded)) !== null) {
    const p = parseProxyLine(href[1], defaultType);
    if (p) pushProxy(found, p, sourceId);
  }

  const preBlocks = decoded.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi) ?? [];
  for (const block of preBlocks) {
    const inner = block.replace(/<[^>]+>/g, '\n');
    for (const p of extractProxiesAggressive(inner, defaultType, sourceId)) {
      pushProxy(found, p, sourceId);
    }
  }

  const textOnly = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ':')
    .replace(/<[^>]+>/g, ' ');

  for (const p of extractProxiesAggressive(textOnly, defaultType, sourceId)) {
    pushProxy(found, p, sourceId);
  }

  return [...found.values()];
}

export function detectContentFormat(text, source = {}) {
  const url = String(source.url ?? '').toLowerCase();
  const sample = stripBom(text).trim().slice(0, 4000);
  const lower = sample.toLowerCase();

  if (/^(https?|socks4|socks5)[\s:|\/]/im.test(sample.split('\n')[0] ?? '')) return 'protocol';
  if (sample.split('\n').filter((l) => l.trim().startsWith('{')).length >= 3) return 'ndjson';

  if (url.endsWith('.json') || sample.startsWith('{') || sample.startsWith('[')) return 'json';
  if (url.endsWith('.xml') || sample.startsWith('<?xml') || /^<\w+[^>]*>/.test(sample)) return 'xml';
  if (url.endsWith('.csv') || url.includes('data.csv')) return 'csv';
  if (url.endsWith('.tsv') || (sample.includes('\t') && /ip|host|port/i.test(sample.split('\n')[0] ?? ''))) return 'csv';
  if (/<html|<table|<body|<!doctype/i.test(lower)) return 'html';
  if (/^[A-Za-z0-9+/=\s]{80,}$/.test(sample.replace(/\s/g, ''))) return 'base64';

  const lines = sample.split(/\r?\n/).filter(Boolean);
  if (lines.length > 1) {
    const delim = detectDelimiter(lines[0]);
    if (lines[0].split(delim).length >= 2 && /ip|host|port/i.test(lines[0])) return 'csv';
  }

  return 'text';
}

export function parseSourceBody(text, source = {}) {
  const defaultType = VALID_TYPES.has(source.type) ? source.type : 'http';
  const sourceId = source.id ?? null;
  const body = stripBom(text);

  const b64 = tryDecodeBase64(body);
  if (b64) {
    const fromB64 = parseSourceBody(b64, source);
    if (fromB64.length) return fromB64;
  }

  const format = detectContentFormat(body, source);

  const merged = new Map();

  const absorb = (list) => {
    for (const p of list ?? []) pushProxy(merged, p, sourceId);
  };

  switch (format) {
    case 'json':
      absorb(parseProxiesFromJson(body, defaultType, sourceId));
      break;
    case 'ndjson':
      absorb(parseNdjson(body, defaultType, sourceId));
      break;
    case 'protocol':
      absorb(parseProtocolIpPortText(body, defaultType, sourceId));
      break;
    case 'csv':
      absorb(parseProxiesFromCsv(body, defaultType, sourceId));
      break;
    case 'xml':
      absorb(parseProxiesFromXml(body, defaultType, sourceId));
      break;
    case 'html':
      absorb(parseProxiesFromHtml(body, defaultType, sourceId));
      break;
    default:
      break;
  }

  absorb(parseProtocolIpPortText(body, defaultType, sourceId));
  absorb(parseProxiesFromText(body, defaultType).map((p) => ({ ...p, sources: sourceId ? [sourceId] : [] })));

  if (merged.size < 3) {
    absorb(extractProxiesAggressive(body, defaultType, sourceId));
  }

  if (format === 'html' || format === 'text') {
    absorb(parseProxiesFromJson(body, defaultType, sourceId));
  }

  return [...merged.values()];
}