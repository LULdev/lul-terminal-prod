/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth } from './auth/authApi.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import {
  canDeletePremiumAccounts,
  canSubmitPremiumAccounts,
  canViewPremiumAccounts,
} from './auth/permissions.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { ensureActivity } from './auth/achievements.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import {
  addAccount,
  approveAccount,
  bulkImportAccounts,
  exportAccountsText,
  getPublicAccountStats,
  getStats,
  incrementAccountView,
  listAccounts,
  rejectAccount,
  removeAccount,
  revealAccountPassword,
  updateAccount,
} from './premiumAccountsService.mjs';
import {
  acceptReport,
  listPendingReports,
  rejectReport,
  reportAccountNotWorking,
} from './premiumAccountsReports.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = 512 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function requireAuth(req) {
  if (!req.auth?.user) throw new Error('Not logged in');
  return req.auth.user;
}

function requirePremiumView(req) {
  requireAuth(req);
  if (!canViewPremiumAccounts(req.auth.user)) throw new Error('VIP permission required');
}

function requirePremiumSubmit(req) {
  if (!req.auth?.user) throw new Error('Not logged in');
  if (!canSubmitPremiumAccounts(req.auth.user)) throw new Error('Verification required — accounts can only be submitted by verified users');
}

function requirePremiumDelete(req) {
  if (!req.auth?.user) throw new Error('Not logged in');
  if (!canDeletePremiumAccounts(req.auth.user)) throw new Error('Admin permission required');
}

export async function handlePremiumAccountsRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    await attachAuth(req);

    const isAdmin = Boolean(req.auth?.user && canAccessAdmin(req.auth.user));

    if (req.method === 'GET' && pathname === '/api/premium-accounts/public-stats') {
      // Public dashboard counters — no login / tab gate
      await checkRateLimit(`premium-public-stats:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      return sendJson(res, 200, await getPublicAccountStats());
    }

    if (req.method === 'GET' && pathname === '/api/premium-accounts/stats') {
      requirePremiumView(req);
      await requireMemberTab(req, 'premiumaccounts');
      await checkRateLimit(`premium-read:${req.auth.user.id}`, { max: 60, windowMs: 60_000 });
      const stats = await getStats({ isAdmin });
      return sendJson(res, 200, stats);
    }

    if (req.method === 'GET' && pathname === '/api/premium-accounts/accounts') {
      requirePremiumView(req);
      await requireMemberTab(req, 'premiumaccounts');
      await checkRateLimit(`premium-read:${req.auth.user.id}`, { max: 60, windowMs: 60_000 });
      const data = await listAccounts({
        category: url.searchParams.get('category') ?? undefined,
        status: url.searchParams.get('status') ?? undefined,
        search: url.searchParams.get('search') ?? undefined,
        isAdmin,
      });
      return sendJson(res, 200, data);
    }

    if (req.method === 'POST' && pathname === '/api/premium-accounts/accounts/bulk') {
      if (!req.auth?.user || !canAccessAdmin(req.auth.user)) {
        throw new Error('Admin permission required');
      }
      await checkRateLimit(`premium-bulk:${req.auth.user.id}`, { max: 5, windowMs: 60_000 });
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      const result = await bulkImportAccounts(body.text ?? body.raw ?? '', body, req.auth.user);
      return sendJson(res, 201, result);
    }

    if (req.method === 'POST' && pathname === '/api/premium-accounts/accounts') {
      requirePremiumSubmit(req);
      await requireMemberTab(req, 'premiumaccounts');
      await checkRateLimit(`premium-submit:${req.auth.user.id}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const result = await addAccount(body, req.auth.user);
      return sendJson(res, 201, result);
    }

    const approveMatch = pathname.match(/^\/api\/premium-accounts\/accounts\/([a-f0-9]+)\/approve$/);
    if (approveMatch && req.method === 'POST') {
      if (!req.auth?.user || !canAccessAdmin(req.auth.user)) {
        throw new Error('Admin permission required');
      }
      await checkRateLimit(`premium-admin-act:${req.auth.user.id}`, { max: 30, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const approveStatus = body.status === 'working_free' ? 'working_free' : 'working';
      const result = await approveAccount(approveMatch[1], approveStatus);
      return sendJson(res, 200, result);
    }

    const rejectUncheckedMatch = pathname.match(/^\/api\/premium-accounts\/accounts\/([a-f0-9]+)\/reject$/);
    if (rejectUncheckedMatch && req.method === 'POST') {
      if (!req.auth?.user || !canAccessAdmin(req.auth.user)) {
        throw new Error('Admin permission required');
      }
      await checkRateLimit(`premium-admin-act:${req.auth.user.id}`, { max: 30, windowMs: 60_000 });
      const result = await rejectAccount(rejectUncheckedMatch[1]);
      return sendJson(res, 200, result);
    }

    const revealMatch = pathname.match(/^\/api\/premium-accounts\/accounts\/([a-f0-9]+)\/reveal$/);
    if (revealMatch && req.method === 'POST') {
      requirePremiumView(req);
      await requireMemberTab(req, 'premiumaccounts');
      await checkRateLimit(`premium-reveal:${req.auth.user.id}`, { max: 40, windowMs: 60_000 });
      const result = await revealAccountPassword(revealMatch[1]);
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && pathname === '/api/premium-accounts/accounts/export') {
      requirePremiumView(req);
      await requireMemberTab(req, 'premiumaccounts');
      await checkRateLimit(`premium-export:${req.auth.user.id}`, { max: 10, windowMs: 60_000 });
      const body = await readJsonBody(req, 16 * 1024);
      const text = await exportAccountsText({
        category: body.category,
        status: body.status,
        search: body.search,
        isAdmin,
        workingOnly: Boolean(body.workingOnly),
      });
      return sendJson(res, 200, { text, lines: text ? text.split('\n').length : 0 });
    }

    const viewMatch = pathname.match(/^\/api\/premium-accounts\/accounts\/([a-f0-9]+)\/view$/);
    if (viewMatch && req.method === 'POST') {
      requirePremiumView(req);
      await requireMemberTab(req, 'premiumaccounts');
      await checkRateLimit(`premium-view:${req.auth.user.id}`, { max: 60, windowMs: 60_000 });
      const accountId = viewMatch[1];
      const viewerId = req.auth.user.id;
      const result = await runCoinTransaction(async () => {
        const db = await loadUsersDb();
        const viewer = db.users.find((u) => u.id === viewerId);
        if (!viewer) throw new Error('User not found');
        const flagKey = `vault_view_${accountId.slice(0, 24)}`;
        const act = ensureActivity(viewer);
        if (act.flags[flagKey]) {
          const { loadAccountsDb } = await import('./premiumAccountsStore.mjs');
          const accountsDb = await loadAccountsDb();
          const account = accountsDb.accounts.find((a) => a.id === accountId);
          if (!account) throw new Error('Account not found');
          return { views: account.views ?? 0, deduped: true };
        }
        act.flags[flagKey] = true;
        viewer.updatedAt = Date.now();
        await saveUsersDb(db);
        try {
          return await incrementAccountView(accountId);
        } catch (e) {
          delete act.flags[flagKey];
          viewer.updatedAt = Date.now();
          await saveUsersDb(db);
          throw e;
        }
      });
      return sendJson(res, 200, result);
    }

    const accountIdMatch = pathname.match(/^\/api\/premium-accounts\/accounts\/([a-f0-9]+)$/);
    if (accountIdMatch && req.method === 'PATCH') {
      if (!req.auth?.user || !canAccessAdmin(req.auth.user)) {
        throw new Error('Admin permission required');
      }
      await checkRateLimit(`premium-admin-act:${req.auth.user.id}`, { max: 40, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const result = await updateAccount(accountIdMatch[1], body, req.auth.user);
      return sendJson(res, 200, result);
    }

    if (accountIdMatch && req.method === 'DELETE') {
      await requireMemberTab(req, 'premiumaccounts');
      requirePremiumDelete(req);
      await checkRateLimit(`premium-admin-act:${req.auth.user.id}`, { max: 20, windowMs: 60_000 });
      const result = await removeAccount(accountIdMatch[1]);
      return sendJson(res, 200, result);
    }

    const reportMatch = pathname.match(/^\/api\/premium-accounts\/accounts\/([a-f0-9]+)\/report$/);
    if (reportMatch && req.method === 'POST') {
      if (!req.auth?.user) {
        throw new Error('You must be logged in with a registered account to report an entry');
      }
      await requireMemberTab(req, 'premiumaccounts');
      await checkRateLimit(`premium-report:${req.auth.user.id}`, { max: 10, windowMs: 60_000 });
      const reporter = req.auth.user;
      const body = await readJsonBody(req);
      const result = await reportAccountNotWorking(reportMatch[1], reporter, body.note);
      return sendJson(res, 201, result);
    }

    if (req.method === 'GET' && pathname === '/api/premium-accounts/reports/pending') {
      if (!req.auth?.user || !canAccessAdmin(req.auth.user)) {
        throw new Error('Admin permission required');
      }
      await checkRateLimit(`premium-admin:${req.auth.user.id}`, { max: 120, windowMs: 60_000 });
      const reports = await listPendingReports();
      return sendJson(res, 200, { reports });
    }

    const acceptMatch = pathname.match(/^\/api\/premium-accounts\/reports\/([a-f0-9]+)\/accept$/);
    if (acceptMatch && req.method === 'POST') {
      if (!req.auth?.user || !canAccessAdmin(req.auth.user)) {
        throw new Error('Admin permission required');
      }
      await checkRateLimit(`premium-admin-act:${req.auth.user.id}`, { max: 30, windowMs: 60_000 });
      const result = await acceptReport(acceptMatch[1], req.auth.user);
      return sendJson(res, 200, result);
    }

    const rejectMatch = pathname.match(/^\/api\/premium-accounts\/reports\/([a-f0-9]+)\/reject$/);
    if (rejectMatch && req.method === 'POST') {
      if (!req.auth?.user || !canAccessAdmin(req.auth.user)) {
        throw new Error('Admin permission required');
      }
      await checkRateLimit(`premium-admin-act:${req.auth.user.id}`, { max: 30, windowMs: 60_000 });
      const result = await rejectReport(rejectMatch[1], req.auth.user);
      return sendJson(res, 200, result);
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    const lower = msg.toLowerCase();
    const status = isRateLimitError(e) ? 429
      : msg === 'Not logged in'
        ? 401
        : msg === 'Permission denied' || lower.includes('vip') || lower.includes('permission')
          || lower.includes('verification') || lower.includes('admin')
          ? 403
          : 400;
    sendJson(res, status, { error: msg });
  }
}

export function createPremiumAccountsMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/premium-accounts')) {
      return handlePremiumAccountsRequest(req, res);
    }
    next();
  });
}