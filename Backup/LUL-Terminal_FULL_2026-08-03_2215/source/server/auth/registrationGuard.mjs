/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multi-layer registration barrier — one account per person / device / network.
 */

import crypto from 'crypto';
import { clientIp } from '../rateLimit.mjs';
import { parseCookies, REG_HINT_COOKIE, REG_LOCK_COOKIE } from './cookies.mjs';
import { canonicalEmail } from './emailCanonical.mjs';
import { isDisposableEmail } from './disposableEmail.mjs';
import { consumeRegistrationChallenge } from './registrationChallenge.mjs';
import { isEffectivelyActive } from './permissions.mjs';
import {
  loadRegistrationRegistry,
  lookupRegistryEntry,
  SIGNAL_TO_BUCKET,
} from './registrationRegistry.mjs';

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 32);
}

function ipv4Subnet(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  if (parts.some((p) => Number.isNaN(Number(p)))) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

function extractClientHintsHash(req) {
  const hints = [
    req.headers['sec-ch-ua'],
    req.headers['sec-ch-ua-mobile'],
    req.headers['sec-ch-ua-platform'],
    req.headers['sec-fetch-site'],
    req.headers['sec-fetch-mode'],
    req.headers['accept-encoding'],
  ].map((h) => String(h ?? '').slice(0, 120));
  if (hints.every((h) => !h)) return null;
  return sha256(hints.join('|'));
}

export function extractRegistrationSignals(payload, req) {
  const ctx = payload?.registrationContext ?? {};
  const ip = clientIp(req);
  const ipSubnet = ipv4Subnet(ip);
  const ua = String(req.headers['user-agent'] ?? '').slice(0, 256);
  const acceptLang = String(req.headers['accept-language'] ?? '').slice(0, 128);
  const uaHash = sha256(`${ua}|${acceptLang}`);
  const clientHintsHash = extractClientHintsHash(req);

  const installId = String(ctx.installId ?? '').trim().slice(0, 64);
  const storageId = String(ctx.storageId ?? '').trim().slice(0, 64);
  const fingerprint = String(ctx.fingerprint ?? '').trim().slice(0, 64);
  const canvasHash = String(ctx.canvasHash ?? '').trim().slice(0, 64);
  const webglHash = String(ctx.webglHash ?? '').trim().slice(0, 64);
  const guestId = String(ctx.guestId ?? '').trim().slice(0, 64);
  const envHash = sha256([
    ctx.timezone,
    ctx.screen,
    ctx.platform,
    ctx.languages,
    ctx.deviceType,
    ctx.colorScheme,
    ctx.hardwareConcurrency,
    ctx.deviceMemory,
  ].filter(Boolean).join('|'));

  const compositeHash = sha256([
    installId,
    storageId,
    fingerprint,
    canvasHash,
    webglHash,
    guestId,
    envHash,
  ].filter(Boolean).join('|'));

  const cookies = parseCookies(req);
  const regLockToken = String(cookies[REG_LOCK_COOKIE] ?? '').trim().slice(0, 64);
  const regHintToken = String(cookies[REG_HINT_COOKIE] ?? '').trim().slice(0, 64);

  const emailCanon = payload?.email ? canonicalEmail(payload.email) : null;

  return {
    ip,
    ipSubnet,
    installId,
    storageId,
    fingerprint,
    compositeHash,
    canvasHash,
    webglHash,
    guestId,
    envHash,
    uaHash,
    clientHintsHash,
    regLockToken,
    regHintToken,
    canonicalEmail: emailCanon,
    timezone: String(ctx.timezone ?? '').slice(0, 48),
    screen: String(ctx.screen ?? '').slice(0, 24),
    platform: String(ctx.platform ?? '').slice(0, 48),
    languages: String(ctx.languages ?? '').slice(0, 80),
    deviceType: String(ctx.deviceType ?? '').slice(0, 16),
    firstVisitAt: Number(ctx.firstVisitAt) || 0,
    visitCount: Math.max(0, Number(ctx.visitCount) || 0),
    registeredAt: Date.now(),
  };
}

function signalsOverlap(stored, incoming) {
  if (!stored || !incoming) return false;
  for (const [signalKey] of Object.entries(SIGNAL_TO_BUCKET)) {
    const a = stored[signalKey];
    const b = incoming[signalKey];
    if (a && b && a === b) return true;
  }
  return false;
}

function isUserRegistrationBlocked(user) {
  if (!user || user.role === 'bot') return false;
  return user.active === false || user.chatBanned || Boolean(user.registrationBlocked);
}

const BLOCKED_MSG = 'Registration is not available for this device or network.';
const ONE_ACCOUNT_MSG = 'Only one account is allowed. Please sign in with your existing account.';
const BROWSER_MSG = 'Registration requires a supported browser environment.';
const DISPOSABLE_MSG = 'Disposable email addresses are not allowed.';

export async function assertRegistrationAllowed(payload, signals, usersDb, req) {
  if (String(payload?.website ?? '').trim()) {
    throw new Error(BROWSER_MSG);
  }

  consumeRegistrationChallenge(payload?.registrationChallenge, req);

  if (!signals.installId && !signals.fingerprint && !signals.storageId) {
    throw new Error(BROWSER_MSG);
  }

  if (!signals.canvasHash && !signals.webglHash) {
    throw new Error(BROWSER_MSG);
  }

  if (payload?.email && isDisposableEmail(payload.email)) {
    throw new Error(DISPOSABLE_MSG);
  }

  if (payload?.email) {
    const canon = canonicalEmail(payload.email);
    const canonOwner = usersDb.users.find((u) => canonicalEmail(u.email) === canon);
    if (canonOwner) {
      throw new Error(ONE_ACCOUNT_MSG);
    }
  }

  const registry = await loadRegistrationRegistry();
  const signalChecks = Object.entries(SIGNAL_TO_BUCKET).map(([signalKey, bucket]) => [
    bucket,
    signals[signalKey],
  ]);

  let matchedUserId = null;

  for (const [bucket, key] of signalChecks) {
    if (!key || key === 'unknown') continue;
    const entry = lookupRegistryEntry(registry, bucket, key);
    if (!entry) continue;

    if (entry.blocked) {
      throw new Error(BLOCKED_MSG);
    }

    const owner = usersDb.users.find((u) => u.id === entry.userId);
    if (owner && isUserRegistrationBlocked(owner)) {
      throw new Error(BLOCKED_MSG);
    }

    if (owner && isEffectivelyActive(owner)) {
      if (matchedUserId && matchedUserId !== entry.userId) {
        throw new Error(ONE_ACCOUNT_MSG);
      }
      matchedUserId = entry.userId;
    }
  }

  for (const user of usersDb.users) {
    if (!isUserRegistrationBlocked(user)) continue;
    if (signalsOverlap(user.registrationSignals, signals)) {
      throw new Error(BLOCKED_MSG);
    }
  }

  if (matchedUserId) {
    throw new Error(ONE_ACCOUNT_MSG);
  }
}