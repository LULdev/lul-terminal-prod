/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistent registration signal registry — one account per IP / device / guest.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = path.join(__dirname, '..', '..', 'data', 'auth', 'registration-registry.json');

export const SIGNAL_TO_BUCKET = {
  ip: 'ips',
  ipSubnet: 'ipSubnets',
  installId: 'installIds',
  storageId: 'storageIds',
  fingerprint: 'fingerprints',
  compositeHash: 'compositeHashes',
  canvasHash: 'canvasHashes',
  webglHash: 'webglHashes',
  guestId: 'guestIds',
  envHash: 'envHashes',
  uaHash: 'uaHashes',
  clientHintsHash: 'clientHintsHashes',
  regLockToken: 'regLockTokens',
  regHintToken: 'regHintTokens',
  canonicalEmail: 'canonicalEmails',
};

export const SIGNAL_BUCKETS = [...new Set(Object.values(SIGNAL_TO_BUCKET))];

const EMPTY_REGISTRY = {
  version: 2,
  updatedAt: null,
  ...Object.fromEntries(SIGNAL_BUCKETS.map((b) => [b, {}])),
};

export async function loadRegistrationRegistry() {
  await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
  let exists = true;
  try {
    await fs.access(REGISTRY_FILE);
  } catch {
    exists = false;
  }
  if (!exists) return structuredClone(EMPTY_REGISTRY);
  try {
    const raw = await fs.readFile(REGISTRY_FILE, 'utf8');
    const data = JSON.parse(raw);
    const out = { ...EMPTY_REGISTRY, ...data, version: 2 };
    for (const bucket of SIGNAL_BUCKETS) {
      out[bucket] = data[bucket] && typeof data[bucket] === 'object' ? data[bucket] : {};
    }
    return out;
  } catch (err) {
    console.error('[auth] CRITICAL: registration-registry.json unreadable', err);
    throw new Error('Registration registry unavailable');
  }
}

let registryWriteChain = Promise.resolve();

export function withRegistryWrite(task) {
  const run = registryWriteChain.then(() => task());
  registryWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function persistRegistrationRegistry(db) {
  await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
  db.updatedAt = new Date().toISOString();
  db.version = 2;
  const tmp = `${REGISTRY_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, REGISTRY_FILE);
}

export async function saveRegistrationRegistry(db) {
  return withRegistryWrite(() => persistRegistrationRegistry(db));
}

function entry(userId, blocked = false) {
  return { userId, blocked: Boolean(blocked), at: Date.now() };
}

export function lookupRegistryEntry(registry, bucket, key) {
  if (!key || !registry[bucket]) return null;
  return registry[bucket][key] ?? null;
}

/** Record all registration signals for a user (optionally blocked for deactivated accounts). */
export async function recordRegistrationSignals(userId, signals, { blocked = false } = {}) {
  return withRegistryWrite(async () => {
    const registry = await loadRegistrationRegistry();
    for (const [signalKey, bucket] of Object.entries(SIGNAL_TO_BUCKET)) {
      const value = signals[signalKey];
      if (!value) continue;
      registry[bucket][value] = entry(userId, blocked);
    }
    await persistRegistrationRegistry(registry);
  });
}

/** Remove all registry entries for a user (registration rollback). */
export async function removeRegistrationSignals(userId, signals) {
  if (!userId || !signals) return;
  return withRegistryWrite(async () => {
    const registry = await loadRegistrationRegistry();
    for (const [signalKey, bucket] of Object.entries(SIGNAL_TO_BUCKET)) {
      const value = signals[signalKey];
      if (!value || !registry[bucket]) continue;
      const hit = registry[bucket][value];
      if (hit?.userId === userId) delete registry[bucket][value];
    }
    await persistRegistrationRegistry(registry);
  });
}

/** Mark every known signal for a user as blocked (deactivate / delete / ban). */
export async function blockRegistrationSignalsForUser(user) {
  if (!user?.id) return;
  const signals = user.registrationSignals;
  if (!signals) return;
  await recordRegistrationSignals(user.id, signals, { blocked: true });
}

/** Clear blocked flag on known signals after unban / reactivation. */
export async function unblockRegistrationSignalsForUser(user) {
  if (!user?.id) return;
  const signals = user.registrationSignals;
  if (!signals) return;
  await recordRegistrationSignals(user.id, signals, { blocked: false });
}

/** Rebuild registry entries from users who already have registrationSignals stored. */
export async function rebuildRegistryFromUsers(users) {
  return withRegistryWrite(async () => {
    const registry = await loadRegistrationRegistry();
    for (const user of users) {
      if (user.role === 'bot' || !user.registrationSignals) continue;
      const blocked = user.active === false || user.chatBanned || user.registrationBlocked;
      for (const [signalKey, bucket] of Object.entries(SIGNAL_TO_BUCKET)) {
        const value = user.registrationSignals[signalKey];
        if (!value) continue;
        registry[bucket][value] = entry(user.id, blocked);
      }
      if (user.email) {
        const { canonicalEmail } = await import('./emailCanonical.mjs');
        registry.canonicalEmails[canonicalEmail(user.email)] = entry(user.id, blocked);
      }
    }
    await persistRegistrationRegistry(registry);
  });
}