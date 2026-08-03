/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth } from './auth/authApi.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';
import { requireMemberTab } from './tabAccessGuard.mjs';
import { getGameHandler, GAME_IDS } from './gameRegistry.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import {
  claimDailyBonus,
  getCoinFeed,
  getGamesLeaderboard,
  getGamesState,
  getRecentHistory,
} from './gamesService.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = 32 * 1024) {
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

function requireUser(req) {
  if (!req.auth?.user) throw new Error('Not logged in');
  return req.auth.user;
}

export async function handleGamesRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    await attachAuth(req);
    await requireMemberTab(req, 'games');
    const user = req.auth?.user ?? null;

    if (req.method === 'GET' && pathname === '/api/games/state') {
      const u = requireUser(req);
      await checkRateLimit(`games-state:${u.id}`, { max: 120, windowMs: 60_000 });
      return sendJson(res, 200, await getGamesState(u.id));
    }

    if (req.method === 'GET' && pathname === '/api/games/catalog') {
      await checkRateLimit(`games-catalog:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      return sendJson(res, 200, { games: GAME_IDS });
    }

    if (req.method === 'GET' && pathname === '/api/games/leaderboard') {
      const u = requireUser(req);
      await checkRateLimit(`games-leaderboard:${u.id}`, { max: 90, windowMs: 60_000 });
      return sendJson(res, 200, await getGamesLeaderboard());
    }

    if (req.method === 'GET' && pathname === '/api/games/history') {
      const u = requireUser(req);
      await checkRateLimit(`games-history:${u.id}`, { max: 90, windowMs: 60_000 });
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
      return sendJson(res, 200, { matches: await getRecentHistory(limit) });
    }

    if (req.method === 'GET' && pathname === '/api/games/coin-feed') {
      const u = requireUser(req);
      await checkRateLimit(`games-feed:${u.id}`, { max: 60, windowMs: 60_000 });
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 40));
      return sendJson(res, 200, await getCoinFeed(u.id, limit));
    }

    const genericMatchGet = pathname.match(/^\/api\/games\/([a-z0-9]+)\/match\/([a-f0-9]+)$/);
    if (req.method === 'GET' && genericMatchGet) {
      const handler = getGameHandler(genericMatchGet[1]);
      if (!handler) return sendJson(res, 404, { error: 'Game not found' });
      const u = requireUser(req);
      await checkRateLimit(`games-match:${u.id}`, { max: 120, windowMs: 60_000 });
      const match = await Promise.resolve(handler.getMatch(genericMatchGet[2], u.id));
      if (!match) return sendJson(res, 404, { error: 'Match not found' });
      return sendJson(res, 200, { match });
    }

    const genericQueue = pathname.match(/^\/api\/games\/([a-z0-9]+)\/queue$/);
    if (genericQueue) {
      const gameId = genericQueue[1];
      const handler = getGameHandler(gameId);
      if (!handler) return sendJson(res, 404, { error: 'Game not found' });
      if (req.method === 'POST') {
        const u = requireUser(req);
        await checkRateLimit(`games-queue:${u.id}`, { max: 30, windowMs: 60_000 });
        const body = await readJsonBody(req);
        const result = await handler.joinQueue(u.id, body);
        return sendJson(res, 200, result);
      }
      if (req.method === 'DELETE') {
        const u = requireUser(req);
        await checkRateLimit(`games-queue-leave:${u.id}`, { max: 40, windowMs: 60_000 });
        return sendJson(res, 200, await handler.leaveQueue(u.id));
      }
    }

    const genericMove = pathname.match(/^\/api\/games\/([a-z0-9]+)\/move$/);
    if (req.method === 'POST' && genericMove) {
      const handler = getGameHandler(genericMove[1]);
      if (!handler) return sendJson(res, 404, { error: 'Game not found' });
      const u = requireUser(req);
      await checkRateLimit(`games-move:${u.id}`, { max: 120, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const move = body.move ?? body.cell ?? body.column ?? body.col;
      const result = await handler.submitMove(u.id, String(body.matchId ?? ''), move);
      return sendJson(res, 200, result);
    }

    if (req.method === 'DELETE' && pathname === '/api/games/queue') {
      return sendJson(res, 410, {
        error: 'Deprecated — use DELETE /api/games/{gameId}/queue for the game you joined',
      });
    }

    if (req.method === 'POST' && pathname === '/api/games/daily-bonus') {
      const u = requireUser(req);
      await checkRateLimit(`games-daily:${u.id}`, { max: 5, windowMs: 60_000 });
      return sendJson(res, 200, await claimDailyBonus(u.id));
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    const status =
      isRateLimitError(e) ? 429
        : e instanceof SyntaxError ? 400
        : msg === 'Permission denied' ? 403
        : msg === 'Not logged in' ? 401
        : msg.includes('Please wait') ? 429
        : msg.includes('enough') || msg.includes('Invalid') || msg.includes('already')
          || msg.includes('turn') || msg.includes('taken') || msg.includes('Column')
          || msg.includes('Finish your active') || msg.includes('Leave your other')
          || msg.includes('Escrow') || msg.includes('re-join') ? 400
          : msg.includes('not found') || msg.includes('expired') ? 404
            : 500;
    return sendJson(res, status, { error: msg });
  }
}

export function createGamesMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/games')) {
      return handleGamesRequest(req, res);
    }
    next();
  });
}