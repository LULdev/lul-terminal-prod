/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { ARCADE_GAMES_META } from './arcadeMeta.mjs';

export const COIN_LEDGER_MAX = 80;

const GAME_ICON = Object.fromEntries(ARCADE_GAMES_META.map((g) => [g.id, g.icon]));

const KIND_ICON = {
  achievement: '🎖️',
  daily_bonus: '🎁',
  game_win: '🏆',
  streak_bonus: '🔥',
  jackpot: '🎰',
  draw_refund: '↩️',
};

export function appendCoinEntry(user, entry) {
  if (!user || user.role === 'bot') return null;
  const amount = Math.max(0, Math.floor(Number(entry.amount) || 0));
  if (amount <= 0) return null;

  const row = {
    id: entry.id ?? crypto.randomBytes(6).toString('hex'),
    kind: String(entry.kind ?? 'credit').slice(0, 24),
    amount,
    label: String(entry.label ?? 'LULcoin credit').slice(0, 140),
    icon: entry.icon ? String(entry.icon).slice(0, 8) : (KIND_ICON[entry.kind] ?? '🪙'),
    at: Number(entry.at) || Date.now(),
    meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : undefined,
  };

  if (!Array.isArray(user.coinLedger)) user.coinLedger = [];
  user.coinLedger.unshift(row);
  if (user.coinLedger.length > COIN_LEDGER_MAX) {
    user.coinLedger.length = COIN_LEDGER_MAX;
  }
  return row;
}

export function creditUserCoins(user, amount, ledgerEntry) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (n <= 0) return 0;
  if (user.lulCoins == null) user.lulCoins = 1000;
  user.lulCoins = Math.max(0, Number(user.lulCoins) || 0) + n;
  if (ledgerEntry) appendCoinEntry(user, { ...ledgerEntry, amount: n });
  return n;
}

function ledgerMeta(gameId, matchId, bet, extra = {}) {
  return {
    gameId: gameId || undefined,
    matchId: matchId || undefined,
    bet: bet != null ? Number(bet) : undefined,
    ...extra,
  };
}

export function logGameWinCredit(user, { gameId, chatLabel, matchId, bet, mode, amount }) {
  const icon = GAME_ICON[gameId] ?? '🎮';
  const vs = mode === 'bot' ? 'vs BOT' : 'PvP';
  return creditUserCoins(user, amount, {
    kind: 'game_win',
    label: `${chatLabel} ${vs} victory`,
    icon,
    meta: ledgerMeta(gameId, matchId, bet, { mode }),
  });
}

export function logStreakCredit(user, { gameId, chatLabel, matchId, bet, amount }) {
  return creditUserCoins(user, amount, {
    kind: 'streak_bonus',
    label: `Streak bonus · ${chatLabel}`,
    icon: '🔥',
    meta: ledgerMeta(gameId, matchId, bet),
  });
}

export function logJackpotCredit(user, { gameId, matchId, bet, amount }) {
  return creditUserCoins(user, amount, {
    kind: 'jackpot',
    label: 'Community jackpot hit',
    icon: '🎰',
    meta: ledgerMeta(gameId, matchId, bet),
  });
}

export function logDrawRefund(user, { gameId, chatLabel, matchId, bet, amount }) {
  const icon = GAME_ICON[gameId] ?? '↩️';
  return creditUserCoins(user, amount, {
    kind: 'draw_refund',
    label: `${chatLabel} draw — bet refunded`,
    icon,
    meta: ledgerMeta(gameId, matchId, bet),
  });
}

export function logQueueRefund(user, { gameId, chatLabel, bet, amount }) {
  const icon = GAME_ICON[gameId] ?? '↩️';
  return creditUserCoins(user, amount, {
    kind: 'draw_refund',
    label: `${chatLabel} — queue bet refunded`,
    icon,
    meta: ledgerMeta(gameId, null, bet),
  });
}

export function logMatchExpireRefund(user, { gameId, chatLabel, matchId, bet, amount }) {
  const icon = GAME_ICON[gameId] ?? '↩️';
  return creditUserCoins(user, amount, {
    kind: 'draw_refund',
    label: `${chatLabel} — match expired, bet refunded`,
    icon,
    meta: ledgerMeta(gameId, matchId, bet),
  });
}

export function logAchievementCredit(user, achievementId, amount, at = Date.now()) {
  return creditUserCoins(user, amount, {
    kind: 'achievement',
    label: `Achievement unlocked`,
    icon: '🎖️',
    at,
    meta: { achievementId },
  });
}

export function logDailyBonusCredit(user, amount) {
  return creditUserCoins(user, amount, {
    kind: 'daily_bonus',
    label: 'Daily reload bonus',
    icon: '🎁',
  });
}

/** Merge persisted ledger with legacy achievement coinReward rows. */
export function getCoinFeedForUser(user, { limit = 40 } = {}) {
  const cap = Math.min(80, Math.max(1, Number(limit) || 40));
  const ledger = Array.isArray(user?.coinLedger) ? [...user.coinLedger] : [];
  const ledgerAchIds = new Set(
    ledger
      .filter((e) => e.kind === 'achievement' && e.meta?.achievementId)
      .map((e) => e.meta.achievementId),
  );

  for (const a of user?.achievements ?? []) {
    const coins = Math.max(0, Number(a.coinReward) || 0);
    if (coins <= 0 || ledgerAchIds.has(a.id)) continue;
    ledger.push({
      id: `legacy-ach-${a.id}`,
      kind: 'achievement',
      amount: coins,
      label: 'Achievement unlocked',
      icon: '🎖️',
      at: Number(a.earnedAt) || 0,
      meta: { achievementId: a.id },
      legacy: true,
    });
  }

  ledger.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
  const items = ledger.slice(0, cap);
  const recentEarned = items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return {
    generatedAt: Date.now(),
    items,
    totalShown: items.length,
    recentEarned,
    balance: Math.max(0, Number(user?.lulCoins) || 0),
  };
}