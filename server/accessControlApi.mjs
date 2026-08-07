/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { statusForError, wrapAsyncHandler } from './asyncMiddleware.mjs';
import { readJsonBody } from './readJsonBody.mjs';
import { attachAuth, requireAuth } from './auth/authApi.mjs';
import { requireRole } from './auth/authApi.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import {
  ALL_MANAGEABLE_TAB_IDS,
  DEFAULT_UI,
  DEFAULT_VISIBILITY,
  LOCKED_MEMBERS_TABS,
  LOCKED_PUBLIC_TABS,
  loadAccessControl,
  publicTabIds,
  saveAccessControl,
} from './accessControlStore.mjs';
import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function handleAccessControlRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/access-control') {
      await checkRateLimit(`access-control:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      const db = await loadAccessControl();
      return sendJson(res, 200, {
        version: db.version,
        updatedAt: db.updatedAt,
        publicTabs: publicTabIds(db.pages),
        ui: db.ui ?? { ...DEFAULT_UI },
      });
    }

    if (pathname.startsWith('/api/access-control/admin')) {
      await attachAuth(req);
      requireRole(req, canAccessAdmin);
      const adminKey = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`access-control-admin:${adminKey}`, { max: 120, windowMs: 60_000 });
    }

    if (req.method === 'GET' && pathname === '/api/access-control/admin') {
      const db = await loadAccessControl();
      return sendJson(res, 200, {
        ...db,
        ui: db.ui ?? { ...DEFAULT_UI },
        publicTabs: publicTabIds(db.pages),
        defaults: DEFAULT_VISIBILITY,
        defaultUi: { ...DEFAULT_UI },
        lockedPublic: [...LOCKED_PUBLIC_TABS],
        lockedMembers: [...LOCKED_MEMBERS_TABS],
        allTabs: ALL_MANAGEABLE_TAB_IDS,
      });
    }

    if (req.method === 'PATCH' && pathname === '/api/access-control/admin') {
      const adminKey = req.auth?.user?.id ?? clientIp(req);
      await checkRateLimit(`access-control-admin-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req);
      if (body.resetDefaults) {
        const db = await saveAccessControl({
          pages: { ...DEFAULT_VISIBILITY },
          ui: { ...DEFAULT_UI },
          resetUiDefaults: true,
        });
        return sendJson(res, 200, {
          ok: true,
          ...db,
          publicTabs: publicTabIds(db.pages),
          defaultUi: { ...DEFAULT_UI },
        });
      }
      const patch = {};
      if (body.pages && typeof body.pages === 'object') patch.pages = body.pages;
      if (body.ui && typeof body.ui === 'object') patch.ui = body.ui;
      if (Object.keys(patch).length === 0) throw new Error('Invalid request');
      const db = await saveAccessControl(patch);
      return sendJson(res, 200, {
        ok: true,
        ...db,
        publicTabs: publicTabIds(db.pages),
        defaultUi: { ...DEFAULT_UI },
      });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    let status = statusForError(e);
    if (status === 500) {
      status = msg === 'Permission denied' ? 403
        : msg === 'Not logged in' ? 401
          : 400;
    }
    if (status === 429 || isRateLimitError(e)) applyRateLimitHeaders(res, e);
    return sendJson(res, status, { error: msg });
  }
}

export function createAccessControlMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/access-control')) {
      return handleAccessControlRequest(req, res);
    }
    next();
  });
}