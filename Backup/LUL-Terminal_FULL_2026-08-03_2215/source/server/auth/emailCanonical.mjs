/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/** Normalize email for duplicate detection (Gmail dots/plus, subdomain aliases). */
export function canonicalEmail(email) {
  const raw = String(email ?? '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return raw;
  let local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  domain = domain.replace(/\.googlemail\.com$/, 'gmail.com');

  if (GMAIL_DOMAINS.has(domain)) {
    local = local.split('+')[0].replace(/\./g, '');
    return `${local}@gmail.com`;
  }

  local = local.split('+')[0];
  return `${local}@${domain}`;
}

export function findUserByCanonicalEmail(users, email) {
  const canon = canonicalEmail(email);
  return users.find((u) => canonicalEmail(u.email) === canon) ?? null;
}