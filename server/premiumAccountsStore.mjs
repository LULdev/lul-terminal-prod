/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { decryptPassword, encryptPassword } from './premiumVaultCrypto.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'premium-accounts');
const DB_FILE = path.join(ROOT, 'accounts.json');

const EMPTY_DB = {
  version: 1,
  updatedAt: null,
  accounts: [],
};

async function atomicWriteJson(file, data) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export async function ensureStore() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await atomicWriteJson(DB_FILE, { ...EMPTY_DB, updatedAt: new Date().toISOString() });
  }
}

function hydrateAccount(account) {
  if (!account || typeof account !== 'object') return account;
  const sealed = account.password;
  try {
    return {
      ...account,
      password: decryptPassword(sealed),
      _vaultSealed: typeof sealed === 'string' && sealed.startsWith('enc:v1:') ? sealed : null,
      _decryptFailed: false,
    };
  } catch (err) {
    console.warn('[premium-vault] decrypt failed for account', account?.id ?? '?', err?.message ?? err);
    // Keep original ciphertext so seal can re-write without wiping the DB
    return {
      ...account,
      password: '',
      _vaultSealed: typeof sealed === 'string' ? sealed : null,
      _decryptFailed: true,
    };
  }
}

function sealAccount(account) {
  if (!account || typeof account !== 'object') return account;
  const { _vaultSealed, _decryptFailed, ...rest } = account;
  // Failed decrypt: preserve original sealed ciphertext (never re-encrypt garbage)
  if (_decryptFailed && _vaultSealed) {
    return { ...rest, password: _vaultSealed };
  }
  // Plaintext from hydrate or new submit — always encrypt (never trust client enc:v1:)
  return {
    ...rest,
    password: encryptPassword(account.password),
  };
}

/**
 * Read vault JSON WITHOUT decrypting passwords.
 * Use for counts / ownership maps under coin lock (P1: avoid full vault decrypt on hot paths).
 */
export async function loadAccountsDbMeta() {
  await ensureStore();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    const accounts = Array.isArray(data.accounts)
      ? data.accounts.map((a) => ({
          id: a?.id,
          createdByUserId: a?.createdByUserId ?? null,
          status: a?.status ?? null,
          service: a?.service ?? null,
          category: a?.category ?? null,
          email: a?.email ?? null,
          views: a?.views ?? 0,
        }))
      : [];
    return {
      ...EMPTY_DB,
      ...data,
      accounts,
    };
  } catch (e) {
    try {
      await fs.access(DB_FILE);
      throw new Error('Corrupt premium accounts database');
    } catch (accessErr) {
      if (accessErr instanceof Error && accessErr.message === 'Corrupt premium accounts database') {
        throw accessErr;
      }
      return structuredClone(EMPTY_DB);
    }
  }
}

export async function loadAccountsDb() {
  await ensureStore();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    // Per-row hydrate: one poison password must not brick the whole vault
    const accounts = Array.isArray(data.accounts)
      ? data.accounts.map((a) => {
          try {
            return hydrateAccount(a);
          } catch (err) {
            console.warn('[premium-vault] hydrate skipped row', a?.id ?? '?', err?.message ?? err);
            return {
              ...a,
              password: '',
              _vaultSealed: typeof a?.password === 'string' ? a.password : null,
              _decryptFailed: true,
            };
          }
        })
      : [];
    return {
      ...EMPTY_DB,
      ...data,
      accounts,
    };
  } catch (e) {
    try {
      await fs.access(DB_FILE);
      throw new Error('Corrupt premium accounts database');
    } catch (accessErr) {
      if (accessErr instanceof Error && accessErr.message === 'Corrupt premium accounts database') {
        throw accessErr;
      }
      return structuredClone(EMPTY_DB);
    }
  }
}

let accountsWriteChain = Promise.resolve();

/** Process-local chain + cross-process lock (multi-worker vault RMW safety). */
export function withAccountsWrite(task) {
  const run = accountsWriteChain.then(async () => {
    const { withCrossProcessLock } = await import('./fileLock.mjs');
    return withCrossProcessLock('premium-accounts', () => task(), { maxWaitMs: 10_000 });
  });
  accountsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function saveAccountsDb(db) {
  await ensureStore();
  const sealed = {
    ...db,
    updatedAt: new Date().toISOString(),
    accounts: Array.isArray(db.accounts) ? db.accounts.map(sealAccount) : [],
  };
  await atomicWriteJson(DB_FILE, sealed);
  db.updatedAt = sealed.updatedAt;
}

export function newAccountId() {
  return crypto.randomBytes(6).toString('hex');
}