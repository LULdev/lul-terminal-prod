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

/**
 * @param {object} cfg
 * @param {string} cfg.gameId
 * @param {string} cfg.statKey
 * @param {string} cfg.achievementFlag
 * @param {string} cfg.chatLabel
 * @param {(move: string) => boolean} cfg.validateMove
 * @param {(m: object) => 'p1'|'p2'|'draw'} cfg.resolveWinner
 * @param {(playerMove: string|null, difficulty: string, m: object) => string} cfg.botMove
 */
export function createInstantDuelGame(cfg) {
  const mm = createMatchmaker();

  function buildBaseMatch(user, bet, mode, botDifficulty) {
    return {
      id: newMatchId(),
      game: cfg.gameId,
      mode,
      status: 'playing',
      bet,
      botDifficulty: ['easy', 'normal', 'hard'].includes(botDifficulty) ? botDifficulty : 'normal',
      player1: {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        move: null,
        submitted: false,
      },
      player2: mode === 'bot'
        ? { bot: true, move: null }
        : { userId: null, username: null, displayName: null, move: null, submitted: false },
      reveal: null,
      result: null,
      streakBonus: 0,
      jackpotHit: false,
      jackpotAmount: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + MATCH_TIMEOUT_MS,
    };
  }

  function publicMatch(m) {
    const playing = m.status === 'playing';
    const done = m.status === 'done';
    return {
      id: m.id,
      game: cfg.gameId,
      mode: m.mode,
      status: m.status,
      bet: m.bet,
      botDifficulty: m.botDifficulty ?? null,
      roomCode: m.roomCode ?? null,
      reveal: done ? (m.reveal ?? null) : null,
      player1: {
        userId: m.player1.userId,
        username: m.player1.username,
        displayName: m.player1.displayName,
        move: done ? m.player1.move : null,
        submitted: Boolean(m.player1.move),
      },
      player2: m.mode === 'bot'
        ? { bot: true, move: done ? m.player2.move : null }
        : {
            userId: m.player2.userId,
            username: m.player2.username,
            displayName: m.player2.displayName,
            move: done ? m.player2.move : null,
            submitted: Boolean(m.player2.move),
          },
      result: m.result,
      streakBonus: m.streakBonus ?? 0,
      jackpotHit: m.jackpotHit ?? false,
      jackpotAmount: m.jackpotAmount ?? 0,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
      timeLeftMs: playing ? Math.max(0, m.expiresAt - Date.now()) : 0,
    };
  }

  function createBotMatch(user, bet, botDifficulty) {
    return buildBaseMatch(user, bet, 'bot', botDifficulty);
  }

  async function finalizeIfReady(m) {
    const winnerKey = cfg.resolveWinner(m);
    return settleMatch({
      match: m,
      statKey: cfg.statKey,
      gameId: cfg.gameId,
      achievementFlag: cfg.achievementFlag,
      chatLabel: cfg.chatLabel,
      winnerKey,
      publicMatch,
      activeMatches: mm.activeMatches,
    });
  }

  const expireMeta = {
    gameId: cfg.gameId,
    chatLabel: cfg.chatLabel,
    finalizeDualSubmit: async (m) => {
      if (m.player1?.move && m.player2?.move) await finalizeIfReady(m);
    },
  };

  return {
    gameId: cfg.gameId,
    joinQueue: (userId, opts = {}) =>
      joinMatchQueue({
        mm,
        userId,
        bet: opts.bet,
        mode: opts.mode ?? 'pvp',
        botDifficulty: opts.botDifficulty,
        roomCode: opts.roomCode,
        createBotMatch,
        createPvpMatch: (joinerId, hostId, amount) =>
          createPvpMatchFromQueue(joinerId, hostId, amount, mm, (p1, p2, b) => {
            const match = buildBaseMatch(p1, b, 'pvp', 'normal');
            match.player2 = {
              userId: p2.id,
              username: p2.username,
              displayName: p2.displayName,
              move: null,
              submitted: false,
            };
            return match;
          }, publicMatch, { gameId: cfg.gameId, chatLabel: cfg.chatLabel }),
        matchOptions: { publicMatch },
        expireMeta,
      }),
    leaveQueue: (userId) => leaveMatchQueue(mm, userId, { gameId: cfg.gameId, chatLabel: cfg.chatLabel }),
    releaseUserSession: async (userId) => {
      await forceExpireMatchesForUser(mm.activeMatches, userId, expireMeta);
      await leaveMatchQueue(mm, userId, { gameId: cfg.gameId, chatLabel: cfg.chatLabel });
    },
    submitMove: async (userId, matchId, move) => {
      const raw = String(move ?? '').trim();
      if (!cfg.validateMove(raw)) throw new Error('Invalid move');
      return runCoinTransaction(async () => {
        const m = mm.activeMatches.get(matchId);
        if (!m || m.status !== 'playing') throw new Error('Match not found');

        if (m.mode === 'bot') {
          if (Date.now() > m.expiresAt) {
            await expireMatchWithRefund(m, mm.activeMatches, expireMeta);
            throw new Error('Match expired');
          }
          if (m.player1.userId !== userId) throw new Error('Not your match');
          if (m.player1.move) throw new Error('Move already submitted');
          m.player1.move = raw;
          m.player2.move = cfg.botMove(raw, m.botDifficulty, m);
          m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
          return finalizeIfReady(m);
        }

        const isP1 = m.player1.userId === userId;
        const isP2 = m.player2.userId === userId;
        if (!isP1 && !isP2) throw new Error('Not your match');
        const slot = isP1 ? m.player1 : m.player2;
        if (slot.move) throw new Error('Move already submitted');
        slot.move = raw;

        const bothReady = Boolean(m.player1.move && m.player2.move);
        if (Date.now() > m.expiresAt && !bothReady) {
          await expireMatchWithRefund(m, mm.activeMatches, expireMeta);
          throw new Error('Match expired');
        }
        if (!bothReady) m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;

        if (bothReady) return finalizeIfReady(m);
        return { match: publicMatch(m), waiting: true };
      });
    },
    getMatch: (matchId, userId) =>
      getMatchWithExpiry(mm.activeMatches, matchId, userId, expireMeta, publicMatch),
    getUserSlice: buildUserSlice({
      statKey: cfg.statKey,
      queue: mm.queue,
      activeMatches: mm.activeMatches,
      publicMatch,
      expireMeta,
      mm,
    }),
    getLeaderboard: () => buildLeaderboard(cfg.statKey),
    sweepExpired: () => sweepExpiredInMap(mm, expireMeta),
  };
}