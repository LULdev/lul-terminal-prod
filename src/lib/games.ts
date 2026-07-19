/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionFetch, sessionJson } from './sessionFetch';

const API = '/api/games';

export type RpsMove = 'rock' | 'paper' | 'scissors';
export type RpsSeriesType = 'single' | 'bo3';
export type TttMark = 'X' | 'O' | null;

import type { GameId } from './gameCatalog';
export type { GameId } from './gameCatalog';

export type BaseMatchResult = {
  outcome: string;
  winner?: string;
  p1Move?: string | number | null;
  p2Move?: string | number | null;
};

export type InstantMatch = {
  id: string;
  game: string;
  mode: 'pvp' | 'bot';
  status: string;
  bet: number;
  botDifficulty: string | null;
  roomCode: string | null;
  reveal: Record<string, unknown> | null;
  player1: {
    userId: string;
    username: string;
    displayName: string;
    move: string | null;
    submitted: boolean;
  };
  player2:
    | { bot: true; move: string | null }
    | {
        userId: string;
        username: string;
        displayName: string;
        move: string | null;
        submitted: boolean;
      };
  result: BaseMatchResult | null;
  streakBonus: number;
  jackpotHit: boolean;
  jackpotAmount: number;
  /** Variable house-game payout (e.g. Dice 100) */
  payoutMultiplier?: number | null;
  createdAt: number;
  expiresAt: number;
  timeLeftMs: number;
};

export type NimMatch = {
  id: string;
  game: 'nim';
  mode: 'pvp' | 'bot';
  status: string;
  bet: number;
  piles: number[];
  turn: 'p1' | 'p2';
  botDifficulty: string | null;
  player1: { userId: string; username: string; displayName: string };
  player2: { bot: true } | { userId: string; username: string; displayName: string };
  result: BaseMatchResult | null;
  streakBonus: number;
  jackpotHit: boolean;
  jackpotAmount: number;
  createdAt: number;
  expiresAt: number;
  timeLeftMs: number;
};

export type Connect4Match = {
  id: string;
  game: 'connect4';
  mode: 'pvp' | 'bot';
  status: string;
  bet: number;
  board: Array<Array<'X' | 'O' | null>>;
  turn: 'p1' | 'p2';
  botDifficulty: string | null;
  player1: { userId: string; username: string; displayName: string; mark: 'X' };
  player2: { bot: true; mark: 'O' } | { userId: string; username: string; displayName: string; mark: 'O' };
  result: BaseMatchResult | null;
  streakBonus: number;
  jackpotHit: boolean;
  jackpotAmount: number;
  createdAt: number;
  expiresAt: number;
  timeLeftMs: number;
};

export type AnyMatch = RpsMatch | TttMatch | InstantMatch | NimMatch | Connect4Match;

export type RpsRound = {
  round: number;
  p1Move: RpsMove;
  p2Move: RpsMove;
  winner: 'p1' | 'p2' | 'draw';
};

export type RpsMatch = {
  id: string;
  mode: 'pvp' | 'bot';
  status: string;
  bet: number;
  seriesType: RpsSeriesType;
  currentRound: number;
  score: { p1: number; p2: number };
  rounds: RpsRound[];
  roomCode: string | null;
  botDifficulty: string | null;
  player1: {
    userId: string;
    username: string;
    displayName: string;
    move: RpsMove | null;
    submitted: boolean;
  };
  player2:
    | { bot: true; move: RpsMove | null }
    | {
        userId: string;
        username: string;
        displayName: string;
        move: RpsMove | null;
        submitted: boolean;
      };
  result: {
    outcome: string;
    winner?: 'p1' | 'p2' | 'draw';
    p1Move?: RpsMove;
    p2Move?: RpsMove;
    seriesScore?: { p1: number; p2: number } | null;
  } | null;
  streakBonus: number;
  jackpotHit: boolean;
  jackpotAmount: number;
  createdAt: number;
  expiresAt: number;
  timeLeftMs: number;
};

export type TttMatch = {
  id: string;
  game: 'ttt';
  mode: 'pvp' | 'bot';
  status: string;
  bet: number;
  board: TttMark[];
  turn: 'p1' | 'p2';
  winningLine: number[] | null;
  roomCode: string | null;
  botDifficulty: string | null;
  player1: {
    userId: string;
    username: string;
    displayName: string;
    mark: 'X';
  };
  player2:
    | { bot: true; mark: 'O' }
    | {
        userId: string;
        username: string;
        displayName: string;
        mark: 'O';
      };
  result: {
    outcome: string;
    winner?: 'p1' | 'p2' | 'draw';
    p1Delta?: number;
    p2Delta?: number;
  } | null;
  streakBonus: number;
  jackpotHit: boolean;
  jackpotAmount: number;
  createdAt: number;
  expiresAt: number;
  timeLeftMs: number;
};

export type MoveCounts = { rock: number; paper: number; scissors: number };

export type GameStats = {
  wins: number;
  losses: number;
  draws: number;
  games: number;
  streak: number;
  bestStreak: number;
  jackpotsWon: number;
  totalWon: number;
  totalLost: number;
  nextStreakBonus: number;
};

export type RpsStats = GameStats & { moves: MoveCounts };

export type QueueStatus = {
  inQueue?: boolean;
  queueBet?: number | null;
  queueRoomCode?: string | null;
};

export type RpsSlice = QueueStatus & {
  queueSize: number;
  myStats: RpsStats | null;
  globalMoves: {
    totals: MoveCounts;
    total: number;
    favorite: RpsMove | null;
  };
  activeMatch: RpsMatch | null;
};

export type TttSlice = QueueStatus & {
  queueSize: number;
  myStats: GameStats | null;
  activeMatch: TttMatch | null;
};

export type GameSlice = QueueStatus & {
  queueSize: number;
  myStats: GameStats | RpsStats | null;
  activeMatch: AnyMatch | null;
  globalMoves?: RpsSlice['globalMoves'];
};

export type GamesState = {
  jackpot: {
    pool: number;
    hits: number;
    lastWinner: string | null;
    lastWonAt: number | null;
    chancePercent: number;
  };
  myCoins: number | null;
  minBet: number;
  maxBet: number;
  dailyBonus: DailyBonusInfo;
  streakBonus: { ratePercent: number; capPercent: number };
  games: Record<string, GameSlice>;
  rps: RpsSlice;
  ttt: TttSlice;
};

export type DailyBonusInfo = {
  amount: number;
  cooldownMs: number;
  canClaim: boolean;
  remainingMs: number;
  nextClaimAt: number | null;
  lastClaimAt: number | null;
};

export type LeaderboardRows = Array<{
  rank: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  value: number;
}>;

export type GameLeaderboardSlice = {
  wins: LeaderboardRows;
  losses: LeaderboardRows;
  games: LeaderboardRows;
  streaks: LeaderboardRows;
};

export type GamesLeaderboard = Record<string, GameLeaderboardSlice | LeaderboardRows> & {
  coins: LeaderboardRows;
  rps: GameLeaderboardSlice;
  ttt: GameLeaderboardSlice;
};

export type MatchHistoryEntry = {
  id: string;
  game?: GameId;
  mode: string;
  seriesType?: string;
  bet: number;
  at: number;
  player1: string;
  player2: string;
  p1Move?: RpsMove;
  p2Move?: RpsMove;
  outcome: string;
  board?: TttMark[];
  winningLine?: number[] | null;
  streakBonus?: number;
  score?: { p1: number; p2: number } | null;
  jackpotHit?: boolean;
  jackpotAmount?: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return sessionJson<T>(`${API}${path}`, init);
}

async function apiRead<T>(path: string): Promise<T> {
  const res = await sessionFetch(`${API}${path}`, undefined, { soft401: true });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new Error('Sign in to view arcade stats');
  }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export function fetchGamesState() {
  return api<GamesState>('/state');
}

export function fetchGamesStateRead() {
  return apiRead<GamesState>('/state');
}

export function fetchGamesLeaderboard() {
  return apiRead<GamesLeaderboard>('/leaderboard');
}

export function fetchGamesHistory(limit = 15) {
  return apiRead<{ matches: MatchHistoryEntry[] }>(`/history?limit=${limit}`);
}

export function joinGameQueue(gameId: string, body: Record<string, unknown>) {
  return api<{ match?: AnyMatch; waiting?: boolean; roomCode?: string; bet?: number }>(`/${gameId}/queue`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function leaveGameQueue(gameId: string) {
  return api<{ ok: boolean }>(`/${gameId}/queue`, { method: 'DELETE' });
}

export function submitGameMove(gameId: string, matchId: string, move: string | number) {
  const body: Record<string, unknown> = { matchId };
  if (typeof move === 'number') {
    body.cell = move;
    body.column = move;
    body.col = move;
  }
  body.move = String(move);
  return api<{ match: AnyMatch; waiting?: boolean; roundComplete?: boolean; unlocks?: string[] }>(`/${gameId}/move`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function joinRpsQueue(body: {
  bet: number;
  mode: 'pvp' | 'bot';
  botDifficulty?: string;
  roomCode?: string;
  seriesType?: RpsSeriesType;
}) {
  return api<{ match?: RpsMatch; waiting?: boolean; roomCode?: string; bet?: number }>('/rps/queue', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function leaveRpsQueue() {
  return api<{ ok: boolean }>('/rps/queue', { method: 'DELETE' });
}

export function submitRpsMove(matchId: string, move: RpsMove) {
  return api<{ match: RpsMatch; waiting?: boolean; roundComplete?: boolean; unlocks?: string[] }>('/rps/move', {
    method: 'POST',
    body: JSON.stringify({ matchId, move }),
  });
}

export function joinTttQueue(body: {
  bet: number;
  mode: 'pvp' | 'bot';
  botDifficulty?: string;
  roomCode?: string;
}) {
  return api<{ match?: TttMatch; waiting?: boolean; roomCode?: string; bet?: number }>('/ttt/queue', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function leaveTttQueue() {
  return api<{ ok: boolean }>('/ttt/queue', { method: 'DELETE' });
}

export function submitTttMove(matchId: string, cell: number) {
  return api<{ match: TttMatch; unlocks?: string[] }>('/ttt/move', {
    method: 'POST',
    body: JSON.stringify({ matchId, cell }),
  });
}

export function claimDailyBonus() {
  return api<{
    coins: number;
    bonus: number;
    canClaim: boolean;
    remainingMs: number;
    nextClaimAt: number | null;
  }>('/daily-bonus', { method: 'POST' });
}

export const MOVE_META: Record<RpsMove, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  rock: {
    label: 'Rock',
    emoji: '✊',
    color: 'text-amber-300',
    bg: 'from-amber-600/20 to-amber-900/30',
    border: 'border-amber-500/40',
  },
  paper: {
    label: 'Paper',
    emoji: '✋',
    color: 'text-sky-300',
    bg: 'from-sky-600/20 to-sky-900/30',
    border: 'border-sky-500/40',
  },
  scissors: {
    label: 'Scissors',
    emoji: '✌️',
    color: 'text-rose-300',
    bg: 'from-rose-600/20 to-rose-900/30',
    border: 'border-rose-500/40',
  },
};

export const QUICK_BETS = [1, 5, 10, 25, 50, 100] as const;

export function formatTimeLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function isMyTttTurn(match: TttMatch, userId?: string): boolean {
  if (!userId || match.status !== 'playing') return false;
  if (match.mode === 'bot') return match.turn === 'p1' && match.player1.userId === userId;
  if (match.player1.userId === userId) return match.turn === 'p1';
  if ('userId' in match.player2 && match.player2.userId === userId) return match.turn === 'p2';
  return false;
}

type MatchResultLike = {
  outcome?: string;
  winner?: 'p1' | 'p2' | 'draw' | string;
};

type MatchOutcomeLike = {
  status: string;
  mode: string;
  player1: { userId: string };
  player2?: { userId?: string; bot?: boolean } | null;
  result?: MatchResultLike | null;
};

export function matchOutcomeForUser(match: MatchOutcomeLike, userId?: string): string | null {
  if (match.status !== 'done' || !match.result) return null;
  if (match.result.outcome === 'expired') return 'expired';
  if (match.mode === 'bot') return match.result.outcome ?? null;
  if (!userId) return match.result.outcome ?? null;
  const winner = match.result.winner;
  if (winner === 'draw' || match.result.outcome === 'draw') return 'draw';
  const amP1 = match.player1.userId === userId;
  if (winner === 'p1') return amP1 ? 'win' : 'loss';
  if (winner === 'p2') return amP1 ? 'loss' : 'win';
  return match.result.outcome ?? null;
}

export function tttOutcomeForUser(match: TttMatch, userId?: string): string | null {
  return matchOutcomeForUser(match, userId);
}

export function outcomeLabel(outcome: string | null): string {
  if (!outcome) return '—';
  if (outcome === 'win') return 'Victory';
  if (outcome === 'loss') return 'Defeat';
  if (outcome === 'draw') return 'Draw';
  if (outcome === 'expired') return 'Match expired — refunded';
  return outcome;
}

export function outcomeTone(outcome: string | null): string {
  if (outcome === 'win') return 'text-emerald-300';
  if (outcome === 'loss') return 'text-rose-300';
  if (outcome === 'expired') return 'text-amber-300/90';
  return 'text-slate-400';
}