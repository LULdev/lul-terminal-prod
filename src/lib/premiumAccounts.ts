/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  PremiumAccount,
  PremiumAccountCategory,
  PremiumAccountStatus,
} from '../data/premiumAccounts';
import { sessionFetch } from './sessionFetch';

const API = '/api/premium-accounts';

export type PremiumAccountStats = {
  total: number;
  working: number;
  offline: number;
  pending?: number;
  activeCategories: number;
  byCategory: Record<PremiumAccountCategory, number>;
  byStatus: Record<PremiumAccountStatus, number>;
  updatedAt: string | null;
};

export type { PremiumAccount, PremiumAccountCategory, PremiumAccountStatus };

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await sessionFetch(`${API}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPremiumAccountStats(): Promise<PremiumAccountStats> {
  return authedJson('/stats');
}

export async function fetchPremiumAccounts(opts: {
  category?: PremiumAccountCategory | 'all';
  status?: PremiumAccountStatus | 'all';
  search?: string;
} = {}): Promise<{ accounts: PremiumAccount[]; stats: PremiumAccountStats }> {
  const params = new URLSearchParams();
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
  if (opts.status && opts.status !== 'all') params.set('status', opts.status);
  if (opts.search?.trim()) params.set('search', opts.search.trim());
  const q = params.toString();
  return authedJson(`/accounts${q ? `?${q}` : ''}`);
}

export function exportAccountsTxt(accounts: PremiumAccount[], workingOnly = true) {
  const list = workingOnly
    ? accounts.filter((a) => a.status === 'working' || a.status === 'working_free')
    : accounts;
  return list
    .filter((a) => a.password)
    .map((a) => `${a.service}\t${a.email}\t${a.password}`)
    .join('\n');
}

export async function revealVaultPassword(accountId: string): Promise<string> {
  const data = await authedJson<{ password: string }>(`/accounts/${accountId}/reveal`, { method: 'POST' });
  return data.password;
}

export async function exportVaultAccountsText(opts: {
  category?: PremiumAccountCategory | 'all';
  status?: PremiumAccountStatus | 'all';
  search?: string;
  workingOnly?: boolean;
} = {}): Promise<string> {
  const body: Record<string, unknown> = {};
  if (opts.category && opts.category !== 'all') body.category = opts.category;
  if (opts.status && opts.status !== 'all') body.status = opts.status;
  if (opts.search?.trim()) body.search = opts.search.trim();
  if (opts.workingOnly) body.workingOnly = true;
  const data = await authedJson<{ text: string }>('/accounts/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.text;
}

export type CreatePremiumAccountInput = {
  siteName: string;
  siteUrl: string;
  email: string;
  password: string;
  category: PremiumAccountCategory;
  plan: 'Free' | 'Premium' | 'WorkingButFree';
  vip?: boolean;
};

export type AdminVaultAccountInput = {
  service: string;
  website?: string;
  email: string;
  password: string;
  category: PremiumAccountCategory;
  status: PremiumAccountStatus;
  plan?: 'Free' | 'Premium' | 'WorkingButFree';
  vip?: boolean;
  notes?: string;
  expiresAt?: string;
};

export type BulkImportVaultOptions = {
  text: string;
  category?: PremiumAccountCategory;
  status?: PremiumAccountStatus;
  plan?: 'Free' | 'Premium' | 'WorkingButFree';
  vip?: boolean;
};

export type BulkImportVaultResult = {
  imported: number;
  failed: number;
  total: number;
  errors: Array<{ index: number; name: string; errors: string[] }>;
  accounts: PremiumAccount[];
  stats: PremiumAccountStats;
};

export async function createPremiumAccount(input: CreatePremiumAccountInput): Promise<PremiumAccount> {
  const data = await authedJson<{ account: PremiumAccount }>('/accounts', {
    method: 'POST',
    body: JSON.stringify({
      service: input.siteName.trim(),
      website: input.siteUrl.trim(),
      email: input.email,
      password: input.password,
      category: input.category,
      plan: input.plan,
      vip: input.vip ?? false,
      status: 'unchecked',
    }),
  });
  return data.account;
}

export async function createAdminVaultAccount(input: AdminVaultAccountInput): Promise<PremiumAccount> {
  const data = await authedJson<{ account: PremiumAccount }>('/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.account;
}

export async function updateVaultAccount(
  id: string,
  patch: Partial<AdminVaultAccountInput>,
): Promise<PremiumAccount> {
  const data = await authedJson<{ account: PremiumAccount }>(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.account;
}

export async function deleteVaultAccount(id: string): Promise<void> {
  await authedJson(`/accounts/${id}`, { method: 'DELETE' });
}

export async function bulkImportVaultAccounts(opts: BulkImportVaultOptions): Promise<BulkImportVaultResult> {
  return authedJson('/accounts/bulk', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

const ACCOUNT_VIEW_PREFIX = 'lul_acct_view_';
const accountViewInflight = new Map<string, Promise<number>>();

export type AccountReport = {
  id: string;
  accountId: string;
  reportedByUserId: string;
  reportedByUsername: string;
  status: 'pending' | 'accepted' | 'rejected';
  note: string;
  createdAt: number;
  reviewedAt: number | null;
  reviewedByUserId: string | null;
  account: {
    id: string;
    service: string;
    website?: string;
    category: PremiumAccountCategory;
    email: string;
    status: PremiumAccountStatus;
    createdByUserId: string | null;
    createdByUsername: string | null;
  } | null;
};

export class RegistrationRequiredError extends Error {
  constructor() {
    super('REGISTRATION_REQUIRED');
    this.name = 'RegistrationRequiredError';
  }
}

export function isRegistrationRequiredError(err: unknown): boolean {
  return err instanceof RegistrationRequiredError
    || (err instanceof Error && (
      err.message === 'REGISTRATION_REQUIRED'
      || err.message === 'Not logged in'
      || /logged in|registered account/i.test(err.message)
    ));
}

export async function reportAccountNotWorking(accountId: string, note?: string): Promise<void> {
  try {
    await authedJson(`/accounts/${accountId}/report`, {
      method: 'POST',
      body: JSON.stringify({ note: note ?? '' }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'SessionExpiredError') {
      throw new RegistrationRequiredError();
    }
    throw e;
  }
}

export async function fetchPendingAccountReports(): Promise<AccountReport[]> {
  const data = await authedJson<{ reports: AccountReport[] }>('/reports/pending');
  return data.reports;
}

export async function acceptAccountReport(reportId: string): Promise<void> {
  await authedJson(`/reports/${reportId}/accept`, { method: 'POST' });
}

export async function approvePremiumAccount(
  accountId: string,
  status: 'working' | 'working_free' = 'working',
): Promise<PremiumAccount> {
  const data = await authedJson<{ account: PremiumAccount }>(`/accounts/${accountId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  return data.account;
}

export async function rejectPremiumAccount(accountId: string): Promise<void> {
  await authedJson(`/accounts/${accountId}/reject`, { method: 'POST' });
}

export async function fetchPendingPremiumAccounts(): Promise<PremiumAccount[]> {
  const data = await fetchPremiumAccounts({ status: 'unchecked' });
  return data.accounts.filter((a) => a.status === 'unchecked');
}

export async function rejectAccountReport(reportId: string): Promise<void> {
  await authedJson(`/reports/${reportId}/reject`, { method: 'POST' });
}

export async function recordAccountView(id: string, currentViews = 0): Promise<number> {
  const pending = accountViewInflight.get(id);
  if (pending) return pending;

  const canUseSession = typeof sessionStorage !== 'undefined';
  const run = (async () => {
    const sessionKey = `${ACCOUNT_VIEW_PREFIX}${id}`;
    if (!canUseSession || !sessionStorage.getItem(sessionKey)) {
      try {
        const res = await fetch(`${API}/accounts/${id}/view`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          if (canUseSession) sessionStorage.setItem(sessionKey, '1');
          const data = await res.json() as { views: number };
          return data.views;
        }
      } catch { /* fall through */ }
    }
    return currentViews;
  })();

  accountViewInflight.set(id, run);
  try {
    return await run;
  } finally {
    if (accountViewInflight.get(id) === run) accountViewInflight.delete(id);
  }
}