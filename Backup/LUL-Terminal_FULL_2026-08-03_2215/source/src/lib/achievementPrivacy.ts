/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EarnedAchievement } from '../data/achievements';
import { GAME_CATALOG } from './gameCatalog';

const ACTIVITY_ACHIEVEMENT_IDS = new Set([
  'games_explorer',
  'jackpot_hunter',
  'lul_coins_5000',
  'lb_top_game_wins',
  'lb_top_game_losses',
  'lb_top_game_games',
  'lb_top_lul_coins',
]);

const ARCADE_META_IDS = [
  'arcade_variety_5',
  'arcade_variety_10',
  'arcade_variety_all',
  'arcade_total_100',
  'arcade_total_500',
];

const STANDARD_ARCADE_SUFFIXES = ['_first_play', '_first_win', '_win_10'] as const;

export function isCoinSensitiveAchievement(id: string): boolean {
  if (id.startsWith('lul_coins_') || id.startsWith('jackpot_')) return true;
  if (id === 'lb_top_lul_coins') return true;
  return false;
}

function isActivitySensitiveAchievement(id: string): boolean {
  if (ACTIVITY_ACHIEVEMENT_IDS.has(id)) return true;
  if (ARCADE_META_IDS.includes(id)) return true;
  if (id.startsWith('rps_') || id.startsWith('ttt_')) return true;
  if (isCoinSensitiveAchievement(id)) return true;
  if (id.startsWith('lb_top_game_')) return true;
  if (id.startsWith('lb_top_') && id.endsWith('_wins')) return true;
  return GAME_CATALOG.some((g) => {
    if (id.startsWith(`${g.id}_`)) return true;
    return STANDARD_ARCADE_SUFFIXES.some((s) => id === `${g.id}${s}`);
  });
}

export function filterAchievementsForPrivacyPreview(
  achievements: EarnedAchievement[],
  opts: { showActivityStats: boolean; showCoins?: boolean },
): EarnedAchievement[] {
  const showCoins = opts.showCoins !== false;
  return achievements.filter((a) => {
    if (!opts.showActivityStats && isActivitySensitiveAchievement(a.id)) return false;
    if (!showCoins && isCoinSensitiveAchievement(a.id)) return false;
    return true;
  });
}