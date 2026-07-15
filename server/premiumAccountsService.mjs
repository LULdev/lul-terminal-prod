/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadAccountsDb, newAccountId, saveAccountsDb, withAccountsWrite } from './premiumAccountsStore.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { postBotAccountAdded, postBotAccountSubmitted } from './chatBot.mjs';
import { parseVaultBulkText } from './premiumAccountsBulkParse.mjs';

const BULK_IMPORT_MAX = 500;

const CATEGORIES = ['streaming', 'vpn', 'software', 'gaming', 'porn', 'other'];
const PLANS = ['Free', 'Premium', 'WorkingButFree'];
const STATUSES = ['working', 'working_free', 'offline', 'expired', 'unchecked'];

/** Strip password from API payloads — use reveal endpoint on demand. */
export function toClientAccount(account) {
  if (!account || typeof account !== 'object') return account;
  const { password, ...rest } = account;
  return {
    ...rest,
    hasPassword: Boolean(String(password ?? '').trim()),
  };
}

export function toClientAccounts(accounts) {
  return (accounts ?? []).map(toClientAccount);
}

export async function revealAccountPassword(id) {
  const db = await loadAccountsDb();
  const row = db.accounts.find((a) => a.id === id);
  if (!row) throw new Error('Account not found');
  return { password: String(row.password ?? '') };
}

export async function exportAccountsText({ category, status, search, isAdmin = false, workingOnly = false } = {}) {
  const db = await loadAccountsDb();
  let list = visibleAccountsForViewer([...db.accounts], isAdmin);
  const q = search?.trim().toLowerCase();

  if (category && CATEGORIES.includes(category)) {
    list = list.filter((a) => a.category === category);
  }
  if (status && STATUSES.includes(status)) {
    if (status === 'unchecked' && !isAdmin) {
      list = [];
    } else {
      list = list.filter((a) => a.status === status);
    }
  }
  if (q) {
    list = list.filter(
      (a) => a.service.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }
  if (workingOnly) {
    list = list.filter((a) => isWorkingStatus(a.status));
  }
  return list.map((a) => `${a.service}\t${a.email}\t${a.password}`).join('\n');
}

function isWorkingStatus(status) {
  return status === 'working' || status === 'working_free';
}

export function visibleAccountsForViewer(accounts, isAdmin = false) {
  if (isAdmin) return accounts;
  return accounts.filter((a) => a.status !== 'unchecked');
}

export function computeStats(accounts, { isAdmin = false } = {}) {
  const visible = visibleAccountsForViewer(accounts, isAdmin);
  const working = visible.filter((a) => isWorkingStatus(a.status)).length;
  const offline = visible.filter((a) => a.status === 'offline' || a.status === 'expired').length;
  const pending = accounts.filter((a) => a.status === 'unchecked').length;
  const activeCategories = new Set(visible.map((a) => a.category)).size;

  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, visible.filter((a) => a.category === c).length]));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, visible.filter((a) => a.status === s).length]));

  return {
    total: visible.length,
    working,
    offline,
    pending: isAdmin ? pending : 0,
    activeCategories,
    byCategory,
    byStatus,
  };
}

export async function countAccountsByCreator(userId) {
  const db = await loadAccountsDb();
  return db.accounts.filter((a) => a.createdByUserId === userId).length;
}

export async function listAccounts({ category, status, search, isAdmin = false } = {}) {
  const db = await loadAccountsDb();
  let list = visibleAccountsForViewer([...db.accounts], isAdmin);
  const q = search?.trim().toLowerCase();

  if (category && CATEGORIES.includes(category)) {
    list = list.filter((a) => a.category === category);
  }
  if (status && STATUSES.includes(status)) {
    if (status === 'unchecked' && !isAdmin) {
      list = [];
    } else {
      list = list.filter((a) => a.status === status);
    }
  }
  if (q) {
    list = list.filter(
      (a) => a.service.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }

  list.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'unchecked') return -1;
      if (b.status === 'unchecked') return 1;
      if (isWorkingStatus(a.status)) return -1;
      if (isWorkingStatus(b.status)) return 1;
    }
    return (b.firstSeenAt ?? 0) - (a.firstSeenAt ?? 0);
  });

  return {
    accounts: toClientAccounts(list),
    stats: computeStats(db.accounts, { isAdmin }),
    updatedAt: db.updatedAt,
  };
}

export async function getStats({ isAdmin = false } = {}) {
  const db = await loadAccountsDb();
  return { ...computeStats(db.accounts, { isAdmin }), updatedAt: db.updatedAt };
}

/** Public header counts — working premium vs working_free in DB. */
export async function getPublicAccountStats() {
  const db = await loadAccountsDb();
  const premium = db.accounts.filter((a) => a.status === 'working').length;
  const free = db.accounts.filter((a) => a.status === 'working_free').length;
  return { premium, free };
}

function serviceFromWebsite(website) {
  try {
    const host = new URL(website.includes('://') ? website : `https://${website}`).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return website;
  }
}

export async function addAccount(payload, creator = null) {
  const website = String(payload.website ?? '').trim();
  const service = String(payload.service ?? '').trim() || (website ? serviceFromWebsite(website) : '');
  const email = String(payload.email ?? '').trim();
  const password = String(payload.password ?? '').trim();
  const category = CATEGORIES.includes(payload.category) ? payload.category : 'other';
  const isAdmin = Boolean(creator && canAccessAdmin(creator));
  const status = isAdmin && STATUSES.includes(payload.status) ? payload.status : 'unchecked';
  const plan = isAdmin && PLANS.includes(payload.plan) ? payload.plan : undefined;
  const vip = isAdmin ? Boolean(payload.vip) : false;

  if (!service || !email || !password) {
    throw new Error('Website, email and password are required');
  }

  const { account, stats } = await withAccountsWrite(async () => {
    const db = await loadAccountsDb();
    const now = Date.now();
    const next = {
      id: newAccountId(),
      service,
      website: website || undefined,
      category,
      email,
      password,
      status,
      plan,
      vip,
      views: 0,
      createdByUserId: creator?.id ?? null,
      createdByUsername: creator?.username ?? null,
      expiresAt: payload.expiresAt ? String(payload.expiresAt).trim() : null,
      notes: payload.notes ? String(payload.notes).trim() : undefined,
      firstSeenAt: now,
      lastVerifiedAt: isWorkingStatus(status) ? now : null,
    };
    db.accounts.push(next);
    await saveAccountsDb(db);
    return { account: toClientAccount(next), stats: computeStats(db.accounts, { isAdmin: true }) };
  });

  if (creator?.username && account.status === 'unchecked') {
    postBotAccountSubmitted({
      username: creator.username,
      service: account.service,
      accountId: account.id,
      category: account.category,
    }).catch(() => {});
  }

  return { account, stats };
}

export async function approveAccount(id, approveStatus = 'working') {
  const account = await withAccountsWrite(async () => {
    const db = await loadAccountsDb();
    const row = db.accounts.find((a) => a.id === id);
    if (!row) throw new Error('Account not found');
    if (row.status !== 'unchecked') throw new Error('Only unchecked accounts can be approved');

    const status = approveStatus === 'working_free' ? 'working_free' : 'working';
    const now = Date.now();
    row.status = status;
    row.lastVerifiedAt = now;
    if (status === 'working_free' && row.plan !== 'Premium') {
      row.plan = 'WorkingButFree';
    }
    await saveAccountsDb(db);
    return row;
  });

  if (account.createdByUsername) {
    postBotAccountAdded({
      username: account.createdByUsername,
      service: account.service,
      accountId: account.id,
      category: account.category,
      plan: account.plan ?? (account.status === 'working_free' ? 'WorkingButFree' : 'Free'),
    }).catch(() => {});
  }

  const stats = await getStats({ isAdmin: true });
  return { account: toClientAccount(account), stats };
}

export async function rejectAccount(id) {
  const creatorId = await withAccountsWrite(async () => {
    const db = await loadAccountsDb();
    const account = db.accounts.find((a) => a.id === id);
    if (!account) throw new Error('Account not found');
    if (account.status !== 'unchecked') throw new Error('Only unchecked accounts can be rejected');
    const cid = account.createdByUserId;
    db.accounts = db.accounts.filter((a) => a.id !== id);
    await saveAccountsDb(db);
    return cid;
  });

  if (creatorId) {
    const { incrementAbuseWarnings } = await import('./chatStats.mjs');
    await incrementAbuseWarnings(creatorId, 1);
  }

  const stats = await getStats({ isAdmin: true });
  return { stats };
}

export async function incrementAccountView(id) {
  return withAccountsWrite(async () => {
    const db = await loadAccountsDb();
    const account = db.accounts.find((a) => a.id === id);
    if (!account) throw new Error('Account not found');
    account.views = (Number(account.views) || 0) + 1;
    await saveAccountsDb(db);
    return { views: account.views };
  });
}

export async function removeAccount(id) {
  await withAccountsWrite(async () => {
    const db = await loadAccountsDb();
    const before = db.accounts.length;
    db.accounts = db.accounts.filter((a) => a.id !== id);
    if (db.accounts.length === before) throw new Error('Account not found');
    await saveAccountsDb(db);
  });
  const stats = await getStats({ isAdmin: true });
  return { stats };
}

function buildAccountFromPayload(payload, creator, { forceAdmin = false } = {}) {
  const website = String(payload.website ?? payload.url ?? '').trim();
  const service = String(payload.service ?? payload.name ?? '').trim()
    || (website ? serviceFromWebsite(website) : '');
  const email = String(payload.email ?? payload.username ?? '').trim();
  const password = String(payload.password ?? '').trim();
  const category = CATEGORIES.includes(payload.category) ? payload.category : 'other';
  const isAdmin = forceAdmin || Boolean(creator && canAccessAdmin(creator));
  const status = isAdmin && STATUSES.includes(payload.status) ? payload.status : 'unchecked';
  const plan = isAdmin && PLANS.includes(payload.plan) ? payload.plan : undefined;
  const vip = isAdmin ? Boolean(payload.vip) : false;

  if (!service || !email || !password) {
    throw new Error('Name, username and password are required');
  }

  return {
    service,
    website: website || undefined,
    category,
    email,
    password,
    status,
    plan,
    vip,
    expiresAt: payload.expiresAt ? String(payload.expiresAt).trim() : null,
    notes: payload.notes ? String(payload.notes).trim() : undefined,
    isAdmin,
  };
}

export async function updateAccount(id, payload, editor) {
  if (!editor || !canAccessAdmin(editor)) {
    throw new Error('Admin permission required');
  }

  const account = await withAccountsWrite(async () => {
    const db = await loadAccountsDb();
    const row = db.accounts.find((a) => a.id === id);
    if (!row) throw new Error('Account not found');

    if (payload.service !== undefined || payload.name !== undefined) {
      const next = String(payload.service ?? payload.name ?? '').trim();
      if (next) row.service = next;
    }
    if (payload.website !== undefined || payload.url !== undefined) {
      const next = String(payload.website ?? payload.url ?? '').trim();
      row.website = next || undefined;
    }
    if (payload.email !== undefined || payload.username !== undefined) {
      const next = String(payload.email ?? payload.username ?? '').trim();
      if (next) row.email = next;
    }
    if (payload.password !== undefined) {
      const next = String(payload.password).trim();
      if (next) row.password = next;
    }
    if (payload.category !== undefined && CATEGORIES.includes(payload.category)) {
      row.category = payload.category;
    }
    if (payload.status !== undefined && STATUSES.includes(payload.status)) {
      row.status = payload.status;
      if (isWorkingStatus(payload.status)) {
        row.lastVerifiedAt = Date.now();
      }
    }
    if (payload.plan !== undefined) {
      row.plan = PLANS.includes(payload.plan) ? payload.plan : undefined;
    }
    if (payload.vip !== undefined) row.vip = Boolean(payload.vip);
    if (payload.expiresAt !== undefined) {
      row.expiresAt = payload.expiresAt ? String(payload.expiresAt).trim() : null;
    }
    if (payload.notes !== undefined) {
      row.notes = payload.notes ? String(payload.notes).trim() : undefined;
    }

    await saveAccountsDb(db);
    return row;
  });

  const stats = await getStats({ isAdmin: true });
  return { account: toClientAccount(account), stats };
}

export async function bulkImportAccounts(rawText, options = {}, creator) {
  if (!creator || !canAccessAdmin(creator)) {
    throw new Error('Admin permission required');
  }

  const parsed = parseVaultBulkText(rawText);
  if (!parsed.length) {
    throw new Error('No entries found — use Name / Username / Password / Url blocks');
  }
  if (parsed.length > BULK_IMPORT_MAX) {
    throw new Error(`Too many entries (max ${BULK_IMPORT_MAX})`);
  }

  const valid = parsed.filter((e) => e.valid);
  const invalid = parsed.filter((e) => !e.valid);
  const defaultCategory = CATEGORIES.includes(options.category) ? options.category : 'other';
  const defaultStatus = STATUSES.includes(options.status) ? options.status : 'working';
  const defaultPlan = PLANS.includes(options.plan) ? options.plan : undefined;
  const defaultVip = Boolean(options.vip);

  const result = await withAccountsWrite(async () => {
    const db = await loadAccountsDb();
    const now = Date.now();
    const imported = [];

    for (const entry of valid) {
      const built = buildAccountFromPayload({
        name: entry.name,
        username: entry.username,
        password: entry.password,
        url: entry.url,
        category: defaultCategory,
        status: defaultStatus,
        plan: defaultPlan,
        vip: defaultVip,
      }, creator, { forceAdmin: true });

      const next = {
        id: newAccountId(),
        service: built.service,
        website: built.website,
        category: built.category,
        email: built.email,
        password: built.password,
        status: built.status,
        plan: built.plan,
        vip: built.vip,
        views: 0,
        createdByUserId: creator.id,
        createdByUsername: creator.username,
        expiresAt: built.expiresAt,
        notes: built.notes,
        firstSeenAt: now,
        lastVerifiedAt: isWorkingStatus(built.status) ? now : null,
      };
      db.accounts.push(next);
      imported.push(next);
    }

    await saveAccountsDb(db);
    return {
      imported,
      stats: computeStats(db.accounts, { isAdmin: true }),
    };
  });

  return {
    imported: result.imported.length,
    failed: invalid.length,
    total: parsed.length,
    errors: invalid.map((e) => ({ index: e.index, name: e.name, errors: e.errors })),
    accounts: toClientAccounts(result.imported),
    stats: result.stats,
  };
}