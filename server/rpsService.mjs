/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { syncAchievementsOnLoadedUser } from './auth/authService.mjs';
import { postBotRpsJackpot, postBotRpsVictory } from './chatBot.mjs';
import {
  logDailyBonusCredit,
  logDrawRefund,
  logGameWinCredit,
  logJackpotCredit,
  logQueueRefund,
  logStreakCredit,
} from './coinLedger.mjs';
import {
  expireMatchWithRefund,
  findUserMatch,
  forceExpireMatchesForUser,
  getMatchWithExpiry,
  isRoomConsumed,
  queueStatusForUser,
  refundJoinEscrow,
  resolveActiveMatchForSlice,
  tombstoneRoom,
  sweepExpiredMatchesForUser,
  sweepStaleQueueEntries,
  touchQueueHeartbeat,
} from './gamesCore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { assertPvpPairReady } from './gamesSessionGuard.mjs';
import { addGameEscrow, releaseAnyGameEscrow, releaseGameEscrow } from './gamesEscrow.mjs';
import { sweepExpiredInMap } from './gamesExpirySweep.mjs';
import {
  addToJackpot,
  appendMatchHistory,
  BO3_WINS_NEEDED,
  DAILY_BONUS_COINS,
  DAILY_BONUS_COOLDOWN_MS,
  JACKPOT_CHANCE,
  MATCH_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
  payoutJackpot,
  STARTING_LULCOINS,
  STREAK_BONUS_CAP,
  STREAK_BONUS_RATE,
} from './gamesStore.mjs';

const MOVES = ['rock', 'paper', 'scissors'];
const MOVE_EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };

const queue = [];
const rooms = new Map();
const consumedRooms = new Map();
const activeMatches = new Map();

async function refundHostQueueEscrow(db, user, amount) {
  if (!user || !amount) return;
  const hostBet = amount;
  if (!releaseGameEscrow(user, { gameId: 'rps', amount: hostBet })) {
    if (!releaseAnyGameEscrow(user, hostBet)) return;
  }
  logQueueRefund(user, { gameId: 'rps', chatLabel: 'RPS', bet: hostBet, amount: hostBet });
  user.updatedAt = Date.now();
  await saveUsersDb(db);
}

async function leaveQueueEntry(db, user, userId, entry) {
  const idx = queue.findIndex((q) => q.userId === userId);
  if (idx < 0) return;
  if (user && entry?.bet) {
    const released = releaseGameEscrow(user, { gameId: 'rps', amount: entry.bet })
      || releaseAnyGameEscrow(user, entry.bet);
    if (!released) {
      throw new Error('Escrow mismatch — leave queue and re-join');
    }
    logQueueRefund(user, { gameId: 'rps', chatLabel: 'RPS', bet: entry.bet, amount: entry.bet });
    user.updatedAt = Date.now();
  }
  queue.splice(idx, 1);
  for (const [code, room] of rooms.entries()) {
    if (room.hostId === userId) rooms.delete(code);
  }
  await saveUsersDb(db);
}

function newMatchId() {
  return crypto.randomBytes(6).toString('hex');
}

function newRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export function normalizeBet(raw) {
  const n = Math.floor(Number(raw) || 0);
  return Math.min(MAX_BET, Math.max(MIN_BET, n));
}

function getUser(db, userId) {
  return db.users.find((u) => u.id === userId && u.role !== 'bot');
}

function ensureCoins(user) {
  if (user.lulCoins == null) user.lulCoins = STARTING_LULCOINS;
  user.lulCoins = Math.max(0, Number(user.lulCoins) || 0);
}

const RPS_ESCROW = { gameId: 'rps', chatLabel: 'RPS' };

async function finalizeDualSubmitRps(m) {
  if (!m.player1?.move || !m.player2?.move) return;
  if (m.seriesType === 'bo3') await processBo3Round(m);
  else await finalizeMatch(m);
}

const RPS_EXPIRE_META = {
  ...RPS_ESCROW,
  finalizeDualSubmit: finalizeDualSubmitRps,
};

function deductCoins(user, amount) {
  ensureCoins(user);
  if (user.lulCoins < amount) throw new Error('Not enough LULcoins');
  user.lulCoins -= amount;
  addGameEscrow(user, { ...RPS_ESCROW, amount });
}

function creditCoins(user, amount, ledgerFn, ledgerArgs) {
  if (ledgerFn && ledgerArgs) {
    if (ledgerFn === logQueueRefund) {
      if (!releaseGameEscrow(user, { gameId: ledgerArgs.gameId ?? 'rps', amount })) return;
    }
    ledgerFn(user, { ...ledgerArgs, amount });
    return;
  }
  ensureCoins(user);
  user.lulCoins += Math.max(0, Number(amount) || 0);
}

function resolveRps(a, b) {
  if (a === b) return 'draw';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  ) return 'p1';
  return 'p2';
}

function botPick(userMove, difficulty) {
  if (!userMove || !MOVES.includes(userMove)) {
    return MOVES[Math.floor(Math.random() * 3)];
  }
  const roll = Math.random();
  const beat = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
  const lose = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  if (difficulty === 'easy' && roll < 0.3) return lose[userMove];
  if (difficulty === 'hard' && roll < 0.38) return beat[userMove];
  return MOVES[Math.floor(Math.random() * 3)];
}

function emptyMoves() {
  return { rock: 0, paper: 0, scissors: 0 };
}

function trackUserMove(user, move) {
  if (!MOVES.includes(move)) return;
  if (!user.gameRpsMoves || typeof user.gameRpsMoves !== 'object') {
    user.gameRpsMoves = emptyMoves();
  }
  user.gameRpsMoves[move] = (Number(user.gameRpsMoves[move]) || 0) + 1;
}

function recordMatchMoves(db, m) {
  const p1 = getUser(db, m.player1.userId);
  if (p1 && m.player1.move) trackUserMove(p1, m.player1.move);
  if (m.mode !== 'bot') {
    const p2 = getUser(db, m.player2.userId);
    if (p2 && m.player2.move) trackUserMove(p2, m.player2.move);
  }
}

function calcStreakBonus(bet, streak) {
  const s = Math.max(0, Number(streak) || 0);
  if (s <= 1) return 0;
  const rate = Math.min(STREAK_BONUS_CAP, (s - 1) * STREAK_BONUS_RATE);
  return Math.floor(Math.max(0, Number(bet) || 0) * rate);
}

function aggregateGlobalMoves(users) {
  const totals = emptyMoves();
  for (const u of users) {
    const m = u.gameRpsMoves;
    if (!m || typeof m !== 'object') continue;
    totals.rock += Number(m.rock) || 0;
    totals.paper += Number(m.paper) || 0;
    totals.scissors += Number(m.scissors) || 0;
  }
  const total = totals.rock + totals.paper + totals.scissors;
  const favorite = total > 0
    ? Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0]
    : null;
  return { totals, total, favorite };
}

function bumpStats(user, result, wonJackpot = false) {
  user.gameRpsGames = (Number(user.gameRpsGames) || 0) + 1;
  if (result === 'win') {
    user.gameRpsWins = (Number(user.gameRpsWins) || 0) + 1;
    user.gameRpsStreak = (Number(user.gameRpsStreak) || 0) + 1;
    user.gameRpsBestStreak = Math.max(Number(user.gameRpsBestStreak) || 0, user.gameRpsStreak);
  } else if (result === 'loss') {
    user.gameRpsLosses = (Number(user.gameRpsLosses) || 0) + 1;
    user.gameRpsStreak = 0;
  } else {
    user.gameRpsDraws = (Number(user.gameRpsDraws) || 0) + 1;
  }
  if (wonJackpot) user.gameJackpotsWon = (Number(user.gameJackpotsWon) || 0) + 1;
}

function publicMatch(m) {
  const playing = m.status === 'playing';
  return {
    id: m.id,
    mode: m.mode,
    status: m.status,
    bet: m.bet,
    seriesType: m.seriesType ?? 'single',
    currentRound: m.currentRound ?? 1,
    score: m.score ?? { p1: 0, p2: 0 },
    rounds: m.rounds ?? [],
    roomCode: m.roomCode ?? null,
    botDifficulty: m.botDifficulty ?? null,
    player1: {
      userId: m.player1.userId,
      username: m.player1.username,
      displayName: m.player1.displayName,
      move: m.status === 'done' ? m.player1.move : null,
      submitted: Boolean(m.player1.move),
    },
    player2: m.mode === 'bot'
      ? { bot: true, move: m.status === 'done' ? m.player2.move : null }
      : {
          userId: m.player2.userId,
          username: m.player2.username,
          displayName: m.player2.displayName,
          move: m.status === 'done' ? m.player2.move : null,
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

async function processBo3Round(m) {
  const r = resolveRps(m.player1.move, m.player2.move);
  return runCoinTransaction(async () => {
    if (m.status !== 'playing') throw new Error('Match not found');
    m.rounds = m.rounds || [];
    m.rounds.push({
      round: m.currentRound ?? 1,
      p1Move: m.player1.move,
      p2Move: m.player2.move,
      winner: r === 'draw' ? 'draw' : r === 'p1' ? 'p1' : 'p2',
    });

    const db = await loadUsersDb();
    recordMatchMoves(db, m);
    await saveUsersDb(db);

    if (r === 'draw') {
      m.player1.move = null;
      m.player2.move = null;
      m.currentRound = (m.currentRound ?? 1) + 1;
      m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
      return { match: publicMatch(m), roundComplete: true };
    }

    m.score = m.score || { p1: 0, p2: 0 };
    if (r === 'p1') m.score.p1 += 1;
    else m.score.p2 += 1;

    if (m.score.p1 >= BO3_WINS_NEEDED || m.score.p2 >= BO3_WINS_NEEDED) {
      m.seriesWinner = m.score.p1 >= BO3_WINS_NEEDED ? 'p1' : 'p2';
      return finalizeMatch(m);
    }

    m.player1.move = null;
    m.player2.move = null;
    m.currentRound = (m.currentRound ?? 1) + 1;
    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
    return { match: publicMatch(m), roundComplete: true };
  });
}

async function finalizeMatch(m) {
  return runCoinTransaction(async () => {
  if (m.status === 'done') return { match: publicMatch(m) };

  const db = await loadUsersDb();
  const p1 = getUser(db, m.player1.userId);
  if (!p1) {
    await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
    return { match: publicMatch(m) };
  }

  const bet = m.bet;
  let outcome;
  let p1Delta = 0;
  let p2Delta = 0;
  let jackpotHit = false;
  let jackpotAmount = 0;
  let streakBonus = 0;

  const lastRound = m.rounds?.length ? m.rounds[m.rounds.length - 1] : null;
  const p1Move = m.player1.move ?? lastRound?.p1Move ?? null;
  const p2Move = m.player2.move ?? lastRound?.p2Move ?? null;

  let r;
  if (m.seriesType === 'bo3' && m.seriesWinner) {
    r = m.seriesWinner;
  } else {
    r = resolveRps(p1Move, p2Move);
  }

  if (m.seriesType !== 'bo3') {
    recordMatchMoves(db, m);
  }

  const ledgerCtx = { gameId: 'rps', chatLabel: 'RPS', matchId: m.id, bet };

  let p2 = null;
  if (m.mode === 'pvp') {
    p2 = getUser(db, m.player2.userId);
    if (!p2) {
      await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
      return { match: publicMatch(m) };
    }
  }
  if (!releaseGameEscrow(p1, { ...RPS_ESCROW, amount: bet })) {
    m.expiresAt = 0;
    await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
    return { match: publicMatch(m) };
  }
  if (m.mode === 'pvp' && p2) {
    if (!releaseGameEscrow(p2, { ...RPS_ESCROW, amount: bet })) {
      m._expireCreditUserIds = new Set([m.player1.userId]);
      m.expiresAt = 0;
      await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
      return { match: publicMatch(m) };
    }
  }

  if (m.mode === 'bot') {
    if (r === 'draw') {
      outcome = 'draw';
      creditCoins(p1, bet, logDrawRefund, ledgerCtx);
      bumpStats(p1, 'draw');
    } else if (r === 'p1') {
      outcome = 'win';
      p1Delta = bet * 2;
      creditCoins(p1, p1Delta, logGameWinCredit, { ...ledgerCtx, mode: 'bot' });
      p1.gameTotalWon = (Number(p1.gameTotalWon) || 0) + bet;
      bumpStats(p1, 'win');
      streakBonus = calcStreakBonus(bet, p1.gameRpsStreak);
      if (streakBonus > 0) {
        creditCoins(p1, streakBonus, logStreakCredit, ledgerCtx);
        p1.gameTotalWon = (Number(p1.gameTotalWon) || 0) + streakBonus;
      }
    } else {
      outcome = 'loss';
      await addToJackpot(bet);
      p1.gameTotalLost = (Number(p1.gameTotalLost) || 0) + bet;
      bumpStats(p1, 'loss');
    }
  } else {
    if (r === 'draw') {
      outcome = 'draw';
      creditCoins(p1, bet, logDrawRefund, ledgerCtx);
      creditCoins(p2, bet, logDrawRefund, ledgerCtx);
      bumpStats(p1, 'draw');
      bumpStats(p2, 'draw');
    } else {
      outcome = r === 'p1' ? 'win' : 'loss';
      const winner = r === 'p1' ? p1 : p2;
      const loser = r === 'p1' ? p2 : p1;
      const pot = bet * 2;
      creditCoins(winner, pot, logGameWinCredit, { ...ledgerCtx, mode: 'pvp' });
      winner.gameTotalWon = (Number(winner.gameTotalWon) || 0) + bet;
      loser.gameTotalLost = (Number(loser.gameTotalLost) || 0) + bet;
      bumpStats(winner, 'win');
      bumpStats(loser, 'loss');
      streakBonus = calcStreakBonus(bet, winner.gameRpsStreak);
      if (streakBonus > 0) {
        creditCoins(winner, streakBonus, logStreakCredit, ledgerCtx);
        winner.gameTotalWon = (Number(winner.gameTotalWon) || 0) + streakBonus;
      }

      if (Math.random() < JACKPOT_CHANCE) {
        jackpotHit = true;
        jackpotAmount = await payoutJackpot(winner.username);
        creditCoins(winner, jackpotAmount, logJackpotCredit, ledgerCtx);
        winner.gameJackpotsWon = (Number(winner.gameJackpotsWon) || 0) + 1;
        postBotRpsJackpot({ username: winner.username, amount: jackpotAmount }).catch(() => {});
      }

      postBotRpsVictory({
        winner: winner.username,
        loser: loser.username,
        wager: bet,
        jackpotHit,
      }).catch(() => {});
    }
  }

  p1.updatedAt = Date.now();
  if (m.mode === 'pvp') {
    const p2 = getUser(db, m.player2.userId);
    if (p2) {
      p2.updatedAt = Date.now();
      await syncAchievementsOnLoadedUser(p2, db, { flag: 'rps_played' });
    }
  }

  const unlocks = await syncAchievementsOnLoadedUser(p1, db, { flag: 'rps_played' });
  await saveUsersDb(db);

  m.status = 'done';
  m.result = {
    outcome,
    winner: r,
    p1Move,
    p2Move,
    p1Delta,
    p2Delta,
    seriesScore: m.score ?? null,
  };
  m.streakBonus = streakBonus;
  m.jackpotHit = jackpotHit;
  m.jackpotAmount = jackpotAmount;
  m.doneAt = Date.now();

  await appendMatchHistory({
    id: m.id,
    game: 'rps',
    mode: m.mode,
    seriesType: m.seriesType ?? 'single',
    bet,
    at: Date.now(),
    player1: m.player1.username,
    player2: m.mode === 'bot' ? 'BOT' : m.player2.username,
    p1Move,
    p2Move,
    outcome,
    streakBonus,
    score: m.score ?? null,
    jackpotHit,
    jackpotAmount,
  });

  return { match: publicMatch(m), unlocks };
  });
}

export async function getRpsUserSlice(userId) {
  const db = await loadUsersDb();
  const user = userId ? getUser(db, userId) : null;

  if (userId && queue.some((q) => q.userId === userId)) {
    await sweepStaleQueueEntries({ queue, rooms }, { gameId: 'rps', chatLabel: 'RPS' });
  }
  touchQueueHeartbeat(queue, userId);
  await sweepExpiredMatchesForUser(activeMatches, userId, RPS_EXPIRE_META);

  return {
    queueSize: queue.length,
    ...queueStatusForUser(queue, userId),
    myStats: user
      ? {
          wins: user.gameRpsWins ?? 0,
          losses: user.gameRpsLosses ?? 0,
          draws: user.gameRpsDraws ?? 0,
          games: user.gameRpsGames ?? 0,
          streak: user.gameRpsStreak ?? 0,
          bestStreak: user.gameRpsBestStreak ?? 0,
          jackpotsWon: user.gameJackpotsWon ?? 0,
          totalWon: user.gameTotalWon ?? 0,
          totalLost: user.gameTotalLost ?? 0,
          moves: user.gameRpsMoves ?? emptyMoves(),
          nextStreakBonus: calcStreakBonus(
            MIN_BET,
            (Number(user.gameRpsStreak) || 0) + 1,
          ),
        }
      : null,
    globalMoves: aggregateGlobalMoves(db.users),
    activeMatch: resolveActiveMatchForSlice({ queue, activeMatches, userId, publicMatch }),
  };
}

export function getDailyBonusStatus(user) {
  const now = Date.now();
  const last = Number(user?.gameLastDailyBonus) || 0;
  const canClaim = !last || now - last >= DAILY_BONUS_COOLDOWN_MS;
  const remainingMs = canClaim ? 0 : Math.max(0, DAILY_BONUS_COOLDOWN_MS - (now - last));
  const nextClaimAt = canClaim ? null : last + DAILY_BONUS_COOLDOWN_MS;
  return {
    canClaim,
    remainingMs,
    nextClaimAt,
    lastClaimAt: last || null,
  };
}

function formatCooldownRemaining(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export async function claimDailyBonus(userId) {
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = getUser(db, userId);
    if (!user) throw new Error('User not found');
    ensureCoins(user);
    const now = Date.now();
    const status = getDailyBonusStatus(user);
    if (!status.canClaim) {
      throw new Error(`Daily bonus reloads in ${formatCooldownRemaining(status.remainingMs)}`);
    }
    user.gameLastDailyBonus = now;
    logDailyBonusCredit(user, DAILY_BONUS_COINS);
    user.updatedAt = now;
    await saveUsersDb(db);
    const next = getDailyBonusStatus(user);
    return {
      coins: user.lulCoins,
      bonus: DAILY_BONUS_COINS,
      nextClaimAt: next.nextClaimAt,
      remainingMs: next.remainingMs,
      canClaim: next.canClaim,
    };
  });
}

export async function joinQueue(userId, opts = {}) {
  return runCoinTransaction(() => joinQueueInner(userId, opts));
}

async function joinQueueInner(userId, { bet, mode = 'pvp', botDifficulty = 'normal', roomCode, seriesType } = {}) {
  const db = await loadUsersDb();
  const user = getUser(db, userId);
  if (!user) throw new Error('User not found');
  const amount = normalizeBet(bet);
  const series = seriesType === 'bo3' ? 'bo3' : 'single';
  ensureCoins(user);

  await sweepExpiredMatchesForUser(activeMatches, userId, RPS_EXPIRE_META);

  const existing = [...activeMatches.values()].find(
    (m) => m.status !== 'done' && (m.player1.userId === userId || m.player2?.userId === userId),
  );
  if (existing) return { match: publicMatch(existing) };

  const queued = queue.find((q) => q.userId === userId);
  if (queued && mode === 'bot') {
    await leaveQueueEntry(db, user, userId, queued);
  } else if (queued) {
    const code = roomCode ? String(roomCode).trim().toUpperCase() : undefined;
    const sameBet = queued.bet === amount;
    const sameRoom = (queued.roomCode ?? undefined) === code;
    const sameSeries = (queued.seriesType ?? 'single') === series;
    if (sameBet && sameRoom && sameSeries) {
      queued.at = Date.now();
      return { waiting: true, bet: queued.bet, roomCode: queued.roomCode ?? undefined };
    }
    if (queued.bet !== amount) {
      const released = releaseGameEscrow(user, { gameId: 'rps', amount: queued.bet })
        || releaseAnyGameEscrow(user, queued.bet);
      if (!released) {
        throw new Error('Escrow mismatch — leave queue and re-join');
      }
      logQueueRefund(user, { gameId: 'rps', chatLabel: 'RPS', bet: queued.bet, amount: queued.bet });
      deductCoins(user, amount);
    }
    queued.bet = amount;
    queued.seriesType = series;
    for (const [c, room] of rooms.entries()) {
      if (room.hostId === userId) rooms.delete(c);
    }
    if (code) {
      queued.roomCode = code;
      rooms.set(code, { code, hostId: userId, bet: amount, seriesType: series, createdAt: Date.now() });
    } else {
      delete queued.roomCode;
    }
    queued.at = Date.now();
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return { waiting: true, bet: amount, roomCode: queued.roomCode ?? undefined };
  }

  if (mode === 'bot') {
    deductCoins(user, amount);
    user.updatedAt = Date.now();
    await saveUsersDb(db);

    const id = newMatchId();
    const match = {
      id,
      mode: 'bot',
      status: 'playing',
      bet: amount,
      seriesType: series,
      currentRound: 1,
      score: { p1: 0, p2: 0 },
      rounds: [],
      botDifficulty: ['easy', 'normal', 'hard'].includes(botDifficulty) ? botDifficulty : 'normal',
      player1: {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        move: null,
      },
      player2: { bot: true, move: null },
      result: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + MATCH_TIMEOUT_MS,
    };
    activeMatches.set(id, match);
    return { match: publicMatch(match) };
  }

  if (roomCode) {
    const code = String(roomCode).trim().toUpperCase();
    if (isRoomConsumed(consumedRooms, code)) throw new Error('Room already filled');
    let room = rooms.get(code);
    if (!room) {
      consumedRooms.delete(code);
      deductCoins(user, amount);
      user.updatedAt = Date.now();
      await saveUsersDb(db);
      room = { code, hostId: userId, bet: amount, seriesType: series, createdAt: Date.now() };
      rooms.set(code, room);
      queue.push({ userId, bet: amount, roomCode: code, seriesType: series, at: Date.now() });
      return { waiting: true, roomCode: code };
    }
    if ((room.seriesType ?? 'single') !== series) throw new Error('Room series mode mismatch');
    if (room.hostId === userId) throw new Error('Cannot join your own room');
    if (room.bet !== amount) throw new Error(`Room bet is ${room.bet} LULcoins`);
    deductCoins(user, amount);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    const hostIdx = queue.findIndex((q) => q.userId === room.hostId && q.roomCode === code);
    if (hostIdx >= 0) queue.splice(hostIdx, 1);
    rooms.delete(code);
    try {
      await assertPvpPairReady(room.hostId, user.id, 'rps');
      const result = await createPvpMatch(user.id, room.hostId, amount, series);
      tombstoneRoom(consumedRooms, code);
      return result;
    } catch (e) {
      const hostUser = getUser(db, room.hostId);
      await refundHostQueueEscrow(db, hostUser, room.bet);
      await refundJoinEscrow(db, user, amount, RPS_EXPIRE_META);
      throw e;
    }
  }

  deductCoins(user, amount);
  user.updatedAt = Date.now();
  await saveUsersDb(db);

  const racedMatch = [...activeMatches.values()].find(
    (m) => m.status !== 'done' && (m.player1.userId === userId || m.player2?.userId === userId),
  );
  if (racedMatch) {
    await refundJoinEscrow(db, user, amount, RPS_EXPIRE_META);
    return { match: publicMatch(racedMatch) };
  }

  const racedQueue = queue.find((q) => q.userId === userId);
  if (racedQueue) {
    await refundJoinEscrow(db, user, amount, RPS_EXPIRE_META);
    return { waiting: true, bet: racedQueue.bet, roomCode: racedQueue.roomCode ?? undefined };
  }

  const opponent = queue.find((q) => q.userId !== userId && q.bet === amount && !q.roomCode && (q.seriesType ?? 'single') === series);
  if (opponent) {
    queue.splice(queue.indexOf(opponent), 1);
    try {
      await assertPvpPairReady(opponent.userId, user.id, 'rps');
      return await createPvpMatch(user.id, opponent.userId, amount, series);
    } catch (e) {
      const oppUser = getUser(db, opponent.userId);
      await refundHostQueueEscrow(db, oppUser, opponent.bet);
      await refundJoinEscrow(db, user, amount, RPS_EXPIRE_META);
      throw e;
    }
  }

  if (queue.some((q) => q.userId === userId)) {
    await refundJoinEscrow(db, user, amount, RPS_EXPIRE_META);
    const q = queue.find((entry) => entry.userId === userId);
    return { waiting: true, bet: q?.bet ?? amount, roomCode: q?.roomCode ?? undefined };
  }

  queue.push({ userId, bet: amount, seriesType: series, at: Date.now() });
  return { waiting: true, bet: amount };
}

async function createPvpMatch(joinerId, hostId, bet, seriesType = 'single') {
  await assertPvpPairReady(hostId, joinerId, 'rps');
  const db = await loadUsersDb();
  const p1 = getUser(db, hostId);
  const p2 = getUser(db, joinerId);
  if (!p1 || !p2) throw new Error('Player not found');

  const id = newMatchId();
  const match = {
    id,
    mode: 'pvp',
    status: 'playing',
    bet,
    seriesType,
    currentRound: 1,
    score: { p1: 0, p2: 0 },
    rounds: [],
    player1: { userId: p1.id, username: p1.username, displayName: p1.displayName, move: null },
    player2: { userId: p2.id, username: p2.username, displayName: p2.displayName, move: null },
    result: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + MATCH_TIMEOUT_MS,
  };
  activeMatches.set(id, match);
  return { match: publicMatch(match) };
}

export async function leaveRpsQueue(userId) {
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = getUser(db, userId);
    let refunded = 0;
    while (true) {
      const idx = queue.findIndex((q) => q.userId === userId);
      if (idx < 0) break;
      const entry = queue[idx];
      if (user && entry?.bet) {
        const released = releaseGameEscrow(user, { gameId: 'rps', amount: entry.bet })
          || releaseAnyGameEscrow(user, entry.bet);
        if (!released) {
          throw new Error('Escrow mismatch — cannot leave queue');
        }
        logQueueRefund(user, { gameId: 'rps', chatLabel: 'RPS', bet: entry.bet, amount: entry.bet });
        refunded += entry.bet;
        user.updatedAt = Date.now();
      }
      queue.splice(idx, 1);
    }
    for (const [code, room] of rooms.entries()) {
      if (room.hostId === userId) rooms.delete(code);
    }
    if (user && refunded > 0) await saveUsersDb(db);
    return { ok: true };
  });
}

export const leaveQueue = leaveRpsQueue;

export async function releaseRpsUserSession(userId) {
  await forceExpireMatchesForUser(activeMatches, userId, RPS_EXPIRE_META);
  await leaveRpsQueue(userId);
}

export async function submitMove(userId, matchId, move) {
  if (!MOVES.includes(move)) throw new Error('Invalid move');
  return runCoinTransaction(async () => {
    const m = activeMatches.get(matchId);
    if (!m || m.status !== 'playing') throw new Error('Match not found');

    if (m.mode === 'bot') {
      if (Date.now() > m.expiresAt) {
        await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
        throw new Error('Match expired');
      }
      if (m.player1.userId !== userId) throw new Error('Not your match');
      if (m.player1.move) throw new Error('Move already submitted');
      m.player1.move = move;
      m.player2.move = botPick(move, m.botDifficulty);
      if (m.seriesType === 'bo3') return processBo3Round(m);
      return finalizeMatch(m);
    }

    const isP1 = m.player1.userId === userId;
    const isP2 = m.player2.userId === userId;
    if (!isP1 && !isP2) throw new Error('Not your match');

    const slot = isP1 ? m.player1 : m.player2;
    if (slot.move) throw new Error('Move already submitted');
    slot.move = move;

    const bothReady = Boolean(m.player1.move && m.player2.move);
    if (Date.now() > m.expiresAt && !bothReady) {
      await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
      throw new Error('Match expired');
    }

    if (bothReady) {
      if (m.seriesType === 'bo3') return processBo3Round(m);
      return finalizeMatch(m);
    }

    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
    return { match: publicMatch(m), waiting: true };
  });
}

export async function getMatch(matchId, userId) {
  return getMatchWithExpiry(activeMatches, matchId, userId, RPS_EXPIRE_META, publicMatch);
}

export async function sweepRpsExpired() {
  return sweepExpiredInMap({ activeMatches, queue, rooms }, RPS_EXPIRE_META);
}

export async function getRpsLeaderboard() {
  const db = await loadUsersDb();
  const { normalizeProfileCustomization } = await import('./profileCustomization.mjs');
  const users = db.users.filter((u) => {
    if (u.role === 'bot' || u.active === false) return false;
    const privacy = normalizeProfileCustomization(u.profileCustomization).privacy;
    return privacy.showActivityStats !== false;
  });

  const top = (field, limit = 10) =>
    [...users]
      .sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0))
      .slice(0, limit)
      .map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        value: Number(u[field]) || 0,
      }));

  return {
    wins: top('gameRpsWins'),
    losses: top('gameRpsLosses'),
    games: top('gameRpsGames'),
    streaks: top('gameRpsBestStreak'),
  };
}

export { MOVE_EMOJI, MOVES };