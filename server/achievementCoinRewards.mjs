/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logAchievementCredit } from './coinLedger.mjs';

/** LULcoin payout when a stored achievement/award is newly unlocked. */
export function achievementCoinReward(id) {
  const key = String(id ?? '').trim();
  if (!key) return 0;

  if (key.startsWith('lb_top_')) return 500;

  if (key === 'jackpot_hunter') return 250;
  if (key === 'lul_coins_5000') return 100;
  if (key === 'arcade_variety_all') return 300;
  if (key === 'arcade_total_500') return 500;
  if (key === 'arcade_total_100') return 150;
  if (key === 'arcade_variety_10') return 120;
  if (key === 'arcade_variety_5') return 60;
  if (key === 'journey_begins') return 50;
  if (key === 'games_explorer') return 40;

  if (key.endsWith('_first_play')) return 30;
  if (key.endsWith('_first_win')) return 60;
  if (key.endsWith('_win_10')) return 100;
  if (key.endsWith('_win_50')) return 200;
  if (key.endsWith('_win_100')) return 400;

  if (key.includes('_streak_10')) return 150;
  if (key.includes('_streak_5')) return 80;
  if (key.includes('_glutton')) return 40;
  if (key.includes('_master') || key.includes('_legend')) return 120;
  if (key.includes('_fighter') || key.includes('_fan')) return 75;
  if (key.includes('_explorer') || key.includes('_pioneer') || key.includes('_debut')) return 35;
  if (key.includes('vault_')) return 100;

  const tail = key.match(/_(\d+)$/);
  if (tail) {
    const n = Number(tail[1]);
    if (n >= 99999) return 500;
    if (n >= 10000) return 400;
    if (n >= 5000) return 300;
    if (n >= 2000) return 220;
    if (n >= 1000) return 160;
    if (n >= 500) return 120;
    if (n >= 250) return 90;
    if (n >= 100) return 65;
    if (n >= 50) return 45;
    if (n >= 10) return 30;
    return 20;
  }

  return 25;
}

export function buildUnlockPayload(unlockedIds) {
  const ids = [...new Set((unlockedIds ?? []).map((id) => String(id).trim()).filter(Boolean))];
  const unlockRewards = {};
  let unlockCoinsTotal = 0;
  for (const id of ids) {
    const coins = achievementCoinReward(id);
    unlockRewards[id] = coins;
    unlockCoinsTotal += coins;
  }
  return { newUnlocks: ids, unlockRewards, unlockCoinsTotal };
}

export function creditAchievementCoins(user, amount, achievementId, earnedAt) {
  return logAchievementCredit(user, achievementId, amount, earnedAt);
}