/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sanitizeAvatarUrl } from './auth/safeMediaUrl.mjs';
import { loadUsersDb } from './auth/authStore.mjs';
import { normalizeProfileCustomization } from './profileCustomization.mjs';
import { getCoinFeedForUser } from './coinLedger.mjs';
import { GAME_IDS, GAME_REGISTRY } from './gameRegistry.mjs';
import {
  DAILY_BONUS_COINS,
  DAILY_BONUS_COOLDOWN_MS,
  JACKPOT_CHANCE,
  loadJackpot,
  loadMatchHistory,
  MAX_BET,
  MIN_BET,
  STREAK_BONUS_CAP,
  STREAK_BONUS_RATE,
} from './gamesStore.mjs';
import {
  claimDailyBonus,
  getDailyBonusStatus,
} from './rpsService.mjs';

function getUser(db, userId) {
  return db.users.find((u) => u.id === userId && u.role !== 'bot');
}

function buildDailyBonusPayload(user) {
  const status = getDailyBonusStatus(user);
  return {
    amount: DAILY_BONUS_COINS,
    cooldownMs: DAILY_BONUS_COOLDOWN_MS,
    ...status,
  };
}

export { assertNoOtherArcadeSession as assertNoOtherPlayingMatch } from './gamesSessionGuard.mjs';

export async function getGamesState(userId) {
  const [jackpot, ...slices] = await Promise.all([
    loadJackpot(),
    ...GAME_IDS.map((id) => GAME_REGISTRY[id].getUserSlice(userId)),
  ]);
  const db = await loadUsersDb();
  const user = userId ? getUser(db, userId) : null;

  const games = {};
  GAME_IDS.forEach((id, i) => {
    games[id] = slices[i];
  });

  return {
    jackpot: {
      pool: jackpot.pool ?? 0,
      hits: jackpot.hits ?? 0,
      lastWinner: jackpot.lastWinner,
      lastWonAt: jackpot.lastWonAt,
      chancePercent: JACKPOT_CHANCE * 100,
    },
    myCoins: user?.lulCoins ?? null,
    minBet: MIN_BET,
    maxBet: MAX_BET,
    dailyBonus: buildDailyBonusPayload(user),
    streakBonus: {
      ratePercent: STREAK_BONUS_RATE * 100,
      capPercent: STREAK_BONUS_CAP * 100,
    },
    games,
    rps: games.rps,
    ttt: games.ttt,
  };
}

export async function getGamesLeaderboard() {
  const [db, ...boards] = await Promise.all([
    loadUsersDb(),
    ...GAME_IDS.map((id) => GAME_REGISTRY[id].getLeaderboard()),
  ]);

  const leaderboards = {};
  GAME_IDS.forEach((id, i) => {
    leaderboards[id] = boards[i];
  });

  const users = db.users.filter((u) => u.role !== 'bot' && u.active !== false);
  const coinsVisible = users.filter((u) => {
    const privacy = normalizeProfileCustomization(u.profileCustomization).privacy;
    return privacy.showCoins !== false;
  });
  const coins = [...coinsVisible]
    .sort((a, b) => (Number(b.lulCoins) || 0) - (Number(a.lulCoins) || 0))
    .slice(0, 10)
    .map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: sanitizeAvatarUrl(u.avatarUrl) || '',
      value: Number(u.lulCoins) || 0,
    }));

  return { ...leaderboards, coins, rps: leaderboards.rps, ttt: leaderboards.ttt };
}

function userShowsActivity(user) {
  if (!user) return true;
  const privacy = normalizeProfileCustomization(user.profileCustomization).privacy;
  return privacy.showActivityStats !== false;
}

export async function getRecentHistory(limit = 20) {
  const db = await loadMatchHistory();
  const usersDb = await loadUsersDb();
  const byUsername = new Map(
    usersDb.users.map((u) => [String(u.username ?? '').toLowerCase(), u]),
  );
  const visible = (uname) => {
    if (!uname || uname === 'BOT') return true;
    return userShowsActivity(byUsername.get(String(uname).toLowerCase()));
  };
  return db.matches
    .filter((m) => visible(m.player1) && visible(m.player2))
    .slice(0, limit);
}

export async function leaveAllGameQueues(userId) {
  const errors = [];
  for (const id of GAME_IDS) {
    try {
      const handler = GAME_REGISTRY[id];
      if (handler.releaseUserSession) {
        await handler.releaseUserSession(userId);
      } else {
        await handler.leaveQueue(userId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ gameId: id, error: msg });
      console.warn('[games] releaseUserSession failed', { userId, gameId: id, error: msg });
    }
  }
  return { ok: errors.length === 0, errors };
}

/** True when user still has an in-memory queue entry or active match in any arcade game. */
export async function userHasActiveArcadeSession(userId) {
  if (!userId) return false;
  const slices = await Promise.all(GAME_IDS.map((id) => GAME_REGISTRY[id].getUserSlice(userId)));
  return slices.some((slice) => slice?.inQueue || slice?.activeMatch);
}

export async function getCoinFeed(userId, limit = 40) {
  const db = await loadUsersDb();
  const user = userId ? getUser(db, userId) : null;
  if (!user) return { generatedAt: Date.now(), items: [], totalShown: 0, recentEarned: 0, balance: null };
  return getCoinFeedForUser(user, { limit });
}

export { claimDailyBonus };