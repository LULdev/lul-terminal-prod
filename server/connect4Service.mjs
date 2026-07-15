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

const ROWS = 6;
const C4_EXPIRE = { gameId: 'connect4', chatLabel: 'Connect Four' };
const COLS = 7;
const mm = createMatchmaker();

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function drop(board, col, mark) {
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (!board[r][col]) {
      board[r][col] = mark;
      return { row: r, col };
    }
  }
  return null;
}

function checkWin(board, mark) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (board[r][c] !== mark) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let i = 1; i < 4; i += 1) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== mark) break;
          count += 1;
        }
        if (count >= 4) return true;
      }
    }
  }
  return false;
}

function boardFull(board) {
  return board[0].every((c) => c !== null);
}

function validColumns(board) {
  const cols = [];
  for (let c = 0; c < COLS; c += 1) {
    if (!board[0][c]) cols.push(c);
  }
  return cols;
}

function botConnect4(board, difficulty) {
  const cols = validColumns(board);
  if (!cols.length) return 0;
  if (difficulty === 'easy') return cols[Math.floor(Math.random() * cols.length)];
  for (const c of cols) {
    const copy = board.map((row) => [...row]);
    if (drop(copy, c, 'O') && checkWin(copy, 'O')) return c;
  }
  for (const c of cols) {
    const copy = board.map((row) => [...row]);
    if (drop(copy, c, 'X') && checkWin(copy, 'X')) return c;
  }
  if (cols.includes(3)) return 3;
  return cols[Math.floor(Math.random() * cols.length)];
}

function publicMatch(m) {
  const playing = m.status === 'playing';
  return {
    id: m.id,
    game: 'connect4',
    mode: m.mode,
    status: m.status,
    bet: m.bet,
    board: m.board.map((row) => [...row]),
    turn: m.turn,
    botDifficulty: m.botDifficulty ?? null,
    player1: { userId: m.player1.userId, username: m.player1.username, displayName: m.player1.displayName, mark: 'X' },
    player2: m.mode === 'bot'
      ? { bot: true, mark: 'O' }
      : { userId: m.player2.userId, username: m.player2.username, displayName: m.player2.displayName, mark: 'O' },
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
    game: 'connect4',
    mode,
    status: 'playing',
    bet,
    board: emptyBoard(),
    turn: 'p1',
    botDifficulty: ['easy', 'normal', 'hard'].includes(botDifficulty) ? botDifficulty : 'normal',
    player1: { userId: user.id, username: user.username, displayName: user.displayName },
    player2: mode === 'bot' ? { bot: true } : null,
    result: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + MATCH_TIMEOUT_MS,
  };
}

async function finalizeC4(m, winnerKey) {
  return settleMatch({
    match: m,
    statKey: 'Connect4',
    gameId: 'connect4',
    achievementFlag: 'connect4_played',
    chatLabel: 'Connect Four',
    winnerKey,
    publicMatch,
    activeMatches: mm.activeMatches,
  });
}

export async function joinConnect4Queue(userId, opts = {}) {
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
      }, publicMatch, { gameId: 'connect4', chatLabel: 'Connect Four' }),
    matchOptions: { publicMatch },
    expireMeta: { gameId: 'connect4', chatLabel: 'Connect Four' },
  });
}

export const leaveConnect4Queue = (userId) =>
  leaveMatchQueue(mm, userId, { gameId: 'connect4', chatLabel: 'Connect Four' });

export async function releaseConnect4UserSession(userId) {
  await forceExpireMatchesForUser(mm.activeMatches, userId, C4_EXPIRE);
  await leaveConnect4Queue(userId);
}

export async function submitConnect4Move(userId, matchId, move) {
  const col = Math.floor(Number(move));
  if (col < 0 || col >= COLS) throw new Error('Invalid column');
  return runCoinTransaction(async () => {
  const m = mm.activeMatches.get(matchId);
  if (!m || m.status !== 'playing') throw new Error('Match not found');
  if (!validColumns(m.board).includes(col)) throw new Error('Column full');

  if (m.mode === 'bot') {
    if (m.player1.userId !== userId || m.turn !== 'p1') throw new Error('Not your turn');
    drop(m.board, col, 'X');
    if (checkWin(m.board, 'X')) return finalizeC4(m, 'p1');
    if (boardFull(m.board)) return finalizeC4(m, 'draw');
    if (Date.now() > m.expiresAt) {
      await expireMatchWithRefund(m, mm.activeMatches, { gameId: 'connect4', chatLabel: 'Connect Four' });
      throw new Error('Match expired');
    }
    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
    const botCol = botConnect4(m.board, m.botDifficulty);
    drop(m.board, botCol, 'O');
    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
    if (checkWin(m.board, 'O')) return finalizeC4(m, 'p2');
    if (boardFull(m.board)) return finalizeC4(m, 'draw');
    m.turn = 'p1';
    return { match: publicMatch(m) };
  }

  const isP1 = m.player1.userId === userId;
  const isP2 = m.player2.userId === userId;
  if (!isP1 && !isP2) throw new Error('Not your match');
  if ((isP1 && m.turn !== 'p1') || (isP2 && m.turn !== 'p2')) throw new Error('Not your turn');
  const mark = isP1 ? 'X' : 'O';
  drop(m.board, col, mark);
  if (checkWin(m.board, mark)) return finalizeC4(m, isP1 ? 'p1' : 'p2');
  if (boardFull(m.board)) return finalizeC4(m, 'draw');
  if (Date.now() > m.expiresAt) {
    await expireMatchWithRefund(m, mm.activeMatches, { gameId: 'connect4', chatLabel: 'Connect Four' });
    throw new Error('Match expired');
  }
  m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
  m.turn = m.turn === 'p1' ? 'p2' : 'p1';
  return { match: publicMatch(m) };
  });
}

export async function getConnect4Match(matchId, userId) {
  return getMatchWithExpiry(mm.activeMatches, matchId, userId, { gameId: 'connect4', chatLabel: 'Connect Four' }, publicMatch);
}

export const getConnect4UserSlice = buildUserSlice({
  statKey: 'Connect4',
  queue: mm.queue,
  activeMatches: mm.activeMatches,
  publicMatch,
  expireMeta: { gameId: 'connect4', chatLabel: 'Connect Four' },
  mm,
});

export const getConnect4Leaderboard = () => buildLeaderboard('Connect4');

export async function sweepConnect4Expired() {
  return sweepExpiredInMap(mm, C4_EXPIRE);
}