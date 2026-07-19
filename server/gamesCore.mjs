/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { sanitizeAvatarUrl } from './auth/safeMediaUrl.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { syncAchievementsOnLoadedUser } from './auth/authService.mjs';
import { postBotArcadeJackpot, postBotArcadeVictory } from './chatBot.mjs';
import { defaultGameStats, statFields } from './gameStatsConfig.mjs';
import {
  logDrawRefund,
  logGameWinCredit,
  logJackpotCredit,
  logMatchExpireRefund,
  logQueueRefund,
  logStreakCredit,
} from './coinLedger.mjs';
import {
  addToJackpot,
  appendMatchHistory,
  JACKPOT_CHANCE,
  MATCH_DONE_TTL_MS,
  MATCH_TIMEOUT_MS,
  QUEUE_TIMEOUT_MS,
  MAX_BET,
  MIN_BET,
  payoutJackpot,
  STARTING_LULCOINS,
  STREAK_BONUS_CAP,
  STREAK_BONUS_RATE,
} from './gamesStore.mjs';
import {
  addGameEscrow,
  oldestGameEscrowAmount,
  releaseAnyGameEscrow,
  releaseGameEscrow,
} from './gamesEscrow.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { normalizeProfileCustomization } from './profileCustomization.mjs';
import { assertNoOtherArcadeSession, assertPvpPairReady } from './gamesSessionGuard.mjs';

export const ROOM_TOMBSTONE_MS = 90_000;
const MAX_QUEUE_ENTRIES = 200;
const MAX_ACTIVE_MATCHES_PER_GAME = 100;
const MAX_ROOMS_PER_GAME = 100;

export function newMatchId() {
  return crypto.randomBytes(6).toString('hex');
}

export function isRoomConsumed(consumedRooms, code) {
  if (!consumedRooms || !code) return false;
  const at = consumedRooms.get(code);
  if (at == null) return false;
  if (Date.now() - at > ROOM_TOMBSTONE_MS) {
    consumedRooms.delete(code);
    return false;
  }
  return true;
}

export function tombstoneRoom(consumedRooms, code) {
  if (consumedRooms && code) consumedRooms.set(code, Date.now());
}

function stripEscrowRows(user, amt, { gameId = null } = {}) {
  if (!user?.gameEscrows?.length || amt <= 0) return 0;
  const gid = gameId ?? null;
  let remaining = amt;
  const kept = [];
  const rows = gid
    ? user.gameEscrows.filter((e) => e.gameId === gid)
    : [...user.gameEscrows];
  const skipped = gid
    ? user.gameEscrows.filter((e) => e.gameId !== gid)
    : [];
  for (const e of rows) {
    const rowAmt = Math.floor(Number(e.amount) || 0);
    if (remaining <= 0) {
      kept.push(e);
      continue;
    }
    if (rowAmt <= remaining) {
      remaining -= rowAmt;
      continue;
    }
    kept.push({ ...e, amount: rowAmt - remaining });
    remaining = 0;
  }
  user.gameEscrows = [...kept, ...skipped];
  return amt - remaining;
}

function refundBetOnExpire(user, { gameId, chatLabel, matchId, bet, amount }, { forceCredit = false } = {}) {
  if (!user) return;
  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) return;
  const base = { gameId, chatLabel, matchId, bet, amount: amt };
  const released =
    releaseGameEscrow(user, { gameId, amount: amt }) ||
    releaseAnyGameEscrow(user, amt);
  if (released || forceCredit) {
    logMatchExpireRefund(user, base);
    return;
  }
  const gid = gameId ?? 'arcade';
  const matchingTotal = (user.gameEscrows ?? [])
    .filter((e) => e.gameId === gid)
    .reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);
  if (matchingTotal >= amt) {
    stripEscrowRows(user, amt, { gameId: gid });
    logMatchExpireRefund(user, base);
    console.warn('[games] escrow recovery — stripped game escrow + credited', {
      userId: user.id,
      gameId: gid,
      amount: amt,
    });
    return;
  }
  const escrowTotal = (user.gameEscrows ?? []).reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);
  if (escrowTotal >= amt) {
    stripEscrowRows(user, amt);
    logMatchExpireRefund(user, base);
    console.warn('[games] escrow recovery — cross-game strip fallback + credited', {
      userId: user.id,
      gameId: gid,
      amount: amt,
    });
    return;
  }
  if (escrowTotal > 0) {
    stripEscrowRows(user, escrowTotal);
    logMatchExpireRefund(user, { ...base, amount: Math.min(amt, escrowTotal) });
    console.warn('[games] expire refund partial-credited — matched escrow only', {
      userId: user.id,
      gameId: gid,
      requested: amt,
      credited: Math.min(amt, escrowTotal),
    });
    return;
  }
  if (forceCredit) {
    logMatchExpireRefund(user, base);
    return;
  }
  console.warn('[games] expire refund skipped — no escrow rows', {
    userId: user.id,
    gameId,
    amount: amt,
  });
}

export function normalizeBet(raw) {
  const n = Math.floor(Number(raw) || 0);
  return Math.min(MAX_BET, Math.max(MIN_BET, n));
}

export function getUser(db, userId) {
  return db.users.find((u) => u.id === userId && u.role !== 'bot');
}

export function ensureCoins(user) {
  if (user.lulCoins == null) user.lulCoins = STARTING_LULCOINS;
  user.lulCoins = Math.max(0, Number(user.lulCoins) || 0);
}

export function deductCoins(user, amount, escrowMeta) {
  ensureCoins(user);
  if (user.lulCoins < amount) throw new Error('Not enough LULcoins');
  user.lulCoins -= amount;
  if (escrowMeta) addGameEscrow(user, { ...escrowMeta, amount });
}

export function creditCoins(user, amount) {
  ensureCoins(user);
  user.lulCoins += Math.max(0, Number(amount) || 0);
}

export function calcStreakBonus(bet, streak) {
  const s = Math.max(0, Number(streak) || 0);
  if (s <= 1) return 0;
  const rate = Math.min(STREAK_BONUS_CAP, (s - 1) * STREAK_BONUS_RATE);
  return Math.floor(Math.max(0, Number(bet) || 0) * rate);
}

export function bumpGameStats(user, statKey, result, wonJackpot = false) {
  const f = statFields(statKey);
  user[f.games] = (Number(user[f.games]) || 0) + 1;
  if (result === 'win') {
    user[f.wins] = (Number(user[f.wins]) || 0) + 1;
    user[f.streak] = (Number(user[f.streak]) || 0) + 1;
    user[f.bestStreak] = Math.max(Number(user[f.bestStreak]) || 0, user[f.streak]);
  } else if (result === 'loss') {
    user[f.losses] = (Number(user[f.losses]) || 0) + 1;
    user[f.streak] = 0;
  } else {
    user[f.draws] = (Number(user[f.draws]) || 0) + 1;
  }
  if (wonJackpot) user.gameJackpotsWon = (Number(user.gameJackpotsWon) || 0) + 1;
}

export function findUserMatch(activeMatches, userId) {
  if (!userId) return null;
  const playing = [...activeMatches.values()].find(
    (m) => m.status !== 'done' && (m.player1.userId === userId || m.player2?.userId === userId),
  );
  if (playing) return playing;
  const now = Date.now();
  return [...activeMatches.values()]
    .filter(
      (m) => m.status === 'done' && m.doneAt && now - m.doneAt < MATCH_DONE_TTL_MS
        && (m.player1.userId === userId || m.player2?.userId === userId),
    )
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))[0] ?? null;
}

export function sweepStaleDoneMatches(activeMatches) {
  const now = Date.now();
  for (const [id, m] of activeMatches.entries()) {
    if (m.status === 'done' && m.doneAt && now - m.doneAt >= MATCH_DONE_TTL_MS) {
      activeMatches.delete(id);
    }
  }
}

export function resolveActiveMatchForSlice({ activeMatches, userId, publicMatch }) {
  sweepStaleDoneMatches(activeMatches);
  const myMatch = findUserMatch(activeMatches, userId);
  return myMatch ? publicMatch(myMatch) : null;
}

export async function sweepStaleQueueEntries(mm, { gameId, chatLabel }, maxAgeMs = QUEUE_TIMEOUT_MS) {
  if (!mm?.queue?.length) return 0;
  return runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const now = Date.now();
    let swept = 0;
    for (let i = mm.queue.length - 1; i >= 0; i -= 1) {
      const entry = mm.queue[i];
      const lastSeen = Math.max(Number(entry?.at) || 0, Number(entry?.heartbeatAt) || 0);
      if (!lastSeen || now - lastSeen < maxAgeMs) continue;
      const user = getUser(db, entry.userId);
      if (!user) {
        const record = db.users.find((u) => u.id === entry.userId);
        let refundedOrphan = false;
        if (record && entry.bet) {
          const released = releaseGameEscrow(record, { gameId, amount: entry.bet })
            || releaseAnyGameEscrow(record, entry.bet);
          if (released) {
            logQueueRefund(record, { gameId, chatLabel, bet: entry.bet, amount: entry.bet });
            record.updatedAt = Date.now();
            refundedOrphan = true;
            swept += 1;
          }
        }
        mm.queue.splice(i, 1);
        if (entry.roomCode) {
          for (const [code, room] of mm.rooms.entries()) {
            if (room.hostId === entry.userId && code === entry.roomCode) mm.rooms.delete(code);
          }
        }
        if (refundedOrphan) await saveUsersDb(db);
        continue;
      }
      if (!entry.bet) {
        const orphanAmt = oldestGameEscrowAmount(user, gameId);
        if (!orphanAmt) {
          mm.queue.splice(i, 1);
          if (entry.roomCode) {
            for (const [code, room] of mm.rooms.entries()) {
              if (room.hostId === entry.userId && code === entry.roomCode) mm.rooms.delete(code);
            }
          }
          continue;
        }
        const released = releaseGameEscrow(user, { gameId, amount: orphanAmt })
          || releaseAnyGameEscrow(user, orphanAmt);
        if (!released) continue;
        logQueueRefund(user, { gameId, chatLabel, bet: orphanAmt, amount: orphanAmt });
        user.updatedAt = Date.now();
        swept += 1;
        mm.queue.splice(i, 1);
        if (entry.roomCode) {
          for (const [code, room] of mm.rooms.entries()) {
            if (room.hostId === entry.userId && code === entry.roomCode) mm.rooms.delete(code);
          }
        }
        continue;
      }
      const released = releaseGameEscrow(user, { gameId, amount: entry.bet })
        || releaseAnyGameEscrow(user, entry.bet);
      if (!released) {
        entry._sweepFail = (Number(entry._sweepFail) || 0) + 1;
        if (entry._sweepFail < 5) continue;
        console.warn('[games] forcing stale queue removal after escrow failures — force-crediting bet', {
          userId: entry.userId,
          gameId,
          bet: entry.bet,
        });
        logQueueRefund(user, { gameId, chatLabel, bet: entry.bet, amount: entry.bet });
        if (Array.isArray(user.gameEscrows)) {
          user.gameEscrows = user.gameEscrows.filter(
            (e) => !(String(e.gameId) === String(gameId) && Number(e.amount) === Number(entry.bet)),
          );
          if (!user.gameEscrows.length) delete user.gameEscrows;
        }
        user.updatedAt = Date.now();
        swept += 1;
        mm.queue.splice(i, 1);
        if (entry.roomCode) {
          for (const [code, room] of mm.rooms.entries()) {
            if (room.hostId === entry.userId && code === entry.roomCode) mm.rooms.delete(code);
          }
        }
        continue;
      }
      logQueueRefund(user, { gameId, chatLabel, bet: entry.bet, amount: entry.bet });
      user.updatedAt = Date.now();
      swept += 1;
      mm.queue.splice(i, 1);
      if (entry.roomCode) {
        for (const [code, room] of mm.rooms.entries()) {
          if (room.hostId === entry.userId && code === entry.roomCode) mm.rooms.delete(code);
        }
      }
    }
    if (swept > 0) await saveUsersDb(db);
    return swept;
  });
}

export async function settleMatch({
  match: m,
  statKey,
  gameId,
  achievementFlag,
  chatLabel,
  winnerKey,
  publicMatch,
  historyExtra = {},
  activeMatches,
}) {
  return runCoinTransaction(async () => {
  if (m.status === 'done') return { match: publicMatch(m) };

  const db = await loadUsersDb();
  const p1 = getUser(db, m.player1.userId);
  if (!p1) {
    await expireMatchWithRefund(m, activeMatches, { gameId, chatLabel });
    return { match: publicMatch(m) };
  }

  const bet = m.bet;
  const f = statFields(statKey);
  let outcome;
  let p1Delta = 0;
  let jackpotHit = false;
  let jackpotAmount = 0;
  let streakBonus = 0;
  const r = winnerKey;

  const ledgerCtx = { gameId, chatLabel, matchId: m.id, bet };

  let p2 = null;
  if (m.mode === 'pvp') {
    p2 = getUser(db, m.player2.userId);
    if (!p2) {
      await expireMatchWithRefund(m, activeMatches, { gameId, chatLabel });
      return { match: publicMatch(m) };
    }
  }
  if (!releaseGameEscrow(p1, { gameId, amount: bet })) {
    m.expiresAt = 0;
    await expireMatchWithRefund(m, activeMatches, { gameId, chatLabel });
    return { match: publicMatch(m) };
  }
  if (m.mode === 'pvp' && p2) {
    if (!releaseGameEscrow(p2, { gameId, amount: bet })) {
      m._expireCreditUserIds = new Set([m.player1.userId]);
      m.expiresAt = 0;
      await expireMatchWithRefund(m, activeMatches, { gameId, chatLabel });
      return { match: publicMatch(m) };
    }
  }

  if (m.mode === 'bot') {
    if (r === 'draw') {
      outcome = 'draw';
      logDrawRefund(p1, { ...ledgerCtx, amount: bet });
      bumpGameStats(p1, statKey, 'draw');
    } else if (r === 'p1') {
      outcome = 'win';
      // Optional variable payout (e.g. Dice 100 over/under multiplier); default 2× pot
      const mult = Number(m.payoutMultiplier);
      if (Number.isFinite(mult) && mult > 1) {
        p1Delta = Math.max(0, Math.round(bet * mult));
      } else {
        p1Delta = bet * 2;
      }
      logGameWinCredit(p1, { ...ledgerCtx, mode: 'bot', amount: p1Delta });
      p1.gameTotalWon = (Number(p1.gameTotalWon) || 0) + Math.max(0, p1Delta - bet);
      bumpGameStats(p1, statKey, 'win');
      streakBonus = calcStreakBonus(bet, p1[f.streak]);
      if (streakBonus > 0) {
        logStreakCredit(p1, { ...ledgerCtx, amount: streakBonus });
        p1.gameTotalWon = (Number(p1.gameTotalWon) || 0) + streakBonus;
      }
      // Same jackpot spice as PvP wins
      if (Math.random() < JACKPOT_CHANCE) {
        jackpotHit = true;
        jackpotAmount = await payoutJackpot(p1.username);
        logJackpotCredit(p1, { ...ledgerCtx, amount: jackpotAmount });
        p1.gameJackpotsWon = (Number(p1.gameJackpotsWon) || 0) + 1;
        postBotArcadeJackpot({ username: p1.username, amount: jackpotAmount }).catch(() => {});
      }
    } else {
      outcome = 'loss';
      await addToJackpot(bet);
      p1.gameTotalLost = (Number(p1.gameTotalLost) || 0) + bet;
      bumpGameStats(p1, statKey, 'loss');
    }
  } else {
    if (r === 'draw') {
      outcome = 'draw';
      logDrawRefund(p1, { ...ledgerCtx, amount: bet });
      logDrawRefund(p2, { ...ledgerCtx, amount: bet });
      bumpGameStats(p1, statKey, 'draw');
      bumpGameStats(p2, statKey, 'draw');
    } else {
      outcome = r === 'p1' ? 'win' : 'loss';
      const winner = r === 'p1' ? p1 : p2;
      const loser = r === 'p1' ? p2 : p1;
      logGameWinCredit(winner, { ...ledgerCtx, mode: 'pvp', amount: bet * 2 });
      winner.gameTotalWon = (Number(winner.gameTotalWon) || 0) + bet;
      loser.gameTotalLost = (Number(loser.gameTotalLost) || 0) + bet;
      bumpGameStats(winner, statKey, 'win');
      bumpGameStats(loser, statKey, 'loss');
      streakBonus = calcStreakBonus(bet, winner[f.streak]);
      if (streakBonus > 0) {
        logStreakCredit(winner, { ...ledgerCtx, amount: streakBonus });
        winner.gameTotalWon = (Number(winner.gameTotalWon) || 0) + streakBonus;
      }
      if (Math.random() < JACKPOT_CHANCE) {
        jackpotHit = true;
        jackpotAmount = await payoutJackpot(winner.username);
        logJackpotCredit(winner, { ...ledgerCtx, amount: jackpotAmount });
        winner.gameJackpotsWon = (Number(winner.gameJackpotsWon) || 0) + 1;
        postBotArcadeJackpot({ username: winner.username, amount: jackpotAmount }).catch(() => {});
      }
      postBotArcadeVictory({
        gameLabel: chatLabel,
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
      await syncAchievementsOnLoadedUser(p2, db, { flag: achievementFlag });
    }
  }
  const unlocks = await syncAchievementsOnLoadedUser(p1, db, { flag: achievementFlag });

  m.status = 'done';
  m.result = {
    outcome: m.mode === 'bot' ? outcome : (r === 'draw' ? 'draw' : outcome),
    winner: r,
    p1Move: m.player1.move,
    p2Move: m.mode === 'bot' ? m.player2?.move : m.player2?.move,
    reveal: m.reveal ?? null,
    ...(m.resultExtra ?? {}),
  };
  m.streakBonus = streakBonus;
  m.jackpotHit = jackpotHit;
  m.jackpotAmount = jackpotAmount;
  m.doneAt = Date.now();

  await saveUsersDb(db);

  await appendMatchHistory({
    id: m.id,
    game: gameId,
    mode: m.mode,
    bet,
    at: Date.now(),
    player1: m.player1.username,
    player2: m.mode === 'bot' ? 'BOT' : m.player2.username,
    p1Move: m.player1.move,
    p2Move: m.mode === 'bot' ? m.player2.move : m.player2.move,
    outcome: m.mode === 'bot' ? outcome : (r === 'draw' ? 'draw' : outcome),
    streakBonus,
    jackpotHit,
    jackpotAmount,
    reveal: m.reveal ?? null,
    ...historyExtra,
  });

  return { match: publicMatch(m), unlocks };
  });
}

export function userInActiveMatch(activeMatches, userId) {
  return [...activeMatches.values()].some(
    (m) => m.status !== 'done' && (m.player1.userId === userId || m.player2?.userId === userId),
  );
}

export function touchQueueHeartbeat(queue, userId) {
  const entry = queue.find((q) => q.userId === userId);
  if (entry) {
    const now = Date.now();
    entry.heartbeatAt = now;
    entry.at = now;
  }
}

export function sweepStaleConsumedRooms(consumedRooms, maxAgeMs = ROOM_TOMBSTONE_MS) {
  if (!consumedRooms?.size) return 0;
  const now = Date.now();
  let swept = 0;
  for (const [code, at] of consumedRooms.entries()) {
    if (now - at > maxAgeMs) {
      consumedRooms.delete(code);
      swept += 1;
    }
  }
  return swept;
}

export function queueStatusForUser(queue, userId) {
  const entry = queue.find((q) => q.userId === userId);
  return {
    inQueue: Boolean(entry),
    queueBet: entry?.bet ?? null,
    queueRoomCode: entry?.roomCode ?? null,
  };
}

export async function refundJoinEscrow(db, user, amount, expireMeta) {
  if (!user || !amount || !expireMeta) return;
  const released = releaseGameEscrow(user, { gameId: expireMeta.gameId, amount })
    || releaseAnyGameEscrow(user, amount);
  if (!released) {
    throw new Error('Escrow mismatch — refund failed');
  }
  logQueueRefund(user, {
    gameId: expireMeta.gameId,
    chatLabel: expireMeta.chatLabel,
    bet: amount,
    amount,
  });
  user.updatedAt = Date.now();
  await saveUsersDb(db);
}

async function refundHostQueueEscrow(db, user, amount, expireMeta) {
  if (!user || !amount || !expireMeta) return;
  const hostBet = amount;
  if (!releaseGameEscrow(user, { gameId: expireMeta.gameId, amount: hostBet })) {
    if (!releaseAnyGameEscrow(user, hostBet)) return;
  }
  logQueueRefund(user, {
    gameId: expireMeta.gameId,
    chatLabel: expireMeta.chatLabel,
    bet: hostBet,
    amount: hostBet,
  });
  user.updatedAt = Date.now();
  await saveUsersDb(db);
}

async function leaveQueueEntry(mm, db, user, userId, entry, expireMeta) {
  const idx = mm.queue.findIndex((q) => q.userId === userId);
  if (idx < 0) return;
  if (user && entry?.bet && expireMeta) {
    const released = releaseGameEscrow(user, { gameId: expireMeta.gameId, amount: entry.bet })
      || releaseAnyGameEscrow(user, entry.bet);
    if (!released) {
      throw new Error('Escrow mismatch — leave queue and re-join');
    }
    logQueueRefund(user, {
      gameId: expireMeta.gameId,
      chatLabel: expireMeta.chatLabel,
      bet: entry.bet,
      amount: entry.bet,
    });
    user.updatedAt = Date.now();
  }
  mm.queue.splice(idx, 1);
  for (const [code, room] of mm.rooms.entries()) {
    if (room.hostId === userId) mm.rooms.delete(code);
  }
  await saveUsersDb(db);
}

export async function sweepExpiredMatchesForUser(activeMatches, userId, expireMeta) {
  if (!userId || !expireMeta) return;
  const expired = [...activeMatches.values()].filter(
    (m) => m.status !== 'done' && Date.now() > m.expiresAt
      && (m.player1.userId === userId || m.player2?.userId === userId),
  );
  for (const m of expired) {
    await expireMatchWithRefund(m, activeMatches, expireMeta);
  }
}

/** Logout / account removal — expire in-progress matches and refund escrow immediately. */
export async function forceExpireMatchesForUser(activeMatches, userId, expireMeta) {
  if (!userId || !expireMeta || !activeMatches) return;
  const mine = [...activeMatches.values()].filter(
    (m) => m.status === 'playing'
      && (m.player1?.userId === userId || m.player2?.userId === userId),
  );
  for (const m of mine) {
    await expireMatchWithRefund(m, activeMatches, { ...expireMeta, forceAbandon: true });
  }
}

export async function getMatchWithExpiry(activeMatches, matchId, userId, expireMeta, publicMatch) {
  const m = activeMatches.get(matchId);
  if (!m) return null;
  if (m.mode === 'pvp' && (!userId || (m.player1.userId !== userId && m.player2?.userId !== userId))) return null;
  if (m.mode === 'bot' && userId && m.player1.userId !== userId) return null;
  if (m.status !== 'done' && Date.now() > m.expiresAt) {
    if (m.player1?.move != null && m.player2?.move != null && expireMeta?.finalizeDualSubmit) {
      await expireMeta.finalizeDualSubmit(m, activeMatches);
      return publicMatch(activeMatches.get(matchId) ?? m);
    }
    await expireMatchWithRefund(m, activeMatches, expireMeta);
    return publicMatch(m);
  }
  return publicMatch(m);
}

export function buildUserSlice({ statKey, queue, activeMatches, publicMatch, extraStats, expireMeta, mm }) {
  return async (userId) => {
    const db = await loadUsersDb();
    const user = userId ? getUser(db, userId) : null;
    if (mm && expireMeta && userId && queue.some((q) => q.userId === userId)) {
      await sweepStaleQueueEntries(mm, expireMeta);
    }
    touchQueueHeartbeat(queue, userId);
    await sweepExpiredMatchesForUser(activeMatches, userId, expireMeta);
    const base = user ? defaultGameStats(user, statKey) : null;
    return {
      queueSize: queue.length,
      ...queueStatusForUser(queue, userId),
      myStats: base
        ? {
            ...base,
            ...extraStats?.(user),
            nextStreakBonus: calcStreakBonus(MIN_BET, (Number(user[statFields(statKey).streak]) || 0) + 1),
          }
        : null,
      activeMatch: resolveActiveMatchForSlice({ queue, activeMatches, userId, publicMatch }),
    };
  };
}

export async function buildLeaderboard(statKey) {
  const db = await loadUsersDb();
  const users = db.users.filter((u) => {
    if (u.role === 'bot' || u.active === false) return false;
    const privacy = normalizeProfileCustomization(u.profileCustomization).privacy;
    return privacy.showActivityStats !== false;
  });
  const f = statFields(statKey);
  const top = (field, limit = 10) =>
    [...users]
      .sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0))
      .slice(0, limit)
      .map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: sanitizeAvatarUrl(u.avatarUrl) || '',
        value: Number(u[field]) || 0,
      }));
  return {
    wins: top(f.wins),
    losses: top(f.losses),
    games: top(f.games),
    streaks: top(f.bestStreak),
  };
}

export function createMatchmaker() {
  return {
    queue: [],
    rooms: new Map(),
    consumedRooms: new Map(),
    activeMatches: new Map(),
  };
}

export async function joinMatchQueue(params) {
  return runCoinTransaction(() => joinMatchQueueInner(params));
}

async function joinMatchQueueInner({
  mm,
  userId,
  bet,
  mode,
  botDifficulty,
  roomCode,
  createBotMatch,
  createPvpMatch,
  matchOptions = {},
  expireMeta,
}) {
  const db = await loadUsersDb();
  const user = getUser(db, userId);
  if (!user) throw new Error('User not found');
  if (mm.queue.length >= MAX_QUEUE_ENTRIES && !mm.queue.some((q) => q.userId === userId)) {
    throw new Error('Matchmaking busy — try again shortly');
  }
  const liveMatches = [...mm.activeMatches.values()].filter((m) => m.status !== 'done').length;
  if (liveMatches >= MAX_ACTIVE_MATCHES_PER_GAME) {
    throw new Error('Too many active matches — try again shortly');
  }
  if (expireMeta?.gameId) {
    await assertNoOtherArcadeSession(userId, expireMeta.gameId);
  }
  const amount = normalizeBet(bet);
  ensureCoins(user);

  const escrow = expireMeta
    ? { gameId: expireMeta.gameId, chatLabel: expireMeta.chatLabel }
    : null;

  if (expireMeta) {
    await sweepExpiredMatchesForUser(mm.activeMatches, userId, expireMeta);
  }

  const existing = [...mm.activeMatches.values()].find(
    (m) => m.status !== 'done' && (m.player1.userId === userId || m.player2?.userId === userId),
  );
  if (existing) return { match: matchOptions.publicMatch(existing) };

  const queued = mm.queue.find((q) => q.userId === userId);
  if (queued && mode === 'bot') {
    await leaveQueueEntry(mm, db, user, userId, queued, expireMeta);
  } else if (queued) {
    const code = roomCode ? String(roomCode).trim().toUpperCase() : undefined;
    const sameBet = queued.bet === amount;
    const sameRoom = (queued.roomCode ?? undefined) === code;
    if (sameBet && sameRoom) {
      queued.at = Date.now();
      return { waiting: true, bet: queued.bet, roomCode: queued.roomCode ?? undefined };
    }
    if (queued.bet !== amount && expireMeta) {
      const released = releaseGameEscrow(user, { gameId: expireMeta.gameId, amount: queued.bet })
        || releaseAnyGameEscrow(user, queued.bet);
      if (!released) {
        throw new Error('Escrow mismatch — leave queue and re-join');
      }
      logQueueRefund(user, {
        gameId: expireMeta.gameId,
        chatLabel: expireMeta.chatLabel,
        bet: queued.bet,
        amount: queued.bet,
      });
      deductCoins(user, amount, escrow);
    }
    queued.bet = amount;
    for (const [c, room] of mm.rooms.entries()) {
      if (room.hostId === userId) mm.rooms.delete(c);
    }
    if (code) {
      queued.roomCode = code;
      mm.rooms.set(code, { code, hostId: userId, bet: amount, createdAt: Date.now() });
    } else {
      delete queued.roomCode;
    }
    queued.at = Date.now();
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return { waiting: true, bet: amount, roomCode: queued.roomCode ?? undefined };
  }

  if (mode === 'bot') {
    deductCoins(user, amount, escrow);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    const match = createBotMatch(user, amount, botDifficulty);
    mm.activeMatches.set(match.id, match);
    return { match: matchOptions.publicMatch(match) };
  }

  if (roomCode) {
    const code = String(roomCode).trim().toUpperCase();
    if (isRoomConsumed(mm.consumedRooms, code)) throw new Error('Room already filled');
    let room = mm.rooms.get(code);
    if (!room) {
      if (mm.rooms.size >= MAX_ROOMS_PER_GAME) {
        throw new Error('Too many open rooms — try again shortly');
      }
      mm.consumedRooms?.delete(code);
      deductCoins(user, amount, escrow);
      user.updatedAt = Date.now();
      await saveUsersDb(db);
      room = { code, hostId: userId, bet: amount, createdAt: Date.now() };
      mm.rooms.set(code, room);
      mm.queue.push({ userId, bet: amount, roomCode: code, at: Date.now() });
      return { waiting: true, roomCode: code };
    }
    if (room.hostId === userId) throw new Error('Cannot join your own room');
    if (room.bet !== amount) throw new Error(`Room bet is ${room.bet} LULcoins`);
    deductCoins(user, amount, escrow);
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    const hostIdx = mm.queue.findIndex((q) => q.userId === room.hostId && q.roomCode === code);
    if (hostIdx >= 0) mm.queue.splice(hostIdx, 1);
    mm.rooms.delete(code);
    try {
      await assertPvpPairReady(room.hostId, user.id, expireMeta?.gameId);
      const result = await createPvpMatch(user.id, room.hostId, amount, mm, matchOptions);
      tombstoneRoom(mm.consumedRooms, code);
      return result;
    } catch (e) {
      const hostUser = getUser(db, room.hostId);
      await refundHostQueueEscrow(db, hostUser, room.bet, expireMeta);
      await refundJoinEscrow(db, user, amount, expireMeta);
      throw e;
    }
  }

  deductCoins(user, amount, escrow);
  user.updatedAt = Date.now();
  await saveUsersDb(db);

  const racedMatch = [...mm.activeMatches.values()].find(
    (m) => m.status !== 'done' && (m.player1.userId === userId || m.player2?.userId === userId),
  );
  if (racedMatch) {
    await refundJoinEscrow(db, user, amount, expireMeta);
    return { match: matchOptions.publicMatch(racedMatch) };
  }

  const racedQueue = mm.queue.find((q) => q.userId === userId);
  if (racedQueue) {
    await refundJoinEscrow(db, user, amount, expireMeta);
    return { waiting: true, bet: racedQueue.bet, roomCode: racedQueue.roomCode ?? undefined };
  }

  const opponent = mm.queue.find((q) => q.userId !== userId && q.bet === amount && !q.roomCode);
  if (opponent) {
    mm.queue.splice(mm.queue.indexOf(opponent), 1);
    try {
      await assertPvpPairReady(opponent.userId, user.id, expireMeta?.gameId);
      return await createPvpMatch(user.id, opponent.userId, amount, mm, matchOptions);
    } catch (e) {
      const oppUser = getUser(db, opponent.userId);
      await refundHostQueueEscrow(db, oppUser, opponent.bet, expireMeta);
      await refundJoinEscrow(db, user, amount, expireMeta);
      throw e;
    }
  }

  if (mm.queue.some((q) => q.userId === userId)) {
    await refundJoinEscrow(db, user, amount, expireMeta);
    const q = mm.queue.find((entry) => entry.userId === userId);
    return { waiting: true, bet: q?.bet ?? amount, roomCode: q?.roomCode ?? undefined };
  }

  mm.queue.push({ userId, bet: amount, at: Date.now() });
  return { waiting: true, bet: amount };
}

export async function leaveMatchQueue(mm, userId, { gameId = 'arcade', chatLabel = 'Arcade' } = {}) {
  return runCoinTransaction(async () => {
  const db = await loadUsersDb();
  const user = getUser(db, userId);
  let refunded = 0;
  while (true) {
    const idx = mm.queue.findIndex((q) => q.userId === userId);
    if (idx < 0) break;
    const entry = mm.queue[idx];
    if (user && entry?.bet) {
      const released = releaseGameEscrow(user, { gameId, amount: entry.bet })
        || releaseAnyGameEscrow(user, entry.bet);
      if (!released) {
        throw new Error('Escrow mismatch — cannot leave queue');
      }
      logQueueRefund(user, { gameId, chatLabel, bet: entry.bet, amount: entry.bet });
      refunded += entry.bet;
      user.updatedAt = Date.now();
    }
    mm.queue.splice(idx, 1);
  }
  for (const [code, room] of mm.rooms.entries()) {
    if (room.hostId === userId) mm.rooms.delete(code);
  }
  if (user && refunded > 0) await saveUsersDb(db);
  return { ok: true };
  });
}

export async function expireMatchWithRefund(m, activeMatches, expireMeta) {
  if (!m) return;
  const { gameId, chatLabel } = expireMeta ?? {};
  return runCoinTransaction(async () => {
  if (m.status === 'done') return;
  if (m.status !== 'playing') return;
  if (m.player1?.move != null && m.player2?.move != null && !expireMeta?.forceAbandon) {
    if (expireMeta?.finalizeDualSubmit) {
      await expireMeta.finalizeDualSubmit(m, activeMatches);
    }
    return;
  }
  m.status = 'done';
  m.doneAt = Date.now();
  m.result = { outcome: 'expired', winner: 'draw' };
  const db = await loadUsersDb();
  const bet = m.bet;
  const base = { gameId, chatLabel, matchId: m.id, bet, amount: bet };

  const forceIds = m._expireCreditUserIds;
  const forceAbandon = Boolean(expireMeta?.forceAbandon);
  const p1 = getUser(db, m.player1.userId);
  if (p1) {
    refundBetOnExpire(p1, base, { forceCredit: forceAbandon || forceIds?.has(m.player1.userId) });
    p1.updatedAt = Date.now();
  }
  if (m.mode === 'pvp' && m.player2?.userId) {
    const p2 = getUser(db, m.player2.userId);
    if (p2) {
      refundBetOnExpire(p2, base, { forceCredit: forceAbandon || forceIds?.has(m.player2.userId) });
      p2.updatedAt = Date.now();
    }
  }
  await saveUsersDb(db);
  await appendMatchHistory({
    id: m.id,
    game: gameId,
    mode: m.mode,
    bet,
    at: Date.now(),
    player1: m.player1.username,
    player2: m.mode === 'bot' ? 'BOT' : m.player2?.username ?? '—',
    outcome: 'expired',
    streakBonus: 0,
    jackpotHit: false,
    jackpotAmount: 0,
  });
  });
}

export async function createPvpMatchFromQueue(joinerId, hostId, bet, mm, buildMatch, publicMatch, refundMeta) {
  await assertPvpPairReady(hostId, joinerId, refundMeta?.gameId);
  const db = await loadUsersDb();
  const p1 = getUser(db, hostId);
  const p2 = getUser(db, joinerId);
  if (!p1 || !p2) throw new Error('Player not found');
  const match = buildMatch(p1, p2, bet);
  mm.activeMatches.set(match.id, match);
  return { match: publicMatch(match) };
}

export { MATCH_TIMEOUT_MS };