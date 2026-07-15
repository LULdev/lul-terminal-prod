/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * First-run / deployment self-configuration.
 * Runs automatically on process start — no manual seed scripts required.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initAuth } from './auth/authService.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SECRETS_DIR = path.join(DATA_DIR, 'secrets');
const VAULT_KEY_FILE = path.join(SECRETS_DIR, 'premium-vault.key');

/** Ensure required runtime directories exist. */
function ensureDataLayout() {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, 'auth'),
    path.join(DATA_DIR, 'avatars'),
    path.join(DATA_DIR, 'chat'),
    path.join(DATA_DIR, 'paste', 'content'),
    path.join(DATA_DIR, 'paste', 'meta'),
    path.join(DATA_DIR, 'image-host', 'files'),
    path.join(DATA_DIR, 'image-host', 'meta'),
    path.join(DATA_DIR, 'analytics'),
    path.join(DATA_DIR, 'feeds'),
    path.join(DATA_DIR, 'games'),
    path.join(DATA_DIR, 'premium-accounts'),
    path.join(DATA_DIR, 'proxy-database'),
    path.join(DATA_DIR, 'proxy-scraper'),
    path.join(DATA_DIR, 'persona-database'),
    path.join(DATA_DIR, 'colon-scraper-database'),
    SECRETS_DIR,
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Ensure PREMIUM_VAULT_KEY is available.
 * Priority: env → existing key file → generate + persist (dev/first deploy).
 */
function ensurePremiumVaultKey() {
  const fromEnv = String(process.env.PREMIUM_VAULT_KEY ?? '').trim();
  if (fromEnv && fromEnv !== 'change-me-long-random-secret') {
    return { source: 'env' };
  }

  if (fs.existsSync(VAULT_KEY_FILE)) {
    const stored = fs.readFileSync(VAULT_KEY_FILE, 'utf8').trim();
    if (stored) {
      process.env.PREMIUM_VAULT_KEY = stored;
      return { source: 'file', path: VAULT_KEY_FILE };
    }
  }

  const generated = crypto.randomBytes(32).toString('base64');
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  fs.writeFileSync(VAULT_KEY_FILE, `${generated}\n`, { encoding: 'utf8', mode: 0o600 });
  process.env.PREMIUM_VAULT_KEY = generated;

  if (process.env.NODE_ENV === 'production') {
    console.warn('[bootstrap] Generated PREMIUM_VAULT_KEY and saved to data/secrets/premium-vault.key');
    console.warn('[bootstrap] Prefer setting PREMIUM_VAULT_KEY in .env for production. Back up this file.');
  } else {
    console.warn('[bootstrap] Generated PREMIUM_VAULT_KEY for local use → data/secrets/premium-vault.key');
  }
  return { source: 'generated', path: VAULT_KEY_FILE };
}

/**
 * Create empty JSON store files when missing so status probes and APIs
 * do not fail on a fresh deploy / empty data volume.
 */
async function ensureDefaultStoreFiles() {
  const { ensurePersonaDb } = await import('./personaDatabaseStore.mjs');
  const { ensureColonDb } = await import('./colonScraperDatabaseStore.mjs');
  await ensurePersonaDb();
  await ensureColonDb();
}

/**
 * Full application bootstrap. Idempotent and safe to call on every start.
 */
export async function bootstrapApplication() {
  console.log('[bootstrap] Starting self-configuration…');
  ensureDataLayout();
  const vault = ensurePremiumVaultKey();
  console.log(`[bootstrap] Premium vault key: ${vault.source}`);

  await ensureDefaultStoreFiles();
  console.log('[bootstrap] Default data stores ready.');

  await initAuth();
  console.log('[bootstrap] Auth subsystem ready.');
  console.log('[bootstrap] Self-configuration complete.');
}
