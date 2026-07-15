/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

const TRUSTED_PROXY_IPS = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? '127.0.0.1,::1,::ffff:127.0.0.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

let cachedAllowedHosts = null;

function isTrustedProxyHop(remote) {
  if (!remote) return false;
  return TRUSTED_PROXY_IPS.has(remote);
}

function sanitizeProto(raw) {
  const first = String(raw ?? 'http').split(',')[0].trim().toLowerCase();
  return first === 'https' ? 'https' : 'http';
}

function sanitizeHost(raw) {
  const host = String(raw ?? 'localhost:3000').split(',')[0].trim();
  if (!host || /[\s\r\n@]/.test(host)) return 'localhost:3000';
  return host.slice(0, 200);
}

function normalizeHostKey(host) {
  const h = sanitizeHost(host).toLowerCase();
  const bare = h.split(':')[0];
  return { full: h, bare };
}

function getAllowedPublicHosts() {
  if (cachedAllowedHosts) return cachedAllowedHosts;
  const hosts = new Set();
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    try {
      const { host } = new URL(configured);
      if (host) hosts.add(host.toLowerCase());
    } catch { /* ignore invalid PUBLIC_BASE_URL */ }
  }
  for (const entry of String(process.env.ALLOWED_PUBLIC_HOSTS ?? '').split(',')) {
    const trimmed = entry.trim().toLowerCase();
    if (!trimmed) continue;
    hosts.add(trimmed);
    const bare = trimmed.split(':')[0];
    if (bare) hosts.add(bare);
  }
  cachedAllowedHosts = hosts;
  return hosts;
}

function isAllowedForwardedHost(host) {
  const { full, bare } = normalizeHostKey(host);
  const allowed = getAllowedPublicHosts();
  if (!allowed.size) {
    return process.env.NODE_ENV !== 'production';
  }
  return allowed.has(full) || allowed.has(bare);
}

function pickPublicHost(req, trustForwarded) {
  const directHost = sanitizeHost(req.headers.host || 'localhost:3000');
  if (!trustForwarded) return directHost;

  const forwardedRaw = req.headers['x-forwarded-host'];
  if (!forwardedRaw) return directHost;

  const forwarded = sanitizeHost(forwardedRaw);
  if (isAllowedForwardedHost(forwarded)) return forwarded;

  if (process.env.NODE_ENV === 'production') {
    console.warn('[origin] rejected X-Forwarded-Host — not in ALLOWED_PUBLIC_HOSTS / PUBLIC_BASE_URL', forwarded);
  }
  return directHost;
}

/** Public origin for user-visible URLs — only trusts forwarded headers from trusted proxy hops. */
export function resolvePublicOrigin(req) {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const remote = req.socket?.remoteAddress ?? '';
  const trustForwarded = TRUST_PROXY && isTrustedProxyHop(remote);
  const host = pickPublicHost(req, trustForwarded);

  const proto = trustForwarded
    ? sanitizeProto(req.headers['x-forwarded-proto'])
    : (req.socket?.encrypted ? 'https' : 'http');

  return `${proto}://${host}`;
}