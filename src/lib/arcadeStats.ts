/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { GAME_CATALOG, GAME_CATEGORIES, type GameCategory, type GameId } from './gameCatalog';

export const GAME_STAT_PREFIX: Record<GameId, string> = {
  rps: 'Rps',
  ttt: 'Ttt',
  connect4: 'Connect4',
  nim: 'Nim',
  coinflip: 'Coinflip',
  dice: 'Dice',
  oddeven: 'Oddeven',
  war: 'War',
  rpsls: 'Rpsls',
  numberduel: 'Numberduel',
  colorpick: 'Colorpick',
  highlow: 'Highlow',
  mines: 'Mines',
  blackjack: 'Blackjack',
  dice100: 'Dice100',
};

/** Any user/profile object with game* stat fields from the server. */
export type ArcadeStatsSource = object;

export type GameStatBlock = {
  wins: number;
  losses: number;
  draws: number;
  games: number;
  streak: number;
  bestStreak: number;
  winRate: number;
};

function statFields(prefix: string) {
  return {
    wins: `game${prefix}Wins`,
    losses: `game${prefix}Losses`,
    draws: `game${prefix}Draws`,
    games: `game${prefix}Games`,
    streak: `game${prefix}Streak`,
    bestStreak: `game${prefix}BestStreak`,
  };
}

function statNum(source: ArcadeStatsSource, key: string): number {
  return Number((source as Record<string, unknown>)[key]) || 0;
}

export function getGameStats(source: ArcadeStatsSource, gameId: GameId): GameStatBlock {
  const prefix = GAME_STAT_PREFIX[gameId];
  const f = statFields(prefix);
  const wins = statNum(source, f.wins);
  const losses = statNum(source, f.losses);
  const draws = statNum(source, f.draws);
  const games = statNum(source, f.games);
  const decided = wins + losses;
  return {
    wins,
    losses,
    draws,
    games,
    streak: statNum(source, f.streak),
    bestStreak: statNum(source, f.bestStreak),
    winRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
  };
}

export type ArcadeSummary = {
  variety: number;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  bestStreak: number;
  currentStreak: number;
  overallWinRate: number;
  netCoins: number;
  lulCoins: number;
  jackpotsWon: number;
  coinsWon: number;
  coinsLost: number;
};

export type RankedGameStat = {
  gameId: GameId;
  label: string;
  icon: string;
  stats: GameStatBlock;
};

export function computeArcadeSummary(source: ArcadeStatsSource): ArcadeSummary {
  let variety = 0;
  let totalGames = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;
  let bestStreak = 0;
  let currentStreak = 0;
  for (const g of GAME_CATALOG) {
    const s = getGameStats(source, g.id as GameId);
    if (s.games >= 1) variety++;
    totalGames += s.games;
    totalWins += s.wins;
    totalLosses += s.losses;
    totalDraws += s.draws;
    bestStreak = Math.max(bestStreak, s.bestStreak);
    currentStreak = Math.max(currentStreak, s.streak);
  }
  const decided = totalWins + totalLosses;
  const coinsWon = statNum(source, 'gameTotalWon');
  const coinsLost = statNum(source, 'gameTotalLost');
  return {
    variety,
    totalGames,
    totalWins,
    totalLosses,
    totalDraws,
    bestStreak,
    currentStreak,
    overallWinRate: decided > 0 ? Math.round((totalWins / decided) * 100) : 0,
    netCoins: coinsWon - coinsLost,
    lulCoins: statNum(source, 'lulCoins'),
    jackpotsWon: statNum(source, 'gameJackpotsWon'),
    coinsWon,
    coinsLost,
  };
}

export function rankGamesByPlayed(source: ArcadeStatsSource, limit = 3): RankedGameStat[] {
  return GAME_CATALOG.map((g) => ({
    gameId: g.id as GameId,
    label: g.shortLabel,
    icon: g.icon,
    stats: getGameStats(source, g.id as GameId),
  }))
    .filter((g) => g.stats.games > 0)
    .sort((a, b) => b.stats.games - a.stats.games)
    .slice(0, limit);
}

export type LeaderboardRank = { category: string; rank: number; value: number };

export function findUserLeaderboardRanks(
  username: string,
  boards: {
    coins?: Array<{ rank: number; username: string; value: number }>;
    rps?: { wins: Array<{ rank: number; username: string; value: number }> };
    ttt?: { wins: Array<{ rank: number; username: string; value: number }> };
    [key: string]:
      | Array<{ rank: number; username: string; value: number }>
      | { wins: Array<{ rank: number; username: string; value: number }> }
      | undefined;
  } | null,
  opts?: { showCoins?: boolean; showActivityStats?: boolean },
): LeaderboardRank[] {
  if (!boards || !username) return [];
  if (opts?.showActivityStats === false) return [];
  const uname = username.toLowerCase();
  const ranks: LeaderboardRank[] = [];

  const scan = (rows: Array<{ rank: number; username: string; value: number }> | undefined, category: string) => {
    const row = rows?.find((r) => r.username.toLowerCase() === uname);
    if (row) ranks.push({ category, rank: row.rank, value: row.value });
  };

  if (opts?.showCoins !== false) scan(boards.coins, 'Coins');
  scan(boards.rps?.wins, 'RPS wins');
  scan(boards.ttt?.wins, 'TTT wins');

  for (const g of GAME_CATALOG) {
    const slice = boards[g.id];
    if (slice && !Array.isArray(slice) && slice.wins) {
      scan(slice.wins, `${g.shortLabel} wins`);
    }
  }

  return ranks.sort((a, b) => a.rank - b.rank);
}

/** Stat field keys for all arcade titles — mirrors server gameStatsConfig.mjs */
export type ArcadeStatSuffix = 'Wins' | 'Losses' | 'Draws' | 'Games' | 'Streak' | 'BestStreak';
export type ArcadeStatFieldsFor<P extends string> = {
  [K in ArcadeStatSuffix as `game${P}${K}`]?: number;
};
export type AllArcadeStatFields =
  ArcadeStatFieldsFor<'Rps'> &
  ArcadeStatFieldsFor<'Ttt'> &
  ArcadeStatFieldsFor<'Coinflip'> &
  ArcadeStatFieldsFor<'Dice'> &
  ArcadeStatFieldsFor<'Oddeven'> &
  ArcadeStatFieldsFor<'War'> &
  ArcadeStatFieldsFor<'Rpsls'> &
  ArcadeStatFieldsFor<'Numberduel'> &
  ArcadeStatFieldsFor<'Colorpick'> &
  ArcadeStatFieldsFor<'Highlow'> &
  ArcadeStatFieldsFor<'Mines'> &
  ArcadeStatFieldsFor<'Blackjack'> &
  ArcadeStatFieldsFor<'Dice100'> &
  ArcadeStatFieldsFor<'Nim'> &
  ArcadeStatFieldsFor<'Connect4'>;

export type GameAchievementBadge = {
  id: string;
  icon: string;
  label: string;
  shortLabel: string;
  earned: boolean;
};

const RPS_BADGE_IDS = ['rps_first_play', 'rps_first_win', 'rps_win_10'] as const;
const TTT_BADGE_IDS = ['ttt_first_play', 'ttt_first_win', 'ttt_win_10'] as const;

export function getGameAchievementBadgeIds(gameId: GameId): string[] {
  if (gameId === 'rps') return [...RPS_BADGE_IDS];
  if (gameId === 'ttt') return [...TTT_BADGE_IDS];
  return [`${gameId}_first_play`, `${gameId}_first_win`, `${gameId}_win_10`];
}

function badgeShortLabel(id: string): string {
  if (id.endsWith('_first_play')) return 'Debut';
  if (id.endsWith('_first_win')) return 'Victor';
  return 'Fighter';
}

export function getGameAchievementBadges(
  gameId: GameId,
  earnedIds: Set<string>,
): GameAchievementBadge[] {
  return getGameAchievementBadgeIds(gameId).map((id) => {
    const def = ACHIEVEMENT_BY_ID[id];
    return {
      id,
      icon: def?.icon ?? '🎖️',
      label: def?.name ?? id,
      shortLabel: badgeShortLabel(id),
      earned: earnedIds.has(id),
    };
  });
}

export function countEarnedGameBadges(gameId: GameId, earnedIds: Set<string>): number {
  return getGameAchievementBadgeIds(gameId).filter((id) => earnedIds.has(id)).length;
}

export { GAME_CATEGORIES, type GameCategory };