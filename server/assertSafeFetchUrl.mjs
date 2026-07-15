/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dns from 'dns/promises';
import net from 'net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
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
  const decoded = normalizeDottedIpv4(decodeIpLiteral(host));
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

/** DNS-resolve hostnames and reject if any address is private/link-local (anti-rebinding). */
export async function assertSafeFetchUrlAsync(urlStr) {
  const href = assertSafeFetchUrl(urlStr);
  const host = new URL(href).hostname;
  if (net.isIP(host)) return href;

  let results;
  try {
    results = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Blocked URL host');
  }

  for (const entry of results) {
    if (isPrivateIp(entry.address)) throw new Error('Blocked private IP');
  }
  return href;
}