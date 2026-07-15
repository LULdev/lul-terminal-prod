/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { syncAchievementsOnLoadedUser } from './auth/authService.mjs';
import { postBotArcadeJackpot, postBotTttVictory } from './chatBot.mjs';
import {
  logDrawRefund,
  logGameWinCredit,
  logJackpotCredit,
  logQueueRefund,
  logStreakCredit,
} from './coinLedger.mjs';
import {
  expireMatchWithRefund,
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
import {
  addGameEscrow,
  releaseAnyGameEscrow,
  releaseGameEscrow,
} from './gamesEscrow.mjs';
import { sweepExpiredInMap } from './gamesExpirySweep.mjs';
import {
  addToJackpot,
  appendMatchHistory,
  JACKPOT_CHANCE,
  MATCH_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
  payoutJackpot,
  STARTING_LULCOINS,
  STREAK_BONUS_CAP,
  STREAK_BONUS_RATE,
} from './gamesStore.mjs';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const queue = [];
const rooms = new Map();
const consumedRooms = new Map();
const activeMatches = new Map();

const TTT_EXPIRE_META = { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe' };

async function refundHostQueueEscrow(db, user, amount) {
  if (!user || !amount) return;
  const hostBet = amount;
  if (!releaseGameEscrow(user, { gameId: 'ttt', amount: hostBet })) {
    if (!releaseAnyGameEscrow(user, hostBet)) return;
  }
  logQueueRefund(user, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe', bet: hostBet, amount: hostBet });
  user.updatedAt = Date.now();
  await saveUsersDb(db);
}

async function leaveQueueEntry(db, user, userId, entry) {
  const idx = queue.findIndex((q) => q.userId === userId);
  if (idx < 0) return;
  if (user && entry?.bet) {
    const released = releaseGameEscrow(user, { gameId: 'ttt', amount: entry.bet })
      || releaseAnyGameEscrow(user, entry.bet);
    if (!released) {
      throw new Error('Escrow mismatch — leave queue and re-join');
    }
    logQueueRefund(user, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe', bet: entry.bet, amount: entry.bet });
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

function emptyBoard() {
  return Array(9).fill(null);
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

const TTT_ESCROW = { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe' };

function deductCoins(user, amount) {
  ensureCoins(user);
  if (user.lulCoins < amount) throw new Error('Not enough LULcoins');
  user.lulCoins -= amount;
  addGameEscrow(user, { ...TTT_ESCROW, amount });
}

function creditCoins(user, amount, ledgerFn, ledgerArgs) {
  if (ledgerFn && ledgerArgs) {
    if (ledgerFn === logQueueRefund) {
      if (!releaseGameEscrow(user, { gameId: ledgerArgs.gameId ?? 'ttt', amount })) return;
    }
    ledgerFn(user, { ...ledgerArgs, amount });
    return;
  }
  ensureCoins(user);
  user.lulCoins += Math.max(0, Number(amount) || 0);
}

function checkBoardState(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a] === 'X' ? 'p1' : 'p2', line };
    }
  }
  if (board.every((c) => c !== null)) return { winner: 'draw', line: null };
  return null;
}

function calcStreakBonus(bet, streak) {
  const s = Math.max(0, Number(streak) || 0);
  if (s <= 1) return 0;
  const rate = Math.min(STREAK_BONUS_CAP, (s - 1) * STREAK_BONUS_RATE);
  return Math.floor(Math.max(0, Number(bet) || 0) * rate);
}

function bumpStats(user, result, wonJackpot = false) {
  user.gameTttGames = (Number(user.gameTttGames) || 0) + 1;
  if (result === 'win') {
    user.gameTttWins = (Number(user.gameTttWins) || 0) + 1;
    user.gameTttStreak = (Number(user.gameTttStreak) || 0) + 1;
    user.gameTttBestStreak = Math.max(Number(user.gameTttBestStreak) || 0, user.gameTttStreak);
  } else if (result === 'loss') {
    user.gameTttLosses = (Number(user.gameTttLosses) || 0) + 1;
    user.gameTttStreak = 0;
  } else {
    user.gameTttDraws = (Number(user.gameTttDraws) || 0) + 1;
  }
  if (wonJackpot) user.gameJackpotsWon = (Number(user.gameJackpotsWon) || 0) + 1;
}

function minimax(board, isMaximizing) {
  const state = checkBoardState(board);
  if (state?.winner === 'p2') return 1;
  if (state?.winner === 'p1') return -1;
  if (state?.winner === 'draw') return 0;

  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of empty) {
      board[idx] = 'O';
      best = Math.max(best, minimax(board, false));
      board[idx] = null;
    }
    return best;
  }
  let best = Infinity;
  for (const idx of empty) {
    board[idx] = 'X';
    best = Math.min(best, minimax(board, true));
    board[idx] = null;
  }
  return best;
}

function tryWinningMove(board, mark) {
  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  const winnerKey = mark === 'X' ? 'p1' : 'p2';
  for (const idx of empty) {
    const next = [...board];
    next[idx] = mark;
    const state = checkBoardState(next);
    if (state?.winner === winnerKey) return idx;
  }
  return null;
}

function botPick(board, difficulty) {
  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  if (!empty.length) return null;

  if (difficulty === 'easy') {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  if (difficulty === 'normal' && Math.random() < 0.4) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  const win = tryWinningMove(board, 'O');
  if (win != null) return win;
  const block = tryWinningMove(board, 'X');
  if (block != null) return block;
  if (board[4] === null) return 4;

  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

  if (difficulty === 'hard') {
    let bestScore = -Infinity;
    let bestMove = empty[0];
    for (const idx of empty) {
      board[idx] = 'O';
      const score = minimax(board, false);
      board[idx] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = idx;
      }
    }
    return bestMove;
  }

  return empty[Math.floor(Math.random() * empty.length)];
}

function publicMatch(m) {
  const playing = m.status === 'playing';
  const done = m.status === 'done';
  return {
    id: m.id,
    game: 'ttt',
    mode: m.mode,
    status: m.status,
    bet: m.bet,
    board: [...m.board],
    turn: m.turn,
    winningLine: done ? (m.winningLine ?? null) : null,
    roomCode: m.roomCode ?? null,
    botDifficulty: m.botDifficulty ?? null,
    player1: {
      userId: m.player1.userId,
      username: m.player1.username,
      displayName: m.player1.displayName,
      mark: 'X',
    },
    player2: m.mode === 'bot'
      ? { bot: true, mark: 'O' }
      : {
          userId: m.player2.userId,
          username: m.player2.username,
          displayName: m.player2.displayName,
          mark: 'O',
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

async function finalizeMatch(m, boardState) {
  return runCoinTransaction(async () => {
  if (m.status === 'done') return { match: publicMatch(m) };

  const db = await loadUsersDb();
  const p1 = getUser(db, m.player1.userId);
  if (!p1) {
    await expireMatchWithRefund(m, activeMatches, TTT_ESCROW);
    return { match: publicMatch(m) };
  }

  const bet = m.bet;
  let outcome;
  let p1Delta = 0;
  let p2Delta = 0;
  let jackpotHit = false;
  let jackpotAmount = 0;
  let streakBonus = 0;

  const r = boardState.winner;
  m.winningLine = boardState.line;

  const ledgerCtx = { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe', matchId: m.id, bet };

  let p2 = null;
  if (m.mode === 'pvp') {
    p2 = getUser(db, m.player2.userId);
    if (!p2) {
      await expireMatchWithRefund(m, activeMatches, TTT_ESCROW);
      return { match: publicMatch(m) };
    }
  }
  if (!releaseGameEscrow(p1, { ...TTT_ESCROW, amount: bet })) {
    m.expiresAt = 0;
    await expireMatchWithRefund(m, activeMatches, TTT_ESCROW);
    return { match: publicMatch(m) };
  }
  if (m.mode === 'pvp' && p2) {
    if (!releaseGameEscrow(p2, { ...TTT_ESCROW, amount: bet })) {
      m._expireCreditUserIds = new Set([m.player1.userId]);
      m.expiresAt = 0;
      await expireMatchWithRefund(m, activeMatches, TTT_ESCROW);
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
      streakBonus = calcStreakBonus(bet, p1.gameTttStreak);
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
      streakBonus = calcStreakBonus(bet, winner.gameTttStreak);
      if (streakBonus > 0) {
        creditCoins(winner, streakBonus, logStreakCredit, ledgerCtx);
        winner.gameTotalWon = (Number(winner.gameTotalWon) || 0) + streakBonus;
      }

      if (Math.random() < JACKPOT_CHANCE) {
        jackpotHit = true;
        jackpotAmount = await payoutJackpot(winner.username);
        creditCoins(winner, jackpotAmount, logJackpotCredit, ledgerCtx);
        winner.gameJackpotsWon = (Number(winner.gameJackpotsWon) || 0) + 1;
        postBotArcadeJackpot({ username: winner.username, amount: jackpotAmount }).catch(() => {});
      }

      postBotTttVictory({
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
      await syncAchievementsOnLoadedUser(p2, db, { flag: 'ttt_played' });
    }
  }

  const unlocks = await syncAchievementsOnLoadedUser(p1, db, { flag: 'ttt_played' });
  await saveUsersDb(db);

  m.status = 'done';
  m.result = {
    outcome,
    winner: r,
    p1Delta,
    p2Delta,
  };
  m.streakBonus = streakBonus;
  m.jackpotHit = jackpotHit;
  m.jackpotAmount = jackpotAmount;
  m.doneAt = Date.now();

  await appendMatchHistory({
    id: m.id,
    game: 'ttt',
    mode: m.mode,
    bet,
    at: Date.now(),
    player1: m.player1.username,
    player2: m.mode === 'bot' ? 'BOT' : m.player2.username,
    outcome,
    board: [...m.board],
    winningLine: m.winningLine,
    streakBonus,
    jackpotHit,
    jackpotAmount,
  });

  return { match: publicMatch(m), unlocks };
  });
}

export async function getTttUserSlice(userId) {
  const db = await loadUsersDb();
  const user = userId ? getUser(db, userId) : null;

  if (userId && queue.some((q) => q.userId === userId)) {
    await sweepStaleQueueEntries({ queue, rooms }, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe' });
  }
  touchQueueHeartbeat(queue, userId);
  await sweepExpiredMatchesForUser(activeMatches, userId, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe' });

  return {
    queueSize: queue.length,
    ...queueStatusForUser(queue, userId),
    myStats: user
      ? {
          wins: user.gameTttWins ?? 0,
          losses: user.gameTttLosses ?? 0,
          draws: user.gameTttDraws ?? 0,
          games: user.gameTttGames ?? 0,
          streak: user.gameTttStreak ?? 0,
          bestStreak: user.gameTttBestStreak ?? 0,
          jackpotsWon: user.gameJackpotsWon ?? 0,
          totalWon: user.gameTotalWon ?? 0,
          totalLost: user.gameTotalLost ?? 0,
          nextStreakBonus: calcStreakBonus(
            MIN_BET,
            (Number(user.gameTttStreak) || 0) + 1,
          ),
        }
      : null,
    activeMatch: resolveActiveMatchForSlice({ queue, activeMatches, userId, publicMatch }),
  };
}

export async function joinTttQueue(userId, opts = {}) {
  return runCoinTransaction(() => joinTttQueueInner(userId, opts));
}

async function joinTttQueueInner(userId, { bet, mode = 'pvp', botDifficulty = 'normal', roomCode } = {}) {
  const db = await loadUsersDb();
  const user = getUser(db, userId);
  if (!user) throw new Error('User not found');
  const amount = normalizeBet(bet);
  ensureCoins(user);

  await sweepExpiredMatchesForUser(activeMatches, userId, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe' });

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
    if (sameBet && sameRoom) {
      queued.at = Date.now();
      return { waiting: true, bet: queued.bet, roomCode: queued.roomCode ?? undefined };
    }
    if (queued.bet !== amount) {
      const released = releaseGameEscrow(user, { gameId: 'ttt', amount: queued.bet })
        || releaseAnyGameEscrow(user, queued.bet);
      if (!released) {
        throw new Error('Escrow mismatch — leave queue and re-join');
      }
      logQueueRefund(user, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe', bet: queued.bet, amount: queued.bet });
      deductCoins(user, amount);
    }
    queued.bet = amount;
    for (const [c, room] of rooms.entries()) {
      if (room.hostId === userId) rooms.delete(c);
    }
    if (code) {
      queued.roomCode = code;
      rooms.set(code, { code, hostId: userId, bet: amount, createdAt: Date.now() });
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
      board: emptyBoard(),
      turn: 'p1',
      botDifficulty: ['easy', 'normal', 'hard'].includes(botDifficulty) ? botDifficulty : 'normal',
      player1: {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
      },
      player2: { bot: true },
      result: null,
      winningLine: null,
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
      room = { code, hostId: userId, bet: amount, createdAt: Date.now() };
      rooms.set(code, room);
      queue.push({ userId, bet: amount, roomCode: code, at: Date.now() });
      return { waiting: true, roomCode: code };
    }
    if (room.hostId === userId) throw new Error('Cannot join your own room');
    if (room.bet !== amount) throw new Error(`Room bet is ${room.bet} LULcoins`);
    deductCoins(user, amount);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    const hostIdx = queue.findIndex((q) => q.userId === room.hostId && q.roomCode === code);
    if (hostIdx >= 0) queue.splice(hostIdx, 1);
    rooms.delete(code);
    try {
      await assertPvpPairReady(room.hostId, user.id, 'ttt');
      const result = await createPvpMatch(user.id, room.hostId, amount);
      tombstoneRoom(consumedRooms, code);
      return result;
    } catch (e) {
      const hostUser = getUser(db, room.hostId);
      await refundHostQueueEscrow(db, hostUser, room.bet);
      await refundJoinEscrow(db, user, amount, TTT_EXPIRE_META);
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
    await refundJoinEscrow(db, user, amount, TTT_EXPIRE_META);
    return { match: publicMatch(racedMatch) };
  }

  const racedQueue = queue.find((q) => q.userId === userId);
  if (racedQueue) {
    await refundJoinEscrow(db, user, amount, TTT_EXPIRE_META);
    return { waiting: true, bet: racedQueue.bet, roomCode: racedQueue.roomCode ?? undefined };
  }

  const opponent = queue.find((q) => q.userId !== userId && q.bet === amount && !q.roomCode);
  if (opponent) {
    queue.splice(queue.indexOf(opponent), 1);
    try {
      await assertPvpPairReady(opponent.userId, user.id, 'ttt');
      return await createPvpMatch(user.id, opponent.userId, amount);
    } catch (e) {
      const oppUser = getUser(db, opponent.userId);
      await refundHostQueueEscrow(db, oppUser, opponent.bet);
      await refundJoinEscrow(db, user, amount, TTT_EXPIRE_META);
      throw e;
    }
  }

  if (queue.some((q) => q.userId === userId)) {
    await refundJoinEscrow(db, user, amount, TTT_EXPIRE_META);
    const q = queue.find((entry) => entry.userId === userId);
    return { waiting: true, bet: q?.bet ?? amount, roomCode: q?.roomCode ?? undefined };
  }

  queue.push({ userId, bet: amount, at: Date.now() });
  return { waiting: true, bet: amount };
}

async function createPvpMatch(joinerId, hostId, bet) {
  await assertPvpPairReady(hostId, joinerId, 'ttt');
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
    board: emptyBoard(),
    turn: 'p1',
    player1: { userId: p1.id, username: p1.username, displayName: p1.displayName },
    player2: { userId: p2.id, username: p2.username, displayName: p2.displayName },
    result: null,
    winningLine: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + MATCH_TIMEOUT_MS,
  };
  activeMatches.set(id, match);
  return { match: publicMatch(match) };
}

export async function leaveTttQueue(userId) {
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = getUser(db, userId);
    let refunded = 0;
    while (true) {
      const idx = queue.findIndex((q) => q.userId === userId);
      if (idx < 0) break;
      const entry = queue[idx];
      if (user && entry?.bet) {
        const released = releaseGameEscrow(user, { gameId: 'ttt', amount: entry.bet })
          || releaseAnyGameEscrow(user, entry.bet);
        if (!released) {
          throw new Error('Escrow mismatch — cannot leave queue');
        }
        logQueueRefund(user, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe', bet: entry.bet, amount: entry.bet });
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

export async function releaseTttUserSession(userId) {
  await forceExpireMatchesForUser(activeMatches, userId, TTT_ESCROW);
  await leaveTttQueue(userId);
}

export async function submitTttMove(userId, matchId, cell) {
  const idx = Math.floor(Number(cell));
  if (idx < 0 || idx > 8) throw new Error('Invalid cell');

  return runCoinTransaction(async () => {
  const m = activeMatches.get(matchId);
  if (!m || m.status !== 'playing') throw new Error('Match not found');

  if (m.mode === 'bot') {
    if (m.player1.userId !== userId) throw new Error('Not your match');
    if (m.turn !== 'p1') throw new Error('Not your turn');
    if (m.board[idx] !== null) throw new Error('Cell taken');
    m.board[idx] = 'X';

    let state = checkBoardState(m.board);
    if (state) return finalizeMatch(m, state);
    if (Date.now() > m.expiresAt) {
      await expireMatchWithRefund(m, activeMatches, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe' });
      throw new Error('Match expired');
    }
    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;

    const botCell = botPick(m.board, m.botDifficulty);
    if (botCell != null) m.board[botCell] = 'O';
    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;

    state = checkBoardState(m.board);
    if (state) return finalizeMatch(m, state);

    m.turn = 'p1';
    return { match: publicMatch(m) };
  }

  const isP1 = m.player1.userId === userId;
  const isP2 = m.player2.userId === userId;
  if (!isP1 && !isP2) throw new Error('Not your match');
  if ((isP1 && m.turn !== 'p1') || (isP2 && m.turn !== 'p2')) throw new Error('Not your turn');
  if (m.board[idx] !== null) throw new Error('Cell taken');

  m.board[idx] = isP1 ? 'X' : 'O';

  const state = checkBoardState(m.board);
  if (state) return finalizeMatch(m, state);

  if (Date.now() > m.expiresAt) {
    await expireMatchWithRefund(m, activeMatches, { gameId: 'ttt', chatLabel: 'Tic-Tac-Toe' });
    throw new Error('Match expired');
  }
  m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
  m.turn = m.turn === 'p1' ? 'p2' : 'p1';
  return { match: publicMatch(m) };
  });
}

export async function getTttMatch(matchId, userId) {
  return getMatchWithExpiry(activeMatches, matchId, userId, TTT_ESCROW, publicMatch);
}

export async function sweepTttExpired() {
  return sweepExpiredInMap({ activeMatches, queue, rooms }, TTT_ESCROW);
}

export async function getTttLeaderboard() {
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
    wins: top('gameTttWins'),
    losses: top('gameTttLosses'),
    games: top('gameTttGames'),
    streaks: top('gameTttBestStreak'),
  };
}