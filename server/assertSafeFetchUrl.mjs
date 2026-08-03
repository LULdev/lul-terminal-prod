/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SSRF-safe URL validation + IP-pinned HTTP(S) fetch (anti DNS rebinding).
 */

import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'metadata',
]);

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18.0.0/15
    if (a >= 224) return true; // multicast + reserved
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('ff')) return true; // multicast
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
  }
  return false;
}

/** Decode decimal/hex IP literals that bypass net.isIP (e.g. 2130706433, 0x7f000001). */
function decodeIpLiteral(host) {
  const h = String(host ?? '').trim().toLowerCase();
  if (!h || net.isIP(h)) return h;

  if (/^0x[0-9a-f]+$/i.test(h)) {
    const num = Number.parseInt(h, 16);
    if (Number.isFinite(num) && num >= 0 && num <= 0xffffffff) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
    }
  }

  if (/^\d+$/.test(h)) {
    const num = Number(h);
    if (Number.isFinite(num) && num >= 0 && num <= 0xffffffff) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
    }
  }

  const octalParts = h.split('.');
  if (octalParts.length === 4 && octalParts.every((p) => /^0[0-7]+$/.test(p))) {
    const bytes = octalParts.map((p) => Number.parseInt(p, 8));
    if (bytes.every((b) => b >= 0 && b <= 255)) return bytes.join('.');
  }

  return h;
}

function normalizeDottedIpv4(host) {
  if (net.isIP(host)) return host;
  const parts = String(host).split('.');
  // Ambiguous leading-zero octets (e.g. 0177.0.0.1) — reject rather than mis-parse
  if (parts.length === 4 && parts.some((p) => /^0\d+$/.test(p))) {
    throw new Error('Blocked URL host');
  }
  if (parts.length > 0 && parts.length < 4 && parts.every((p) => /^\d+$/.test(p))) {
    const nums = parts.map(Number);
    if (!nums.some((n) => n < 0 || n > 255)) {
      while (nums.length < 4) nums.push(0);
      return nums.join('.');
    }
  }
  return host;
}

function assertHostAllowed(host) {
  let decoded;
  try {
    decoded = normalizeDottedIpv4(decodeIpLiteral(host));
  } catch {
    throw new Error('Blocked URL host');
  }
  if (BLOCKED_HOSTS.has(decoded)) throw new Error('Blocked URL host');
  if (decoded.endsWith('.local') || decoded.endsWith('.internal')) throw new Error('Blocked URL host');
  if (net.isIP(decoded) && isPrivateIp(decoded)) throw new Error('Blocked private IP');
}

/** Reject SSRF targets (localhost, RFC1918, link-local, non-http(s)). */
export function assertSafeFetchUrl(urlStr) {
  const raw = String(urlStr ?? '').trim();
  if (!raw) throw new Error('Invalid URL');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid URL protocol');
  assertHostAllowed(parsed.hostname.toLowerCase());
  return parsed.href;
}

/**
 * Resolve host to public IPs only. Returns { href, hostname, safeAddresses }.
 * Rejects if any resolved address is private (anti-rebinding at resolve time).
 */
export async function resolveSafeFetchTarget(urlStr) {
  const href = assertSafeFetchUrl(urlStr);
  const parsed = new URL(href);
  const host = parsed.hostname;

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Blocked private IP');
    return {
      href,
      hostname: host,
      safeAddresses: [{ address: host, family: net.isIPv6(host) ? 6 : 4 }],
    };
  }

  let results;
  try {
    results = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Blocked URL host');
  }
  if (!results?.length) throw new Error('Blocked URL host');

  for (const entry of results) {
    if (isPrivateIp(entry.address)) throw new Error('Blocked private IP');
  }
  return { href, hostname: host, safeAddresses: results };
}

/** DNS-resolve hostnames and reject if any address is private/link-local (anti-rebinding). */
export async function assertSafeFetchUrlAsync(urlStr) {
  const { href } = await resolveSafeFetchTarget(urlStr);
  return href;
}

/**
 * Low-level request pinned to a pre-validated IP (Host/SNI still use original hostname).
 * Prevents DNS rebinding TOCTOU between lookup and connect.
 */
function pinnedRequest(parsed, address, family, { method, headers, body, signal, timeoutMs = 30_000 }) {
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;
  const port = parsed.port
    ? Number(parsed.port)
    : (isHttps ? 443 : 80);
  const pathWithQuery = `${parsed.pathname || '/'}${parsed.search || ''}`;

  const reqHeaders = { ...(headers || {}) };
  // Ensure Host is the original hostname (not the IP)
  if (!reqHeaders.Host && !reqHeaders.host) {
    reqHeaders.Host = parsed.host;
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: address,
        port,
        path: pathWithQuery,
        method: method || 'GET',
        headers: reqHeaders,
        servername: isHttps ? parsed.hostname : undefined,
        family: family === 6 ? 6 : 4,
        // Do not re-resolve — we already connected by IP via hostname: address
        lookup: (hostname, opts, cb) => {
          // Pin: always return the pre-validated address
          cb(null, address, family === 6 ? 6 : 4);
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          // Minimal Response-like object compatible with callers expecting fetch Response
          const headersMap = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v == null) continue;
            if (Array.isArray(v)) v.forEach((item) => headersMap.append(k, item));
            else headersMap.set(k, v);
          }
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            headers: headersMap,
            url: parsed.href,
            async arrayBuffer() {
              return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            },
            async text() {
              return buf.toString('utf8');
            },
            async json() {
              return JSON.parse(buf.toString('utf8'));
            },
          });
        });
        res.on('error', reject);
      },
    );

    const onAbort = () => {
      req.destroy(new Error('Aborted'));
      reject(new Error('Aborted'));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timeout'));
      reject(new Error('Request timeout'));
    });
    req.on('error', reject);

    if (body != null && body !== '') {
      req.write(body);
    }
    req.end();
  });
}

/**
 * Fetch with manual redirect walking + IP pinning.
 * Re-validates each hop; connects only to pre-validated public IPs (anti DNS rebinding).
 */
export async function safeFetch(urlStr, init = {}, { maxRedirects = 5, timeoutMs = 30_000 } = {}) {
  let current = String(urlStr);
  const baseHeaders = { ...(init.headers ?? {}) };
  const { signal, method, body } = init;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const target = await resolveSafeFetchTarget(current);
    const parsed = new URL(target.href);
    // Prefer first public address; try next on connect failure
    let lastErr = null;
    let res = null;
    for (const entry of target.safeAddresses) {
      if (isPrivateIp(entry.address)) continue; // defensive
      try {
        res = await pinnedRequest(parsed, entry.address, entry.family, {
          method: method ?? 'GET',
          headers: baseHeaders,
          body,
          signal,
          timeoutMs,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!res) {
      throw lastErr || new Error('Blocked URL host');
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('Redirect without Location');
      current = new URL(loc, target.href).href;
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}
