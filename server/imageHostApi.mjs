/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import { attachAuth, requireAuth } from './auth/authApi.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { resolvePublicOrigin } from './resolvePublicOrigin.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { claimGuestView } from './viewDedup.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { ensureActivity } from './auth/achievements.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { incrementUserImageUpload } from './auth/authService.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { imageViewLink, postBotImageHosted } from './chatBot.mjs';
import {
  computeUserGalleryStats,
  deleteImageRecord,
  getFilePath,
  getMeta,
  listImagesByUser,
  readStats,
  recordView,
  saveImage,
  updateImageRecord,
} from './imageHostStore.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function decodeImageUploadData(data) {
  const b64 = String(data ?? '');
  const estBytes = Math.floor((b64.length * 3) / 4);
  if (estBytes > MAX_IMAGE_BYTES) throw new Error('File too large (max 10 MB)');
  return Buffer.from(b64, 'base64');
}

async function readJsonBody(req, limit = 14 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

export async function handleImageHostRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'POST' && pathname === '/api/images/meme-upload') {
      await requireMemberTab(req, 'memegen');
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`image-meme-upload:${user.id}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const buffer = decodeImageUploadData(body.data);
      const meta = await saveImage({
        name: body.name,
        mime: body.mime,
        size: body.size ?? buffer.length,
        width: body.width,
        height: body.height,
        buffer,
        userId: user.id,
        source: 'meme',
      });
      return sendJson(res, 201, toClientMeta(meta, req));
    }

    await requireMemberTab(req, 'imagehost');

    if (req.method === 'GET' && pathname === '/api/images/stats') {
      // Public totals bar — polled every ~8s; allow headroom for multi-tab
      await checkRateLimit(`image-stats:${clientIp(req)}`, { max: 120, windowMs: 60_000 });
      return sendJson(res, 200, await readStats());
    }

    if (req.method === 'GET' && pathname === '/api/images/my/stats') {
      await attachAuth(req);
      const user = requireAuth(req);
      // Separate bucket from list so a list+stats pair does not double-count the same key
      await checkRateLimit(`image-my-stats:${user.id}`, { max: 90, windowMs: 60_000 });
      return sendJson(res, 200, await computeUserGalleryStats(user.id));
    }

    if (req.method === 'GET' && pathname === '/api/images/my') {
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`image-my-list:${user.id}`, { max: 90, windowMs: 60_000 });
      const sort = url.searchParams.get('sort') ?? 'newest';
      const images = await listImagesByUser(user.id);
      const sorted = sortGallery(images, sort);
      return sendJson(res, 200, {
        images: sorted.map((m) => toClientMeta(m, req)),
        total: sorted.length,
      });
    }

    if (req.method === 'POST' && pathname === '/api/images/upload') {
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`image-upload:${user.id}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const buffer = decodeImageUploadData(body.data);
      const userId = user.id;
      const meta = await saveImage({
        name: body.name,
        mime: body.mime,
        size: body.size ?? buffer.length,
        width: body.width,
        height: body.height,
        buffer,
        userId,
      });
      const isMemeExport = false;
      if (userId && !isMemeExport) await incrementUserImageUpload(userId);
      const clientMeta = toClientMeta(meta, req);
      const skipBot = isMemeExport || body.skipBotNotify === true;
      if (userId && !skipBot && req.auth?.user?.username) {
        postBotImageHosted({
          username: req.auth.user.username,
          imageName: meta.name,
          imageHref: imageViewLink(meta.id),
        }).catch(() => {});
      }
      return sendJson(res, 201, clientMeta);
    }

    const metaMatch = pathname.match(/^\/api\/images\/([a-f0-9]{16})$/);
    if (metaMatch && req.method === 'GET') {
      await checkRateLimit(`image-meta:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      const meta = await getMeta(metaMatch[1]);
      if (!meta) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, toClientMeta(meta, req));
    }

    const viewMatch = pathname.match(/^\/api\/images\/([a-f0-9]{16})\/view$/);
    if (viewMatch && req.method === 'POST') {
      await checkRateLimit(`image-view:${clientIp(req)}:${viewMatch[1]}`, { max: 40, windowMs: 60_000 });
      await attachAuth(req);
      const imageId = viewMatch[1];
      const viewerId = req.auth?.user?.id ?? null;
      const ownerMeta = await getMeta(imageId);
      if (!ownerMeta) return sendJson(res, 404, { error: 'Not found' });
      if (viewerId && String(ownerMeta.userId) === String(viewerId)) {
        return sendJson(res, 200, { views: ownerMeta.views ?? 0, deduped: true, selfView: true });
      }
      const result = await runCoinTransaction(async () => {
        if (viewerId) {
          const db = await loadUsersDb();
          const viewer = db.users.find((u) => u.id === viewerId);
          if (viewer) {
            const flagKey = `image_meta_view_${imageId}`;
            const act = ensureActivity(viewer);
            if (act.flags[flagKey]) {
              const meta = await getMeta(imageId);
              if (!meta) return null;
              return { views: meta.views ?? 0, deduped: true };
            }
          }
          if (!(await claimGuestView('image', clientIp(req), imageId))) {
            const meta = await getMeta(imageId);
            if (!meta) return null;
            if (viewerId) {
              const db = await loadUsersDb();
              const viewer = db.users.find((u) => u.id === viewerId);
              if (viewer) {
                const flagKey = `image_meta_view_${imageId}`;
                const act = ensureActivity(viewer);
                if (!act.flags[flagKey]) {
                  act.flags[flagKey] = true;
                  viewer.updatedAt = Date.now();
                  await saveUsersDb(db);
                }
              }
            }
            return { views: meta.views ?? 0, deduped: true };
          }
        } else if (!(await claimGuestView('image', clientIp(req), imageId))) {
          const meta = await getMeta(imageId);
          if (!meta) return null;
          return { views: meta.views ?? 0, deduped: true };
        }
        let reservedDb = null;
        let reservedViewer = null;
        let reservedFlagKey = null;
        if (viewerId) {
          reservedDb = await loadUsersDb();
          reservedViewer = reservedDb.users.find((u) => u.id === viewerId);
          if (reservedViewer) {
            reservedFlagKey = `image_meta_view_${imageId}`;
            const act = ensureActivity(reservedViewer);
            act.flags[reservedFlagKey] = true;
            reservedViewer.updatedAt = Date.now();
            await saveUsersDb(reservedDb);
          }
        }
        let recorded;
        try {
          recorded = await recordView(imageId);
        } catch (e) {
          if (reservedViewer && reservedFlagKey && reservedDb) {
            const act = ensureActivity(reservedViewer);
            delete act.flags[reservedFlagKey];
            reservedViewer.updatedAt = Date.now();
            await saveUsersDb(reservedDb);
          }
          throw e;
        }
        if (!recorded && reservedViewer && reservedFlagKey && reservedDb) {
          const act = ensureActivity(reservedViewer);
          delete act.flags[reservedFlagKey];
          reservedViewer.updatedAt = Date.now();
          await saveUsersDb(reservedDb);
        }
        return recorded;
      });
      if (!result) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, result);
    }

    const patchMatch = pathname.match(/^\/api\/images\/([a-f0-9]{16})$/);
    if (patchMatch && req.method === 'PATCH') {
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`image-update:${user.id}`, { max: 30, windowMs: 60_000 });
      const body = await readJsonBody(req, 64 * 1024);
      const meta = await updateImageRecord(patchMatch[1], user.id, body);
      return sendJson(res, 200, toClientMeta(meta, req));
    }

    const deleteMatch = pathname.match(/^\/api\/images\/([a-f0-9]{16})$/);
    if (deleteMatch && req.method === 'DELETE') {
      await attachAuth(req);
      const user = requireAuth(req);
      await checkRateLimit(`image-delete:${user.id}`, { max: 20, windowMs: 60_000 });
      const result = await deleteImageRecord(deleteMatch[1], user.id);
      return sendJson(res, 200, result);
    }

    const hostingMatch = pathname.match(/^\/hosting\/([a-f0-9]{16})$/);
    if (hostingMatch && req.method === 'GET') {
      await checkRateLimit(`hosting-file:${clientIp(req)}`, { max: 120, windowMs: 60_000 });
      const hit = await getFilePath(hostingMatch[1]);
      if (!hit) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const buf = await fs.readFile(hit.filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', hit.meta.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(buf);
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    if (isRateLimitError(e)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = e instanceof Error ? e.message : 'Server error';
    const status =
      msg === 'Permission denied' ? 403
        : msg === 'Not logged in' ? 401
          : e instanceof SyntaxError ? 400
            : 500;
    sendJson(res, status, { error: msg });
  }
}

function sortGallery(images, sort) {
  const list = [...images];
  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    case 'views':
      return list.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    case 'size':
      return list.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    case 'name':
      return list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
    case 'favorites':
      return list.sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
    case 'newest':
    default:
      return list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
}

function toClientMeta(meta, req) {
  const origin = resolvePublicOrigin(req);
  return {
    id: meta.id,
    url: `${origin}/hosting/${meta.id}`,
    viewUrl: `${origin}/i/${meta.id}`,
    name: meta.name,
    mime: meta.mime,
    size: meta.size,
    width: meta.width,
    height: meta.height,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt ?? null,
    views: meta.views ?? 0,
    favorite: Boolean(meta.favorite),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
  };
}

export function createImageHostMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (
      pathname.startsWith('/api/images') ||
      pathname.startsWith('/hosting/')
    ) {
      return handleImageHostRequest(req, res);
    }
    next();
  });
}