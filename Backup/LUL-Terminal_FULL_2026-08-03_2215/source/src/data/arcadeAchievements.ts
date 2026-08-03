/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AchievementDef } from './achievements';

type ArcadeGameMeta = {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  extendedAchievements?: boolean;
};

export const ARCADE_GAMES_FOR_ACHIEVEMENTS: ArcadeGameMeta[] = [
  { id: 'connect4', label: 'Connect Four', shortLabel: 'C4', icon: '🔴' },
  { id: 'nim', label: 'Nim', shortLabel: 'Nim', icon: '🪨' },
  { id: 'coinflip', label: 'Coin Flip', shortLabel: 'Coin', icon: '🪙' },
  { id: 'dice', label: 'Dice Duel', shortLabel: 'Dice', icon: '🎲' },
  { id: 'oddeven', label: 'Odd or Even', shortLabel: 'O/E', icon: '🔢' },
  { id: 'war', label: 'Card War', shortLabel: 'War', icon: '🃏' },
  { id: 'rpsls', label: 'RPS Lizard Spock', shortLabel: 'RPSLS', icon: '🦎' },
  { id: 'numberduel', label: 'Number Duel', shortLabel: 'Num', icon: '🔟' },
  { id: 'colorpick', label: 'Color Pick', shortLabel: 'Color', icon: '🎨' },
  { id: 'highlow', label: 'High or Low', shortLabel: 'Hi/Lo', icon: '📈' },
  { id: 'mines', label: 'Minefield', shortLabel: 'Mines', icon: '💣' },
  { id: 'blackjack', label: 'Blackjack Duel', shortLabel: 'BJ', icon: '🂡' },
  { id: 'dice100', label: 'Dice 100', shortLabel: 'D100', icon: '🎯' },
  { id: 'roulette', label: 'Roulette', shortLabel: 'Roul', icon: '🎡' },
];

export const ARCADE_STANDARD_ACHIEVEMENTS: AchievementDef[] = ARCADE_GAMES_FOR_ACHIEVEMENTS.flatMap((g) => [
  {
    id: `${g.id}_first_play`,
    kind: 'achievement',
    name: `${g.shortLabel} Debut`,
    description: `Your first ${g.label} match in the LULcoin arcade.`,
    icon: g.icon,
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'trivial',
    howToUnlock: `Complete your first ${g.label} match (PvP or vs BOT).`,
    auto: true,
  },
  {
    id: `${g.id}_first_win`,
    kind: 'achievement',
    name: `${g.shortLabel} Victor`,
    description: `Your first victory in ${g.label}.`,
    icon: '🏅',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: `Win your first ${g.label} match.`,
    auto: true,
  },
  {
    id: `${g.id}_win_10`,
    kind: 'achievement',
    name: `${g.shortLabel} Fighter`,
    description: `Ten ${g.label} victories — you know the meta.`,
    icon: '🥊',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: `Win 10 ${g.label} matches.`,
    auto: true,
  },
]);

export const ARCADE_META_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'arcade_variety_5',
    kind: 'achievement',
    name: 'Arcade Tourist',
    description: 'You tried five different arcade games.',
    icon: '🗺️',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Play at least one match in 5 different arcade games.',
    auto: true,
  },
  {
    id: 'arcade_variety_10',
    kind: 'achievement',
    name: 'Arcade Explorer',
    description: 'Ten different games — the full tour.',
    icon: '🧭',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Play at least one match in 10 different arcade games.',
    auto: true,
  },
  {
    id: 'arcade_variety_all',
    kind: 'achievement',
    name: 'Arcade Completionist',
    description: 'You played every game in the arcade at least once.',
    icon: '👑',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'legendary',
    howToUnlock: 'Play at least one match in all 14 arcade games.',
    auto: true,
  },
  {
    id: 'arcade_total_100',
    kind: 'achievement',
    name: 'Coin Duelist',
    description: 'One hundred arcade matches across all games.',
    icon: '⚔️',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Play 100 total arcade matches (all games combined).',
    auto: true,
  },
  {
    id: 'arcade_total_500',
    kind: 'achievement',
    name: 'Terminal Gladiator',
    description: 'Five hundred arcade matches — the pit knows your name.',
    icon: '🏟️',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'legendary',
    howToUnlock: 'Play 500 total arcade matches (all games combined).',
    auto: true,
  },
];

const LB_GAMES = [
  { id: 'rps', awardId: 'lb_top_game_wins', name: 'RPS Champion', icon: '✊', label: 'Rock Paper Scissors wins' },
  { id: 'ttt', awardId: 'lb_top_ttt_wins', name: 'TTT Champion', icon: '⭕', label: 'Tic-Tac-Toe wins' },
  ...ARCADE_GAMES_FOR_ACHIEVEMENTS.map((g) => ({
    id: g.id,
    awardId: `lb_top_${g.id}_wins`,
    name: `${g.shortLabel} Champion`,
    icon: g.icon,
    label: `${g.label} wins`,
  })),
];

export const ARCADE_LB_AWARDS: AchievementDef[] = LB_GAMES.map((g) => ({
  id: g.awardId,
  kind: 'award',
  name: g.name,
  description: `Top 3 on the ${g.label} leaderboard.`,
  icon: g.icon,
  rarity: 'legendary',
  tier: 'gold',
  difficulty: 'exclusive',
  howToUnlock: `Reach Top 3 in ${g.label} on the Hall of Fame.`,
}));