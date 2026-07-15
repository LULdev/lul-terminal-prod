/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { attachAuth, requireRole } from './auth/authApi.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import {
  adminBroadcastBot,
  adminBulkDeleteMessages,
  adminClearLobby,
  adminDeleteMessage,
  adminListAllMessages,
  adminModerateShoutboxUser,
} from './chatService.mjs';
import { adminDeleteImage, adminListImages } from './imageHostStore.mjs';
import { deleteColonEntry } from './colonScraperDatabaseService.mjs';
import { getAllPostViews } from './postViewsStore.mjs';
import { getAllPageViews } from './pageViewsStore.mjs';
import { getPersonaStats, listPersonaEntries } from './personaDatabaseStore.mjs';
import { adminListVisitorProfiles } from './visitorTracking.mjs';
import { loadUsersDb } from './auth/authStore.mjs';
import { purgeOldEvents, exportAnalyticsBundle } from './analyticsService.mjs';
import {
  buildAdminAchievements,
  buildAdminAvatars,
  buildAdminChangelogConsole,
  buildAdminCheckerDashboard,
  buildAdminEventsOps,
  buildAdminHeatmap,
  buildAdminOnlineRadar,
  buildAdminReportsDesk,
  buildAdminScraperPool,
  buildAdminStorageMap,
} from './adminModulesService.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = 64 * 1024) {
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

async function requireAdmin(req) {
  await attachAuth(req);
  return requireRole(req, canAccessAdmin);
}

export async function handleAdminRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    await requireAdmin(req);
    const adminKey = req.auth?.user?.id ?? clientIp(req);
    await checkRateLimit(`admin-read:${adminKey}`, { max: 120, windowMs: 60_000 });

    if (pathname.startsWith('/api/admin/shoutbox/')) {
      await checkRateLimit(`admin-shoutbox:${adminKey}`, { max: 60, windowMs: 60_000 });
      if (
        req.method === 'POST'
        && (pathname === '/api/admin/shoutbox/broadcast'
          || pathname === '/api/admin/shoutbox/clear'
          || pathname === '/api/admin/shoutbox/bulk-delete'
          || pathname === '/api/admin/shoutbox/mod')
      ) {
        await checkRateLimit(`admin-shoutbox-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      }
    }

    if (req.method === 'GET' && pathname === '/api/admin/shoutbox/messages') {
      const data = await adminListAllMessages({
        limit: Number(url.searchParams.get('limit')) || 200,
        q: url.searchParams.get('q') ?? undefined,
        kind: url.searchParams.get('kind') ?? undefined,
        username: url.searchParams.get('username') ?? undefined,
      });
      return sendJson(res, 200, data);
    }

    if (req.method === 'POST' && pathname === '/api/admin/shoutbox/broadcast') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await adminBroadcastBot(body.text));
    }

    if (req.method === 'POST' && pathname === '/api/admin/shoutbox/clear') {
      const admin = req.auth?.user;
      return sendJson(res, 200, await adminClearLobby(admin?.username ?? 'admin'));
    }

    if (req.method === 'POST' && pathname === '/api/admin/shoutbox/bulk-delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await adminBulkDeleteMessages(body.ids));
    }

    if (req.method === 'POST' && pathname === '/api/admin/shoutbox/mod') {
      const body = await readJsonBody(req);
      const admin = req.auth?.user;
      return sendJson(res, 200, await adminModerateShoutboxUser(admin, {
        action: body.action,
        username: body.username,
        minutes: body.minutes,
      }));
    }

    const shoutboxDelete = pathname.match(/^\/api\/admin\/shoutbox\/messages\/([a-f0-9]{12})$/);
    if (req.method === 'DELETE' && shoutboxDelete) {
      await checkRateLimit(`admin-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      return sendJson(res, 200, await adminDeleteMessage(shoutboxDelete[1]));
    }

    if (req.method === 'GET' && pathname === '/api/admin/images') {
      const sort = url.searchParams.get('sort') ?? 'newest';
      const data = await adminListImages({
        limit: Number(url.searchParams.get('limit')) || 120,
        q: url.searchParams.get('q') ?? undefined,
        sort: ['newest', 'oldest', 'views', 'size'].includes(sort) ? sort : 'newest',
      });
      return sendJson(res, 200, data);
    }

    const imageDelete = pathname.match(/^\/api\/admin\/images\/([a-f0-9]{16})$/);
    if (req.method === 'DELETE' && imageDelete) {
      await checkRateLimit(`admin-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      return sendJson(res, 200, await adminDeleteImage(imageDelete[1]));
    }

    if (req.method === 'GET' && pathname === '/api/admin/content-analytics') {
      const [postViews, pageViews] = await Promise.all([getAllPostViews(), getAllPageViews()]);
      const changelogEntries = Object.entries(postViews.changelog ?? {})
        .map(([id, views]) => ({ id, views: Number(views) || 0 }))
        .sort((a, b) => b.views - a.views);
      const newsEntries = Object.entries(postViews.news ?? {})
        .map(([id, views]) => ({ id, views: Number(views) || 0 }))
        .sort((a, b) => b.views - a.views);
      const pageEntries = Object.entries(pageViews.pages ?? {})
        .map(([pageId, views]) => ({ pageId, views: Number(views) || 0 }))
        .sort((a, b) => b.views - a.views);

      return sendJson(res, 200, {
        generatedAt: Date.now(),
        postViews: {
          changelog: changelogEntries,
          news: newsEntries,
          changelogTotal: changelogEntries.reduce((s, e) => s + e.views, 0),
          newsTotal: newsEntries.reduce((s, e) => s + e.views, 0),
        },
        pageViews: {
          pages: pageEntries,
          total: pageEntries.reduce((s, e) => s + e.views, 0),
        },
      });
    }

    const colonDelete = pathname.match(/^\/api\/admin\/colon-db\/([a-f0-9]{16})$/);
    if (req.method === 'DELETE' && colonDelete) {
      await checkRateLimit(`admin-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      return sendJson(res, 200, await deleteColonEntry(colonDelete[1]));
    }

    if (req.method === 'GET' && pathname === '/api/admin/persona/stats') {
      return sendJson(res, 200, await getPersonaStats());
    }

    if (req.method === 'GET' && pathname === '/api/admin/persona/entries') {
      const result = await listPersonaEntries({
        limit: Number(url.searchParams.get('limit')) || 120,
        country: url.searchParams.get('country') ?? undefined,
        q: url.searchParams.get('q') ?? undefined,
      });
      return sendJson(res, 200, result);
    }

    if (req.method === 'GET' && pathname === '/api/admin/visitors') {
      return sendJson(res, 200, await adminListVisitorProfiles({
        limit: Number(url.searchParams.get('limit')) || 80,
        q: url.searchParams.get('q') ?? undefined,
      }));
    }

    if (req.method === 'GET' && pathname === '/api/admin/events') {
      return sendJson(res, 200, await buildAdminEventsOps());
    }

    if (req.method === 'POST' && pathname === '/api/admin/events/purge') {
      await checkRateLimit(`admin-act:${adminKey}`, { max: 5, windowMs: 60_000 });
      const body = await readJsonBody(req);
      return sendJson(res, 200, await purgeOldEvents(Number(body.keep) || 2000));
    }

    if (req.method === 'GET' && pathname === '/api/admin/events/export') {
      return sendJson(res, 200, await exportAnalyticsBundle());
    }

    if (req.method === 'GET' && pathname === '/api/admin/online') {
      return sendJson(res, 200, await buildAdminOnlineRadar());
    }

    if (req.method === 'GET' && pathname === '/api/admin/heatmap') {
      return sendJson(res, 200, await buildAdminHeatmap());
    }

    if (req.method === 'GET' && pathname === '/api/admin/achievements') {
      return sendJson(res, 200, await buildAdminAchievements());
    }

    if (req.method === 'GET' && pathname === '/api/admin/scraper-pool') {
      return sendJson(res, 200, await buildAdminScraperPool());
    }

    if (req.method === 'GET' && pathname === '/api/admin/checker') {
      return sendJson(res, 200, await buildAdminCheckerDashboard());
    }

    if (req.method === 'GET' && pathname === '/api/admin/reports') {
      return sendJson(res, 200, await buildAdminReportsDesk());
    }

    if (req.method === 'GET' && pathname === '/api/admin/changelog') {
      return sendJson(res, 200, await buildAdminChangelogConsole());
    }

    if (req.method === 'GET' && pathname === '/api/admin/avatars') {
      return sendJson(res, 200, await buildAdminAvatars());
    }

    if (req.method === 'GET' && pathname === '/api/admin/storage') {
      return sendJson(res, 200, await buildAdminStorageMap());
    }

    if (req.method === 'GET' && pathname === '/api/admin/referrals') {
      const db = await loadUsersDb();
      const users = db.users.filter((u) => u.role !== 'bot' && u.active !== false);
      const userById = new Map(users.map((u) => [u.id, u]));
      const referrerUsername = (id) => {
        if (!id) return null;
        const hit = userById.get(id);
        return hit?.username ?? null;
      };

      const withReferrals = users
        .filter((u) => (Number(u.referralsCount) || 0) > 0)
        .sort((a, b) => (Number(b.referralsCount) || 0) - (Number(a.referralsCount) || 0))
        .map((u) => ({
          userId: u.id,
          username: u.username,
          displayName: u.displayName,
          referralCode: u.referralCode ?? '',
          referralsCount: Number(u.referralsCount) || 0,
          referredBy: referrerUsername(u.referredBy),
          createdAt: u.createdAt ?? null,
          verified: Boolean(u.verified),
          role: u.role,
        }));

      const referredUsers = users.filter((u) => u.referredBy);
      const totalReferrals = users.reduce((s, u) => s + (Number(u.referralsCount) || 0), 0);

      return sendJson(res, 200, {
        generatedAt: Date.now(),
        stats: {
          totalReferrals,
          usersWithCode: users.filter((u) => u.referralCode).length,
          topReferrers: withReferrals.length,
          membersReferred: referredUsers.length,
        },
        leaders: withReferrals.slice(0, Number(url.searchParams.get('limit')) || 50),
        recentReferred: [...referredUsers]
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(0, 20)
          .map((u) => ({
            userId: u.id,
            username: u.username,
            displayName: u.displayName,
            referredBy: referrerUsername(u.referredBy),
            createdAt: u.createdAt,
          })),
      });
    }

    if (pathname === '/api/admin/chat/emotes') {
      const {
        createEmote,
        deleteEmote,
        listAdminEmotes,
        replaceEmoteImage,
        updateEmote,
      } = await import('./chatEmotesStore.mjs');

      if (req.method === 'GET') {
        return sendJson(res, 200, await listAdminEmotes());
      }
      if (req.method === 'POST') {
        await checkRateLimit(`admin-emotes-act:${adminKey}`, { max: 20, windowMs: 60_000 });
        const body = await readJsonBody(req, 4 * 1024 * 1024);
        const buffer = Buffer.from(String(body.data ?? ''), 'base64');
        const emote = await createEmote({
          code: body.code,
          label: body.label,
          mime: body.mime,
          buffer,
          enabled: body.enabled,
        });
        return sendJson(res, 201, { emote });
      }
    }

    const emoteMatch = pathname.match(/^\/api\/admin\/chat\/emotes\/([a-f0-9]{12})$/);
    if (emoteMatch) {
      const { deleteEmote, updateEmote } = await import('./chatEmotesStore.mjs');
      if (req.method === 'PATCH') {
        await checkRateLimit(`admin-emotes-act:${adminKey}`, { max: 30, windowMs: 60_000 });
        const body = await readJsonBody(req);
        const emote = await updateEmote(emoteMatch[1], body);
        return sendJson(res, 200, { emote });
      }
      if (req.method === 'DELETE') {
        await checkRateLimit(`admin-emotes-act:${adminKey}`, { max: 20, windowMs: 60_000 });
        return sendJson(res, 200, await deleteEmote(emoteMatch[1]));
      }
    }

    const emoteUploadMatch = pathname.match(/^\/api\/admin\/chat\/emotes\/([a-f0-9]{12})\/upload$/);
    if (emoteUploadMatch && req.method === 'POST') {
      await checkRateLimit(`admin-emotes-act:${adminKey}`, { max: 20, windowMs: 60_000 });
      const { replaceEmoteImage } = await import('./chatEmotesStore.mjs');
      const body = await readJsonBody(req, 4 * 1024 * 1024);
      const buffer = Buffer.from(String(body.data ?? ''), 'base64');
      const emote = await replaceEmoteImage(emoteUploadMatch[1], { mime: body.mime, buffer });
      return sendJson(res, 200, { emote });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    const status = isRateLimitError(e) ? 429
      : e instanceof SyntaxError ? 400
        : msg === 'Not logged in' ? 401
        : msg.includes('Forbidden') || msg.includes('Admin') || msg === 'Permission denied'
          ? 403
          : msg.includes('not found') || msg.includes('required') || msg.includes('Invalid')
            || msg.includes('exists') || msg.includes('allowed') || msg.includes('max')
            ? 400
            : 500;
    return sendJson(res, status, { error: msg });
  }
}

export function createAdminMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/admin/')) {
      return handleAdminRequest(req, res);
    }
    next();
  });
}