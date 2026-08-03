/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ARCADE_GAMES_META,
  countArcadeGamesPlayed,
  totalArcadeGamesPlayed,
} from './arcadeMeta.mjs';
import { statFields } from './gameStatsConfig.mjs';

/**
 * @param {object} user
 * @param {object} act
 * @param {number} now
 * @param {(user: object, id: string, now: number) => boolean} grant
 * @returns {string[]}
 */
export function syncStandardArcadeAchievements(user, act, now, grant) {
  const unlocked = [];

  for (const game of ARCADE_GAMES_META) {
    if (game.extendedAchievements) continue;
    const f = statFields(game.statKey);
    const games = Math.max(0, Number(user[f.games]) || 0);
    const wins = Math.max(0, Number(user[f.wins]) || 0);
    const flag = act.flags?.[game.flag];

    if ((flag || games >= 1) && grant(user, `${game.id}_first_play`, now)) {
      unlocked.push(`${game.id}_first_play`);
    }
    if (wins >= 1 && grant(user, `${game.id}_first_win`, now)) {
      unlocked.push(`${game.id}_first_win`);
    }
    if (wins >= 10 && grant(user, `${game.id}_win_10`, now)) {
      unlocked.push(`${game.id}_win_10`);
    }
  }

  const variety = countArcadeGamesPlayed(user);
  const total = totalArcadeGamesPlayed(user);

  if (variety >= 5 && grant(user, 'arcade_variety_5', now)) unlocked.push('arcade_variety_5');
  if (variety >= 10 && grant(user, 'arcade_variety_10', now)) unlocked.push('arcade_variety_10');
  if (variety >= ARCADE_GAMES_META.length && grant(user, 'arcade_variety_all', now)) {
    unlocked.push('arcade_variety_all');
  }
  if (total >= 100 && grant(user, 'arcade_total_100', now)) unlocked.push('arcade_total_100');
  if (total >= 500 && grant(user, 'arcade_total_500', now)) unlocked.push('arcade_total_500');

  return unlocked;
}