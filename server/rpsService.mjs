/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { isInsideUsersWrite, loadUsersDb, saveUsersDb, scheduleAfterUsersWrite } from './auth/authStore.mjs';
import { syncAchievementsOnLoadedUser } from './auth/authService.mjs';
import { postBotRpsJackpot, postBotRpsVictory } from './chatBot.mjs';
import {
  hasJackpotPendingCredited,
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
  createMatchmaker,
  leaveMatchQueue,
  queueStatusForUser,
  refundJoinEscrow,
  releaseOrRecoverQueueBet,
  assertQueueBetCleared,
  resolveActiveMatchForSlice,
  tombstoneRoom,
  sweepExpiredMatchesForUser,
  sweepStaleQueueEntries,
  touchQueueHeartbeat,
  withMatchmakerWrite,
  withMatchmakerRead,
  withMatchmakersHeldForJoin,
} from './gamesCore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { assertNoOtherArcadeSession, assertPvpPairReady } from './gamesSessionGuard.mjs';
import { addGameEscrow, releaseAnyGameEscrow, releaseGameEscrow } from './gamesEscrow.mjs';
import { sweepExpiredInMap } from './gamesExpirySweep.mjs';
import {
  addToJackpot,
  appendMatchHistory,
  BO3_WINS_NEEDED,
  DAILY_BONUS_COINS,
  DAILY_BONUS_COOLDOWN_MS,
  confirmJackpotPayout,
  JACKPOT_CHANCE,
  jackpotPayoutAmount,
  jackpotPayoutPendingId,
  MATCH_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
  payoutJackpot,
  STARTING_LULCOINS,
  STREAK_BONUS_CAP,
  STREAK_BONUS_RATE,
  STREAK_HINT_BASE_BET,
} from './gamesStore.mjs';

const MOVES = ['rock', 'paper', 'scissors'];
const MOVE_EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };

const mm = createMatchmaker('rps');
const queue = mm.queue;
const rooms = mm.rooms;
const consumedRooms = mm.consumedRooms;
const activeMatches = mm.activeMatches;

async function refundHostQueueEscrow(db, user, amount) {
  if (!user || !amount) return;
  const hostBet = amount;
  const released = releaseGameEscrow(user, { gameId: 'rps', amount: hostBet })
    || releaseAnyGameEscrow(user, hostBet, { preferGameId: 'rps' });
  if (!released) {
    throw new Error('Escrow mismatch — host refund failed');
  }
  logQueueRefund(user, { gameId: 'rps', chatLabel: 'RPS', bet: hostBet, amount: hostBet });
  user.updatedAt = Date.now();
  await saveUsersDb(db);
}

async function leaveQueueEntry(db, user, userId, entry) {
  const idx = queue.findIndex((q) => q.userId === userId);
  if (idx < 0) return;
  if (user && entry?.bet) {
    const recovered = releaseOrRecoverQueueBet(user, 'rps', 'RPS', entry.bet);
    assertQueueBetCleared(user, 'rps', entry.bet, recovered);
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
  user.lulCoins = Math.max(0, Math.floor(Number(user.lulCoins) || 0));
}

const RPS_ESCROW = { gameId: 'rps', chatLabel: 'RPS' };

async function finalizeDualSubmitRps(m) {
  if (!m.player1?.move || !m.player2?.move) return;
  if (m.seriesType === 'bo3') await processBo3Round(m);
  else await finalizeMatch(m);
}

const RPS_EXPIRE_META = {
  ...RPS_ESCROW,
  mm,
  finalizeDualSubmit: finalizeDualSubmitRps,
};

function deductCoins(user, amount) {
  ensureCoins(user);
  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) throw new Error('Invalid bet amount');
  if (user.lulCoins < amt) throw new Error('Not enough LULcoins');
  user.lulCoins -= amt;
  addGameEscrow(user, { ...RPS_ESCROW, amount: amt });
}

function creditCoins(user, amount, ledgerFn, ledgerArgs) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (ledgerFn && ledgerArgs) {
    if (ledgerFn === logQueueRefund) {
      const released = releaseGameEscrow(user, { gameId: ledgerArgs.gameId ?? 'rps', amount: amt })
        || releaseAnyGameEscrow(user, amt, { preferGameId: ledgerArgs.gameId ?? 'rps' });
      if (!released) {
        throw new Error('Escrow mismatch — queue refund failed');
      }
    }
    ledgerFn(user, { ...ledgerArgs, amount: amt });
    return;
  }
  ensureCoins(user);
  user.lulCoins += amt;
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
  let deferredLossPot = 0;
  let deferredJackpot = null; // { userId, username }
  let victoryChat = null; // { winner, loser, wager }

  const settled = await runCoinTransaction(async () => {
    if (m.status === 'done') return { match: publicMatch(m), unlocks: undefined, early: true };

    const db = await loadUsersDb();
    const p1 = getUser(db, m.player1.userId);
    if (!p1) {
      await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
      return { match: publicMatch(m), unlocks: undefined, early: true };
    }

    const bet = m.bet;
    let outcome;
    let p1Delta = 0;
    let p2Delta = 0;
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
        return { match: publicMatch(m), unlocks: undefined, early: true };
      }
    }
    if (!releaseGameEscrow(p1, { ...RPS_ESCROW, amount: bet })) {
      m.expiresAt = 0;
      m._finalizeAttempted = true;
      await expireMatchWithRefund(m, activeMatches, { ...RPS_EXPIRE_META, forceAbandon: true });
      return { match: publicMatch(m), unlocks: undefined, early: true };
    }
    m._releasedStakeByUserId = m._releasedStakeByUserId ?? {};
    m._releasedStakeByUserId[m.player1.userId] = bet;
    if (m.mode === 'pvp' && p2) {
      if (!releaseGameEscrow(p2, { ...RPS_ESCROW, amount: bet })) {
        m._expireCreditUserIds = new Set([m.player1.userId]);
        m.expiresAt = 0;
        m._finalizeAttempted = true;
        await expireMatchWithRefund(m, activeMatches, { ...RPS_EXPIRE_META, forceAbandon: true });
        return { match: publicMatch(m), unlocks: undefined, early: true };
      }
      m._releasedStakeByUserId[m.player2.userId] = bet;
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
        deferredLossPot = bet; // pot write after users lock
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
          deferredJackpot = { userId: winner.id, username: winner.username };
        }

        victoryChat = {
          winner: winner.username,
          loser: loser.username,
          wager: bet,
        };
      }
    }

    p1.updatedAt = Date.now();
    if (m.mode === 'pvp') {
      const p2u = getUser(db, m.player2.userId);
      if (p2u) {
        p2u.updatedAt = Date.now();
        await syncAchievementsOnLoadedUser(p2u, db, { flag: 'rps_played', skipVaultCount: true });
      }
    }

    const unlocks = await syncAchievementsOnLoadedUser(p1, db, { flag: 'rps_played', skipVaultCount: true });
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
    m.jackpotHit = false;
    m.jackpotAmount = 0;
    m.doneAt = Date.now();

    return {
      early: false,
      unlocks,
      historyBase: {
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
      },
      ledgerCtx,
    };
  });

  if (settled?.early) return { match: settled.match, unlocks: settled.unlocks };

  const runDeferredAux = async () => {
    if (deferredLossPot > 0) {
      await addToJackpot(deferredLossPot).catch((e) => console.error('[rps] addToJackpot loss failed', e));
    }

    let jackpotHit = false;
    let jackpotAmount = 0;
    if (deferredJackpot) {
      try {
        const jp = await payoutJackpot(deferredJackpot.username, {
          matchId: m.id,
          gameId: 'rps',
          userId: deferredJackpot.userId,
        });
        jackpotAmount = jackpotPayoutAmount(jp);
        const pendingId = jackpotPayoutPendingId(jp);
        if (jackpotAmount > 0) {
          let credited = false;
          await runCoinTransaction(async () => {
            const db = await loadUsersDb();
            const u = getUser(db, deferredJackpot.userId);
            if (!u) return;
            if (hasJackpotPendingCredited(u, { pendingId, matchId: m.id, amount: jackpotAmount })) {
              credited = true;
              return;
            }
            logJackpotCredit(u, {
              gameId: 'rps',
              chatLabel: 'RPS',
              matchId: m.id,
              bet: m.bet,
              amount: jackpotAmount,
              pendingId,
            });
            u.gameJackpotsWon = (Number(u.gameJackpotsWon) || 0) + 1;
            u.updatedAt = Date.now();
            await saveUsersDb(db);
            credited = true;
          });
          if (credited) {
            await confirmJackpotPayout().catch((err) => {
              console.error('[rps] confirmJackpotPayout failed (user already credited)', err);
            });
            jackpotHit = true;
            m.jackpotHit = true;
            m.jackpotAmount = jackpotAmount;
            postBotRpsJackpot({ username: deferredJackpot.username, amount: jackpotAmount }).catch(() => {});
          } else {
            console.error('[rps] jackpot credit skipped — pending left for recovery', {
              userId: deferredJackpot.userId,
              amount: jackpotAmount,
              pendingId,
            });
          }
        }
      } catch (e) {
        console.error('[rps] deferred jackpot failed', e);
      }
    }

    if (victoryChat) {
      postBotRpsVictory({
        winner: victoryChat.winner,
        loser: victoryChat.loser,
        wager: victoryChat.wager,
        jackpotHit,
      }).catch(() => {});
    }

    await appendMatchHistory({
      ...settled.historyBase,
      jackpotHit,
      jackpotAmount,
    }).catch((e) => console.error('[rps] appendMatchHistory failed', e));
  };

  if (isInsideUsersWrite()) {
    scheduleAfterUsersWrite(runDeferredAux);
  } else {
    await runDeferredAux();
  }

  return { match: publicMatch(m), unlocks: settled.unlocks };
}

export async function getRpsUserSlice(userId) {
  const run = async () => {
    const db = await loadUsersDb();
    const user = userId ? getUser(db, userId) : null;

    if (userId && queue.some((q) => q.userId === userId)) {
      await sweepStaleQueueEntries(mm, RPS_EXPIRE_META);
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
            // STREAK_HINT_BASE_BET — floor(MIN_BET*rate) is always 0 at minBet=1
            nextStreakBonus: calcStreakBonus(
              STREAK_HINT_BASE_BET,
              (Number(user.gameRpsStreak) || 0) + 1,
            ),
          }
        : null,
      globalMoves: aggregateGlobalMoves(db.users),
      activeMatch: resolveActiveMatchForSlice({ queue, activeMatches, userId, publicMatch }),
    };
  };
  // Authenticated: always write so hydrate+heartbeat persist (multi-worker). Guest: read.
  return userId ? withMatchmakerWrite(mm, run) : withMatchmakerRead(mm, run);
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
  const raw = Number(ms);
  if (!Number.isFinite(raw) || raw <= 0) return 'a moment';
  const totalSec = Math.max(0, Math.ceil(raw / 1000));
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
    ensureCoins(user);
    return {
      coins: user.lulCoins,
      bonus: DAILY_BONUS_COINS,
      nextClaimAt: next.nextClaimAt,
      remainingMs: Number.isFinite(next.remainingMs) ? Math.max(0, next.remainingMs) : 0,
      canClaim: next.canClaim,
    };
  });
}

export async function joinQueue(userId, opts = {}) {
  // Hold all MMs (rps write, others read) through assert + deduct — multi-worker dual-session harden
  return withMatchmakersHeldForJoin('rps', () =>
    runCoinTransaction(() => joinQueueInner(userId, opts)),
  );
}

async function joinQueueInner(userId, { bet, mode = 'pvp', botDifficulty = 'normal', roomCode, seriesType } = {}) {
  const db = await loadUsersDb();
  const user = getUser(db, userId);
  if (!user) throw new Error('User not found');
  await assertNoOtherArcadeSession(userId, 'rps');
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
      const now = Date.now();
      queued.at = now;
      queued.heartbeatAt = now;
      return { waiting: true, bet: queued.bet, roomCode: queued.roomCode ?? undefined };
    }
    if (queued.bet !== amount) {
      releaseOrRecoverQueueBet(user, 'rps', 'RPS', queued.bet);
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
    {
      const now = Date.now();
      queued.at = now;
      queued.heartbeatAt = now;
    }
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
      const nowQ = Date.now();
      queue.push({ userId, bet: amount, roomCode: code, seriesType: series, at: nowQ, joinedAt: nowQ, heartbeatAt: nowQ });
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

  const nowQ = Date.now();
  queue.push({ userId, bet: amount, seriesType: series, at: nowQ, joinedAt: nowQ, heartbeatAt: nowQ });
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
  // Shared leave recovers stuck escrow without throwing (no permanent queue pin)
  return leaveMatchQueue(mm, userId, { gameId: 'rps', chatLabel: 'RPS' });
}

export const leaveQueue = leaveRpsQueue;

export async function releaseRpsUserSession(userId) {
  await forceExpireMatchesForUser(activeMatches, userId, RPS_EXPIRE_META);
  await leaveRpsQueue(userId);
}

export async function submitMove(userId, matchId, move) {
  if (!MOVES.includes(move)) throw new Error('Invalid move');
  return withMatchmakerWrite(mm, () => runCoinTransaction(async () => {
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
    const other = isP1 ? m.player2 : m.player1;
    // Expiry BEFORE recording move — never accept late moves (forfeit resolves pot)
    if (Date.now() > m.expiresAt) {
      await expireMatchWithRefund(m, activeMatches, RPS_EXPIRE_META);
      throw new Error('Match expired');
    }
    slot.move = move;

    const bothReady = Boolean(m.player1.move && m.player2.move);
    if (bothReady) {
      if (m.seriesType === 'bo3') return processBo3Round(m);
      return finalizeMatch(m);
    }

    m.expiresAt = Date.now() + MATCH_TIMEOUT_MS;
    return { match: publicMatch(m), waiting: true };
  }));
}

export async function getMatch(matchId, userId) {
  return withMatchmakerWrite(mm, () =>
    getMatchWithExpiry(activeMatches, matchId, userId, RPS_EXPIRE_META, publicMatch),
  );
}

export async function sweepRpsExpired() {
  return sweepExpiredInMap(mm, RPS_EXPIRE_META);
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