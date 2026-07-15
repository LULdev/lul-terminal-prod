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
  return {
    ...account,
    password: decryptPassword(account.password),
  };
}

function sealAccount(account) {
  if (!account || typeof account !== 'object') return account;
  return {
    ...account,
    password: encryptPassword(account.password),
  };
}

export async function loadAccountsDb() {
  await ensureStore();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    const accounts = Array.isArray(data.accounts) ? data.accounts.map(hydrateAccount) : [];
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

export function withAccountsWrite(task) {
  const run = accountsWriteChain.then(() => task());
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