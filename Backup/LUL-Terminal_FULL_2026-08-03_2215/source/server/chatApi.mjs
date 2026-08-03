/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth } from './auth/authApi.mjs';
import { isEffectivelyActive } from './auth/permissions.mjs';
import { recordUserShoutboxSend } from './auth/authService.mjs';
import { handleChatActivity } from './chatActivity.mjs';
import { listLobbyMessages, postLobbyMessage } from './chatService.mjs';
import { getEmoteFile, listPublicEmotes } from './chatEmotesStore.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { requireChatAccess } from './tabAccessGuard.mjs';
import { applyRateLimitHeaders, checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';

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

export async function handleChatRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/chat/emotes') {
      await checkRateLimit(`chat-emotes:${clientIp(req)}`, { max: 60, windowMs: 60_000 });
      return sendJson(res, 200, await listPublicEmotes());
    }

    const fileMatch = pathname.match(/^\/api\/chat\/emotes\/files\/([a-f0-9]{12}\.(?:png|jpg|jpeg|gif|webp|svg))$/i);
    if (req.method === 'GET' && fileMatch) {
      await checkRateLimit(`chat-emote-file:${clientIp(req)}`, { max: 120, windowMs: 60_000 });
      const hit = await getEmoteFile(fileMatch[1]);
      if (!hit) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', hit.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.end(hit.buf);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/chat/lobby/messages') {
      const since = Number(url.searchParams.get('since') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 80);
      await attachAuth(req);
      const user = req.auth?.user;
      const hadToken = Boolean(req.auth?.token);
      const pollKey = user && isEffectivelyActive(user)
        ? `chat-poll:${user.id}`
        : `chat-poll-guest:${clientIp(req)}`;
      const pollMax = user && isEffectivelyActive(user) ? 120 : 30;
      await checkRateLimit(pollKey, { max: pollMax, windowMs: 60_000 });
      if (!user || !isEffectivelyActive(user)) {
        if (hadToken) {
          return sendJson(res, 401, { error: 'Not logged in' });
        }
        return sendJson(res, 200, await listLobbyMessages({ since, limit }));
      }
      await requireChatAccess(req);
      const data = await listLobbyMessages({ since, limit });
      return sendJson(res, 200, data);
    }

    if (req.method === 'POST' && pathname === '/api/chat/lobby/messages') {
      await attachAuth(req);
      if (!req.auth?.user) {
        throw new Error('You must be logged in with a registered account to post messages');
      }
      await requireChatAccess(req);
      await checkRateLimit(`chat-send:${req.auth.user.id}`, { max: 40, windowMs: 60_000 });
      const body = await readJsonBody(req, 2048);
      if (typeof body.text !== 'string') throw new Error('Message text required');
      const message = await postLobbyMessage(req.auth.user, body.text);
      const countsAsChat = message.userId === req.auth.user.id
        && (message.kind === 'chat' || message.kind === 'action');
      const newUnlocks = countsAsChat
        ? await recordUserShoutboxSend(req.auth.user.id)
        : [];
      const { buildUnlockPayload } = await import('./achievementCoinRewards.mjs');
      return sendJson(res, 201, { message, ...buildUnlockPayload(newUnlocks) });
    }

    if (req.method === 'POST' && pathname === '/api/chat/activity') {
      await attachAuth(req);
      if (!req.auth?.user) {
        throw new Error('You must be logged in to report activity');
      }
      await requireChatAccess(req);
      await checkRateLimit(`chat-activity:${req.auth.user.id}`, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const activityType = String(body?.type ?? '').trim();
      if (activityType === 'meme_created') {
        const { requireMemberTab } = await import('./tabAccessGuard.mjs');
        await requireMemberTab(req, 'memegen');
      }
      const message = await handleChatActivity(req.auth.user, body);
      return sendJson(res, 201, { message });
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    if (isRateLimitError(e)) {
      applyRateLimitHeaders(res, e);
      return sendJson(res, 429, { error: msg });
    }
    const status = e instanceof SyntaxError ? 400
      : msg.includes('logged in') || msg === 'Not logged in'
        ? 401
        : msg === 'Permission denied' || msg.includes('banned') || msg.includes('muted')
          ? 403
          : msg.includes('wait') || msg.includes('empty') || msg.includes('long')
            || msg.includes('must start') || msg.includes('Usage:') || msg.includes('Unknown')
            || msg.includes('Admin only')
            || msg.includes('not found') || msg.includes('Cannot') || msg.includes('required')
            ? 400
            : 500;
    sendJson(res, status, { error: msg });
  }
}

export function createChatMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/chat')) {
      return handleChatRequest(req, res);
    }
    next();
  });
}