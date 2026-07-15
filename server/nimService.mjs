/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  buildLeaderboard,
  buildUserSlice,
  createMatchmaker,
  createPvpMatchFromQueue,
  joinMatchQueue,
  expireMatchWithRefund,
  forceExpireMatchesForUser,
  getMatchWithExpiry,
  leaveMatchQueue,
  MATCH_TIMEOUT_MS,
  newMatchId,
  settleMatch,
} from './gamesCore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { sweepExpiredInMap } from './gamesExpirySweep.mjs';

const mm = createMatchmaker();
const NIM_EXPIRE = { gameId: 'nim', chatLabel: 'Nim' };
const START_PILES = [3, 5, 7];

function parseMove(raw) {
  const parts = String(raw).split(':');
  if (parts.length !== 2) return null;
  const pile = Number(parts[0]);
  const take = Number(parts[1]);
  if (!Number.isInteger(pile) || !Number.isInteger(take) || take < 1) return null;
  return { pile, take };
}

function nimSum(piles) {
  return piles.reduce((a, b) => a ^ b, 0);
}

function botNimMove(piles, difficulty) {
  if (difficulty === 'easy' || Math.random() < 0.35) {
    const nonEmpty = piles.map((p, i) => ({ p, i })).filter((x) => x.p > 0);
    const pick = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
    const take = 1 + Math.floor(Math.random() * pick.p);
    return `${pick.i}:${take}`;
  }
  const total = nimSum(piles);
  if (total !== 0) {
    for (let i = 0; i < piles.length; i += 1) {
      const target = piles[i] ^ total;
      if (target < piles[i]) {
        return `${i}:${piles[i] - target}`;
      }
    }
  }
  const nonEmpty = piles.map((p, i) => ({ p, i })).filter((x) => x.p > 0);
  const pick = nonEmpty[0];
  return `${pick.i}:1`;
}

function publicMatch(m) {
  const playing = m.status === 'playing';
  return {
    id: m.id,
    game: 'nim',
    mode: m.mode,
    status: m.status,
    bet: m.bet,
    piles: [...m.piles],
    turn: m.turn,
    botDifficulty: m.botDifficulty ?? null,
    player1: { userId: m.player1.userId, username: m.player1.username, displayName: m.player1.displayName },
    player2: m.mode === 'bot'
      ? { bot: true }
      : { userId: m.player2.userId, username: m.player2.username, displayName: m.player2.displayName },
    result: m.result,
    streakBonus: m.streakBonus ?? 0,
    jackpotHit: m.jackpotHit ?? false,
    jackpotAmount: m.jackpotAmount ?? 0,
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    timeLeftMs: playing ? Math.max(0, m.expiresAt - Date.now()) : 0,
  };
}

function buildMatch(user, bet, mode, botDifficulty) {
  return {
    id: newMatchId(),
    game: 'nim',
    mode,
    status: 'playing',
    bet,
    piles: [...START_PILES],
    turn: 'p1',
    botDifficulty: ['easy', 'normal', 'hard'].includes(botDifficulty) ? botDifficulty : 'normal',
    player1: { userId: user.id, username: user.username, displayName: user.displayName },
    player2: mode === 'bot' ? { bot: true } : null,
    result: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + MATCH_TIMEOUT_MS,
  };
}

async function finalizeNim(m, winnerKey) {
  return settleMatch({
    match: m,
    statKey: 'Nim',
    gameId: 'nim',
    achievementFlag: 'nim_played',
    chatLabel: 'Nim',
    winnerKey,
    publicMatch,
    historyExtra: { piles: m.piles },
    activeMatches: mm.activeMatches,
  });
}

export async function joinNimQueue(userId, opts = {}) {
  return joinMatchQueue({
    mm,
    userId,
    bet: opts.bet,
    mode: opts.mode ?? 'pvp',
    botDifficulty: opts.botDifficulty,
    roomCode: opts.roomCode,
    createBotMatch: (user, bet, diff) => buildMatch(user, bet, 'bot', diff),
    createPvpMatch: (joinerId, hostId, bet) =>
      createPvpMatchFromQueue(joinerId, hostId, bet, mm, (p1, p2, b) => {
        const match = buildMatch(p1, b, 'pvp', 'normal');
        match.player2 = { userId: p2.id, username: p2.username, displayName: p2.displayName };
        return match;
      }, publicMatch, { gameId: 'nim', chatLabel: 'Nim' }),
    matchOptions: { publicMatch },
    expireMeta: { gameId: 'nim', chatLabel: 'Nim' },
  });
}

export const leaveNimQueue = (userId) =>
  leaveMatchQueue(mm, userId, { gameId: 'nim', chatLabel: 'Nim' });

export async function releaseNimUserSession(userId) {
  await forceExpireMatchesForUser(mm.activeMatches, userId, NIM_EXPIRE);
  await leaveNimQueue(userId);
}

export async function submitNimMove(userId, matchId, move) {
  const parsed = parseMove(move);
  if (!parsed) throw new Error('Invalid move');
  return runCoinTransaction(async () => {
  const m = mm.activeMatches.get(matchId);
  if (!m || m.status !== 'playing') throw new Error('Match not found');
  const { pile, take } = parsed;
  if (pile < 0 || pile >= m.piles.length || take > m.piles[pile] || take < 1) {
    throw new Error('Invalid move');
  }

  if (m.mode === 'bot') {
    if (m.player1.userId !== userId || m.turn !== 'p1') throw new Error('Not your turn');
    m.piles[pile] -= take;
    if (m.piles.every((p) => p === 0)) return finalizeNim(m, 'p1');
    if (Date.now() > m.expiresAt) {
      await expireMatchWithRefund(m, mm.activeMatches, { gameId: 'nim', chatLabel: 'Nim' });
      throw new Error('Match expired');
    }
    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
    const botRaw = botNimMove(m.piles, m.botDifficulty);
    const botParsed = parseMove(botRaw);
    if (!botParsed) throw new Error('Bot move failed');
    m.piles[botParsed.pile] -= botParsed.take;
    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
    if (m.piles.every((p) => p === 0)) return finalizeNim(m, 'p2');
    m.turn = 'p1';
    return { match: publicMatch(m) };
  }

  const isP1 = m.player1.userId === userId;
  const isP2 = m.player2.userId === userId;
  if (!isP1 && !isP2) throw new Error('Not your match');
  if ((isP1 && m.turn !== 'p1') || (isP2 && m.turn !== 'p2')) throw new Error('Not your turn');
  m.piles[pile] -= take;
  if (m.piles.every((p) => p === 0)) {
    return finalizeNim(m, isP1 ? 'p1' : 'p2');
  }
  if (Date.now() > m.expiresAt) {
    await expireMatchWithRefund(m, mm.activeMatches, { gameId: 'nim', chatLabel: 'Nim' });
    throw new Error('Match expired');
  }
  m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
  m.turn = m.turn === 'p1' ? 'p2' : 'p1';
  return { match: publicMatch(m) };
  });
}

export async function getNimMatch(matchId, userId) {
  return getMatchWithExpiry(mm.activeMatches, matchId, userId, { gameId: 'nim', chatLabel: 'Nim' }, publicMatch);
}

export const getNimUserSlice = buildUserSlice({
  statKey: 'Nim',
  queue: mm.queue,
  activeMatches: mm.activeMatches,
  publicMatch,
  expireMeta: { gameId: 'nim', chatLabel: 'Nim' },
  mm,
});

export const getNimLeaderboard = () => buildLeaderboard('Nim');

export async function sweepNimExpired() {
  return sweepExpiredInMap(mm, NIM_EXPIRE);
}