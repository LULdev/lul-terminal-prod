/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Stat field prefix after `game` — e.g. Coinflip → gameCoinflipWins */
export const ARCADE_STAT_KEYS = [
  'Rps',
  'Ttt',
  'Coinflip',
  'Dice',
  'Oddeven',
  'War',
  'Rpsls',
  'Numberduel',
  'Colorpick',
  'Highlow',
  'Mines',
  'Blackjack',
  'Dice100',
  'Roulette',
  'Nim',
  'Connect4',
];

export function statFields(prefix) {
  return {
    wins: `game${prefix}Wins`,
    losses: `game${prefix}Losses`,
    draws: `game${prefix}Draws`,
    games: `game${prefix}Games`,
    streak: `game${prefix}Streak`,
    bestStreak: `game${prefix}BestStreak`,
  };
}

export function defaultGameStats(user, prefix) {
  const f = statFields(prefix);
  return {
    wins: Number(user[f.wins]) || 0,
    losses: Number(user[f.losses]) || 0,
    draws: Number(user[f.draws]) || 0,
    games: Number(user[f.games]) || 0,
    streak: Number(user[f.streak]) || 0,
    bestStreak: Number(user[f.bestStreak]) || 0,
    jackpotsWon: Number(user.gameJackpotsWon) || 0,
    totalWon: Number(user.gameTotalWon) || 0,
    totalLost: Number(user.gameTotalLost) || 0,
  };
}

export function normalizeGameStatsOnUser(u) {
  const out = { ...u };
  for (const prefix of ARCADE_STAT_KEYS) {
    const f = statFields(prefix);
    out[f.wins] = Math.max(0, Number(u[f.wins]) || 0);
    out[f.losses] = Math.max(0, Number(u[f.losses]) || 0);
    out[f.draws] = Math.max(0, Number(u[f.draws]) || 0);
    out[f.games] = Math.max(0, Number(u[f.games]) || 0);
    out[f.streak] = Math.max(0, Number(u[f.streak]) || 0);
    out[f.bestStreak] = Math.max(0, Number(u[f.bestStreak]) || 0);
  }
  return out;
}

export function zeroGameStats() {
  const stats = {};
  for (const prefix of ARCADE_STAT_KEYS) {
    const f = statFields(prefix);
    stats[f.wins] = 0;
    stats[f.losses] = 0;
    stats[f.draws] = 0;
    stats[f.games] = 0;
    stats[f.streak] = 0;
    stats[f.bestStreak] = 0;
  }
  return stats;
}

export function extractPublicGameStats(u) {
  const out = {};
  for (const prefix of ARCADE_STAT_KEYS) {
    const f = statFields(prefix);
    out[f.wins] = Number(u[f.wins]) || 0;
    out[f.losses] = Number(u[f.losses]) || 0;
    out[f.draws] = Number(u[f.draws]) || 0;
    out[f.games] = Number(u[f.games]) || 0;
    out[f.streak] = Number(u[f.streak]) || 0;
    out[f.bestStreak] = Number(u[f.bestStreak]) || 0;
  }
  return out;
}