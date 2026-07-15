/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { statFields } from './gameStatsConfig.mjs';

/** @typedef {'classic' | 'instant' | 'strategy'} ArcadeCategory */

export const ARCADE_GAMES_META = [
  { id: 'rps', statKey: 'Rps', flag: 'rps_played', label: 'Rock Paper Scissors', shortLabel: 'RPS', icon: '✊', category: 'classic', accent: 'rose', extendedAchievements: true },
  { id: 'ttt', statKey: 'Ttt', flag: 'ttt_played', label: 'Tic-Tac-Toe', shortLabel: 'TTT', icon: '⭕', category: 'classic', accent: 'teal', extendedAchievements: true },
  { id: 'connect4', statKey: 'Connect4', flag: 'connect4_played', label: 'Connect Four', shortLabel: 'C4', icon: '🔴', category: 'strategy', accent: 'rose' },
  { id: 'nim', statKey: 'Nim', flag: 'nim_played', label: 'Nim', shortLabel: 'Nim', icon: '🪨', category: 'strategy', accent: 'orange' },
  { id: 'coinflip', statKey: 'Coinflip', flag: 'coinflip_played', label: 'Coin Flip', shortLabel: 'Coin', icon: '🪙', category: 'instant', accent: 'amber' },
  { id: 'dice', statKey: 'Dice', flag: 'dice_played', label: 'Dice Duel', shortLabel: 'Dice', icon: '🎲', category: 'instant', accent: 'violet' },
  { id: 'oddeven', statKey: 'Oddeven', flag: 'oddeven_played', label: 'Odd or Even', shortLabel: 'O/E', icon: '🔢', category: 'instant', accent: 'sky' },
  { id: 'war', statKey: 'War', flag: 'war_played', label: 'Card War', shortLabel: 'War', icon: '🃏', category: 'instant', accent: 'violet' },
  { id: 'rpsls', statKey: 'Rpsls', flag: 'rpsls_played', label: 'RPS Lizard Spock', shortLabel: 'RPSLS', icon: '🦎', category: 'instant', accent: 'emerald' },
  { id: 'numberduel', statKey: 'Numberduel', flag: 'numberduel_played', label: 'Number Duel', shortLabel: 'Num', icon: '🔟', category: 'instant', accent: 'indigo' },
  { id: 'colorpick', statKey: 'Colorpick', flag: 'colorpick_played', label: 'Color Pick', shortLabel: 'Color', icon: '🎨', category: 'instant', accent: 'rose' },
  { id: 'highlow', statKey: 'Highlow', flag: 'highlow_played', label: 'High or Low', shortLabel: 'Hi/Lo', icon: '📈', category: 'instant', accent: 'cyan' },
  { id: 'mines', statKey: 'Mines', flag: 'mines_played', label: 'Minefield', shortLabel: 'Mines', icon: '💣', category: 'instant', accent: 'orange' },
  { id: 'blackjack', statKey: 'Blackjack', flag: 'blackjack_played', label: 'Blackjack Duel', shortLabel: 'BJ', icon: '🂡', category: 'instant', accent: 'emerald' },
];

export function lbWinsAwardId(gameId) {
  if (gameId === 'rps') return 'lb_top_game_wins';
  return `lb_top_${gameId}_wins`;
}

export function buildArcadeWinsLeaderboards() {
  return ARCADE_GAMES_META.map((g) => {
    const f = statFields(g.statKey);
    return {
      id: `game_${g.id}_wins`,
      awardId: lbWinsAwardId(g.id),
      title: `${g.shortLabel} Champion`,
      icon: g.icon,
      unit: 'wins',
      accent: g.accent,
      getValue: (u) => Number(u[f.wins]) || 0,
      min: 1,
      group: 'arcade',
    };
  });
}

export function countArcadeGamesPlayed(user) {
  return ARCADE_GAMES_META.filter((g) => {
    const f = statFields(g.statKey);
    return (Number(user[f.games]) || 0) >= 1;
  }).length;
}

export function totalArcadeGamesPlayed(user) {
  return ARCADE_GAMES_META.reduce((sum, g) => {
    const f = statFields(g.statKey);
    return sum + (Number(user[f.games]) || 0);
  }, 0);
}

export const STANDARD_ARCADE_ACHIEVEMENT_IDS = ARCADE_GAMES_META
  .filter((g) => !g.extendedAchievements)
  .flatMap((g) => [`${g.id}_first_play`, `${g.id}_first_win`, `${g.id}_win_10`]);

export const ARCADE_META_ACHIEVEMENT_IDS = [
  'arcade_variety_5',
  'arcade_variety_10',
  'arcade_variety_all',
  'arcade_total_100',
  'arcade_total_500',
];

export const ARCADE_LB_AWARD_IDS = ARCADE_GAMES_META.map((g) => lbWinsAwardId(g.id));