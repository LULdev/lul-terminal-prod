/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { loadAccountsDb, saveAccountsDb, withAccountsWrite } from './premiumAccountsStore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_FILE = path.join(__dirname, '..', 'data', 'premium-accounts', 'reports.json');

const EMPTY_REPORTS = { version: 1, updatedAt: null, reports: [] };

let reportsWriteChain = Promise.resolve();

export function withReportsWrite(task) {
  const run = reportsWriteChain.then(() => task());
  reportsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export function newReportId() {
  return crypto.randomBytes(6).toString('hex');
}

export async function loadReportsDb() {
  await fs.mkdir(path.dirname(REPORTS_FILE), { recursive: true });
  if (!(await fileExists(REPORTS_FILE))) return structuredClone(EMPTY_REPORTS);
  try {
    const raw = await fs.readFile(REPORTS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      ...EMPTY_REPORTS,
      ...data,
      reports: Array.isArray(data.reports) ? data.reports : [],
    };
  } catch (err) {
    console.error('[premium] CRITICAL: reports.json unreadable', err);
    throw new Error('Premium reports database unavailable');
  }
}

export async function saveReportsDb(db) {
  await fs.mkdir(path.dirname(REPORTS_FILE), { recursive: true });
  db.updatedAt = new Date().toISOString();
  const tmp = `${REPORTS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, REPORTS_FILE);
}

function findAccount(db, accountId) {
  return db.accounts.find((a) => a.id === accountId) ?? null;
}

export async function getAcceptedNotWorkingForCreator(userId) {
  if (!userId) return [];
  const [accountsDb, reportsDb] = await Promise.all([loadAccountsDb(), loadReportsDb()]);
  const acceptedByAccount = new Map();
  for (const r of reportsDb.reports) {
    if (r.status === 'accepted') acceptedByAccount.set(r.accountId, r);
  }
  if (!acceptedByAccount.size) return [];

  return accountsDb.accounts
    .filter((a) => a.createdByUserId === userId && acceptedByAccount.has(a.id))
    .map((a) => {
      const report = acceptedByAccount.get(a.id);
      return {
        accountId: a.id,
        service: a.service,
        category: a.category,
        website: a.website ?? undefined,
        acceptedAt: report.reviewedAt ?? report.createdAt,
      };
    })
    .sort((a, b) => (b.acceptedAt ?? 0) - (a.acceptedAt ?? 0));
}

export async function reportAccountNotWorking(accountId, reporter, note = '') {
  return withReportsWrite(async () => {
    const [accountsDb, reportsDb] = await Promise.all([loadAccountsDb(), loadReportsDb()]);
    const account = findAccount(accountsDb, accountId);
    if (!account) throw new Error('Account not found');
    if (!account.createdByUserId) throw new Error('This account has no submitter');
    if (account.createdByUserId === reporter.id) throw new Error('Cannot report your own accounts');

    const alreadyAccepted = reportsDb.reports.some(
      (r) => r.accountId === accountId && r.status === 'accepted',
    );
    if (alreadyAccepted) throw new Error('A confirmed report already exists for this account');

    const dupPending = reportsDb.reports.some(
      (r) => r.accountId === accountId
        && r.reportedByUserId === reporter.id
        && r.status === 'pending',
    );
    if (dupPending) throw new Error('You already reported this account — awaiting admin review');

    const dupRejected = reportsDb.reports.some(
      (r) => r.accountId === accountId
        && r.reportedByUserId === reporter.id
        && r.status === 'rejected',
    );
    if (dupRejected) throw new Error('Your report was already rejected');

    const now = Date.now();
    const report = {
      id: newReportId(),
      accountId,
      reportedByUserId: reporter.id,
      reportedByUsername: reporter.username,
      status: 'pending',
      note: String(note ?? '').trim().slice(0, 280),
      createdAt: now,
      reviewedAt: null,
      reviewedByUserId: null,
    };

    reportsDb.reports.push(report);
    await saveReportsDb(reportsDb);
    return { report, account };
  });
}

export async function listPendingReports() {
  const [accountsDb, reportsDb] = await Promise.all([loadAccountsDb(), loadReportsDb()]);
  const pending = reportsDb.reports
    .filter((r) => r.status === 'pending')
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  return pending.map((r) => {
    const account = findAccount(accountsDb, r.accountId);
    return {
      ...r,
      account: account
        ? {
            id: account.id,
            service: account.service,
            website: account.website,
            category: account.category,
            email: account.email,
            status: account.status,
            createdByUserId: account.createdByUserId,
            createdByUsername: account.createdByUsername,
          }
        : null,
    };
  });
}

async function resolveReport(reportId, adminUser, status) {
  return withReportsWrite(async () => withAccountsWrite(async () => {
    const [accountsDb, reportsDb] = await Promise.all([loadAccountsDb(), loadReportsDb()]);
    const report = reportsDb.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Report not found');
    if (report.status !== 'pending') throw new Error('Report was already processed');

    const now = Date.now();
    report.status = status;
    report.reviewedAt = now;
    report.reviewedByUserId = adminUser.id;

    if (status === 'accepted') {
      const account = findAccount(accountsDb, report.accountId);
      if (account) {
        account.status = 'offline';
        account.lastVerifiedAt = null;
        await saveAccountsDb(accountsDb);
      }
    }

    await saveReportsDb(reportsDb);
    const account = findAccount(accountsDb, report.accountId);
    return { report, account };
  }));
}

export async function acceptReport(reportId, adminUser) {
  return resolveReport(reportId, adminUser, 'accepted');
}

export async function rejectReport(reportId, adminUser) {
  return resolveReport(reportId, adminUser, 'rejected');
}