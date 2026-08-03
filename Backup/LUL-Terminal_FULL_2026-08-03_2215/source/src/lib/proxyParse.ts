/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side bulk proxy paste auto-detect (mirrors server/proxyParseCore.mjs).
 */

import type { ProxyType } from './proxyScraper';

const IPV4 = String.raw`(\d{1,3}(?:\.\d{1,3}){3})`;
const PORT = String.raw`(\d{2,5})`;
const USER = String.raw`([^:\s@/]+)`;
const PASS = String.raw`([^:\s@/]+)`;
const IP_PORT = /(\d{1,3}(?:\.\d{1,3}){3})[:\s,|]+(\d{2,5})/g;
const VALID_TYPES = new Set(['http', 'https', 'socks4', 'socks5']);

export type DetectedProxy = {
  host: string;
  port: number;
  type: ProxyType;
  raw: string;
  typeExplicit: boolean;
  username?: string;
  password?: string;
};

export type ProxyPasteDetect = {
  count: number;
  byType: Record<ProxyType, number>;
  withAuth: number;
  typeExplicit: number;
  sample: { raw: string; type: ProxyType; hasAuth: boolean }[];
};

function validPort(n: number) {
  return Number.isFinite(n) && n >= 1 && n <= 65535;
}

function validIpv4(host: string) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === String(Number(p));
  });
}

function guessTypeFromPort(port: number): ProxyType | null {
  if (port === 1080 || port === 1081 || port === 9050 || port === 9051) return 'socks5';
  if (port === 443 || port === 8443) return 'https';
  return null;
}

export function parseProxyLine(line: string, defaultType: ProxyType = 'http'): DetectedProxy | null {
  let s = String(line ?? '').trim();
  if (!s || s.startsWith('#') || s.startsWith('//') || s.startsWith(';')) return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  let type: ProxyType = VALID_TYPES.has(defaultType) ? defaultType : 'http';
  let typeExplicit = false;
  let username: string | undefined;
  let password: string | undefined;

  const proto = s.match(/^(https?|socks4|socks5):\/\//i);
  if (proto) {
    type = proto[1].toLowerCase() as ProxyType;
    typeExplicit = true;
    s = s.slice(proto[0].length);
  }

  const atAuth = s.match(new RegExp(`^${USER}:${PASS}@(.+)$`));
  if (atAuth) {
    username = atAuth[1];
    password = atAuth[2];
    s = atAuth[3];
  }

  const atTrail = s.match(new RegExp(`^(.+)@${USER}:${PASS}$`));
  if (atTrail && !username) {
    s = atTrail[1];
    username = atTrail[2];
    password = atTrail[3];
  }

  s = s.split(/[/?#]/)[0].trim();
  s = s.replace(/[\s,|]+/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');

  let host = '';
  let port = 0;

  let m = s.match(new RegExp(`^${IPV4}:${PORT}:${USER}:${PASS}$`));
  if (m && validIpv4(m[1])) {
    host = m[1];
    port = parseInt(m[2], 10);
    if (!username) {
      username = m[3];
      password = m[4];
    }
  }

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

  if (!host) {
    m = s.match(new RegExp(`^${IPV4}:${PORT}$`));
    if (m && validIpv4(m[1])) {
      host = m[1];
      port = parseInt(m[2], 10);
    }
  }

  if (!host) {
    m = s.match(/^([a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]|[a-zA-Z0-9]):(\d{2,5})$/);
    if (m) {
      host = m[1];
      port = parseInt(m[2], 10);
    }
  }

  if (!host || !validPort(port)) return null;

  if (!typeExplicit) {
    const guessed = guessTypeFromPort(port);
    if (guessed) type = guessed;
  }
  if (!VALID_TYPES.has(type)) type = 'http';

  const out: DetectedProxy = {
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

export function parseProxiesFromText(text: string, defaultType: ProxyType = 'http'): DetectedProxy[] {
  const found = new Map<string, DetectedProxy>();
  if (!text) return [];

  const add = (parsed: DetectedProxy | null) => {
    if (!parsed) return;
    const key = `${parsed.type}:${parsed.host}:${parsed.port}`;
    if (!found.has(key)) found.set(key, parsed);
  };

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const chunks = line.includes(',') || /\s{2,}|\t/.test(line)
      ? line.split(/[\s,;\t]+/).filter(Boolean)
      : [line];
    for (const chunk of chunks) add(parseProxyLine(chunk, defaultType));
  }

  let m: RegExpExecArray | null;
  const re = new RegExp(IP_PORT.source, 'g');
  while ((m = re.exec(String(text))) !== null) {
    if (!validIpv4(m[1])) continue;
    add(parseProxyLine(`${m[1]}:${m[2]}`, defaultType));
  }

  return [...found.values()];
}

export function detectProxyPaste(text: string, defaultType: ProxyType = 'http'): ProxyPasteDetect {
  const proxies = parseProxiesFromText(text, defaultType);
  const byType: Record<ProxyType, number> = { http: 0, https: 0, socks4: 0, socks5: 0 };
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
