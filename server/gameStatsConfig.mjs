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

function finiteNonNegInt(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function defaultGameStats(user, prefix) {
  const f = statFields(prefix);
  return {
    wins: finiteNonNegInt(user[f.wins]),
    losses: finiteNonNegInt(user[f.losses]),
    draws: finiteNonNegInt(user[f.draws]),
    games: finiteNonNegInt(user[f.games]),
    streak: finiteNonNegInt(user[f.streak]),
    bestStreak: finiteNonNegInt(user[f.bestStreak]),
    jackpotsWon: finiteNonNegInt(user.gameJackpotsWon),
    totalWon: finiteNonNegInt(user.gameTotalWon),
    totalLost: finiteNonNegInt(user.gameTotalLost),
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
    out[f.wins] = finiteNonNegInt(u[f.wins]);
    out[f.losses] = finiteNonNegInt(u[f.losses]);
    out[f.draws] = finiteNonNegInt(u[f.draws]);
    out[f.games] = finiteNonNegInt(u[f.games]);
    out[f.streak] = finiteNonNegInt(u[f.streak]);
    out[f.bestStreak] = finiteNonNegInt(u[f.bestStreak]);
  }
  return out;
}