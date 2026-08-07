/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { withCrossProcessLock } from './fileLock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'games');
const JACKPOT_FILE = path.join(ROOT, 'jackpot.json');
const HISTORY_FILE = path.join(ROOT, 'history.json');
/** Two-phase jackpot: pot drained here; cleared only after user balance save. */
const JACKPOT_PENDING_FILE = path.join(ROOT, 'jackpot-pending.json');

const EMPTY_JACKPOT = {
  version: 1,
  pool: 0,
  totalCollected: 0,
  totalPaidOut: 0,
  lastWinner: null,
  lastWonAt: null,
  hits: 0,
};

const EMPTY_HISTORY = { version: 1, matches: [] };

let jackpotCache = null;
let gamesAuxWriteChain = Promise.resolve();

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serialize jackpot/history RMW (process-local chain + cross-process lock).
 * Independent of users.json coin lock.
 */
export function withGamesAuxWrite(task) {
  const run = gamesAuxWriteChain.then(() =>
    withCrossProcessLock('games-aux', () => task(), { maxWaitMs: 8000 }),
  );
  gamesAuxWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function atomicWriteJson(file, data) {
  await fs.mkdir(ROOT, { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export const STARTING_LULCOINS = 1000;
export const MIN_BET = 1;
export const MAX_BET = 500;
export const JACKPOT_CHANCE = 0.006;
/** Fraction of every Dice / Dice 100 / Roulette wager seeded into the community jackpot (win or lose). */
export const DICE_POT_SEED_RATE = 0.02;
/** Alias — same rake for solo house games (dice + roulette). */
export const HOUSE_POT_SEED_RATE = DICE_POT_SEED_RATE;
export const DAILY_BONUS_COINS = 50;
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MATCH_TIMEOUT_MS = 45_000;
/** How long settled matches stay in RAM so passive PvP clients can poll the result. */
export const MATCH_DONE_TTL_MS = 180_000;
/** Max time a queue entry may hold escrow without matching. */
export const QUEUE_TIMEOUT_MS = 30 * 60 * 1000;
export const STREAK_BONUS_RATE = 0.05;
export const STREAK_BONUS_CAP = 0.25;
/**
 * Base bet used only for nextStreakBonus API previews.
 * MIN_BET is 1 → floor(1 * rate) is always 0 for rates ≤ 25%; use 100 so
 * clients can scale: coinsAtBet = floor((nextStreakBonus / STREAK_HINT_BASE_BET) * bet).
 */
export const STREAK_HINT_BASE_BET = 100;
export const BO3_WINS_NEEDED = 2;

export async function ensureGamesStore() {
  await fs.mkdir(ROOT, { recursive: true });
  for (const [file, empty] of [[JACKPOT_FILE, EMPTY_JACKPOT], [HISTORY_FILE, EMPTY_HISTORY]]) {
    try {
      await fs.access(file);
    } catch {
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(empty, null, 2), 'utf8');
      await fs.rename(tmp, file);
    }
  }
}

async function readJackpotFromDisk() {
  await ensureGamesStore();
  if (!(await fileExists(JACKPOT_FILE))) return structuredClone(EMPTY_JACKPOT);
  try {
    const raw = await fs.readFile(JACKPOT_FILE, 'utf8');
    return { ...EMPTY_JACKPOT, ...JSON.parse(raw) };
  } catch (err) {
    console.error('[games] CRITICAL: jackpot.json unreadable', err);
    throw new Error('Jackpot database unavailable');
  }
}

export async function loadJackpot() {
  jackpotCache = await readJackpotFromDisk();
  return jackpotCache;
}

export async function saveJackpot(db) {
  await atomicWriteJson(JACKPOT_FILE, db);
  jackpotCache = db;
}

export async function addToJackpot(amount) {
  return withGamesAuxWrite(async () => {
    const db = await readJackpotFromDisk();
    const n = Math.max(0, Number(amount) || 0);
    db.pool = Math.max(0, Number(db.pool) || 0) + n;
    db.totalCollected = (Number(db.totalCollected) || 0) + n;
    await saveJackpot(db);
    return db;
  });
}

/**
 * Drain jackpot pool for a winner. Writes a pending journal BEFORE zeroing the pool
 * so a crash between drain and user-balance save can recover on boot
 * (re-credit winner if needed, never lose the amount silently).
 */
/**
 * Drain jackpot. Returns { amount, pendingId } so callers can stamp ledger.meta.pendingId
 * for exact boot-recovery matching. amount=0 / pendingId=null on miss or deferred.
 */
/** Max age of an unconfirmed jackpot pending before live payouts restore the pool in-process. */
const JACKPOT_PENDING_STALE_MS = 5 * 60 * 1000;

export async function payoutJackpot(winner, meta = {}) {
  return withGamesAuxWrite(async () => {
    // Never overwrite an unconfirmed pending payout (would lose the prior winner's amount)
    const existingPending = await readJackpotPending();
    if (existingPending && Number(existingPending.amount) > 0) {
      // Already credited on a prior crash — just clear so jackpots can resume
      if (existingPending.userCredited === true) {
        try { await fs.unlink(JACKPOT_PENDING_FILE); } catch { /* */ }
      } else if (Date.now() - (Number(existingPending.at) || 0) > JACKPOT_PENDING_STALE_MS) {
        // Do NOT restore pool here — user may already be credited without confirm.
        // Live recovery (sweep) settles with durable idempotency; blind restore double-mints.
        console.warn('[games] jackpot payout deferred — stale pending awaits recovery (no blind restore)', {
          pendingWinner: existingPending.winner,
          pendingAmount: existingPending.amount,
          ageMs: Date.now() - (Number(existingPending.at) || 0),
        });
        return { amount: 0, pendingId: null };
      } else {
        console.warn('[games] jackpot payout deferred — prior pending still open', {
          pendingWinner: existingPending.winner,
          pendingAmount: existingPending.amount,
        });
        return { amount: 0, pendingId: null };
      }
    }
    const db = await readJackpotFromDisk();
    const amount = Math.max(0, Math.floor(Number(db.pool) || 0));
    // Empty pool is a miss — do not bump hits / lastWinner
    if (amount <= 0) {
      return { amount: 0, pendingId: null };
    }
    const pending = {
      id: crypto.randomBytes(6).toString('hex'),
      amount,
      winner: String(winner ?? '').slice(0, 48),
      // Prefer userId for boot recovery (username may be renamed)
      userId: meta.userId ? String(meta.userId).slice(0, 32) : null,
      matchId: meta.matchId ? String(meta.matchId).slice(0, 32) : null,
      gameId: meta.gameId ? String(meta.gameId).slice(0, 32) : null,
      at: Date.now(),
      userCredited: false,
    };
    await atomicWriteJson(JACKPOT_PENDING_FILE, pending);
    db.pool = 0;
    db.totalPaidOut = (Number(db.totalPaidOut) || 0) + amount;
    db.hits = (Number(db.hits) || 0) + 1;
    db.lastWinner = winner;
    db.lastWonAt = Date.now();
    await saveJackpot(db);
    return { amount, pendingId: pending.id };
  });
}

/** Normalize payoutJackpot result (object or legacy number). */
export function jackpotPayoutAmount(result) {
  if (result == null) return 0;
  if (typeof result === 'number') return Math.max(0, Math.floor(result) || 0);
  return Math.max(0, Math.floor(Number(result.amount) || 0));
}

export function jackpotPayoutPendingId(result) {
  if (result == null || typeof result === 'number') return null;
  return result.pendingId ? String(result.pendingId) : null;
}

/** Call after user coins for the jackpot were durably saved. */
export async function confirmJackpotPayout() {
  return withGamesAuxWrite(async () => {
    // Mark credited first so boot recovery never re-mints if unlink fails mid-flight
    try {
      const raw = await fs.readFile(JACKPOT_PENDING_FILE, 'utf8');
      const pending = JSON.parse(raw);
      pending.userCredited = true;
      pending.creditedAt = Date.now();
      await atomicWriteJson(JACKPOT_PENDING_FILE, pending);
    } catch {
      /* missing pending — ok */
    }
    try {
      await fs.unlink(JACKPOT_PENDING_FILE);
    } catch {
      /* already gone */
    }
  });
}

async function readJackpotPending() {
  try {
    const raw = await fs.readFile(JACKPOT_PENDING_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Boot recovery: if pot was drained but user credit may not have been saved,
 * re-credit the winner (idempotent if already credited) via callback, then clear pending.
 * If no users DB access, restore amount back into the pool.
 *
 * @param {(pending: {amount:number,winner:string,matchId?:string}) => Promise<'credited'|'restored'|'skipped'>} [settle]
 */
export async function recoverJackpotPendingOnBoot(settle) {
  // Read pending under lock, then RELEASE games-aux before settle (users lock)
  // to avoid games-aux → users deadlock with concurrent settleMatch (users → games-aux).
  let pending = null;
  await withGamesAuxWrite(async () => {
    pending = await readJackpotPending();
    if (!pending || !(Number(pending.amount) > 0)) {
      try { await fs.unlink(JACKPOT_PENDING_FILE); } catch { /* */ }
      pending = null;
    }
  });
  if (!pending) return null;

  const amount = Math.floor(Number(pending.amount) || 0);
  // Already credited on a prior crash after confirm mark — just clear pending
  if (pending.userCredited === true) {
    await withGamesAuxWrite(async () => {
      try { await fs.unlink(JACKPOT_PENDING_FILE); } catch { /* */ }
    });
    return { outcome: 'skipped', amount, winner: pending.winner };
  }
  let outcome = 'restored';
  if (typeof settle === 'function') {
    try {
      outcome = await settle({
        amount,
        winner: pending.winner,
        userId: pending.userId ?? null,
        matchId: pending.matchId,
        gameId: pending.gameId,
        at: pending.at,
        id: pending.id,
      });
    } catch (err) {
      console.error('[games] jackpot pending settle failed — restoring pool', err);
      outcome = 'restored';
    }
  }

  await withGamesAuxWrite(async () => {
    // Another process may have confirmed already — re-check pending identity
    const still = await readJackpotPending();
    if (!still || still.id !== pending.id) return;
    if (outcome === 'restored') {
      const db = await readJackpotFromDisk();
      db.pool = Math.max(0, Number(db.pool) || 0) + amount;
      db.totalPaidOut = Math.max(0, (Number(db.totalPaidOut) || 0) - amount);
      db.hits = Math.max(0, (Number(db.hits) || 0) - 1);
      await saveJackpot(db);
      console.warn('[games] Restored jackpot pending to pool', { amount, winner: pending.winner });
    } else if (outcome === 'credited') {
      console.warn('[games] Recovered jackpot credit for', pending.winner, amount);
    }
    try {
      await fs.unlink(JACKPOT_PENDING_FILE);
    } catch { /* */ }
  });
  return { outcome, amount, winner: pending.winner };
}

export async function loadMatchHistory() {
  await ensureGamesStore();
  if (!(await fileExists(HISTORY_FILE))) return structuredClone(EMPTY_HISTORY);
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf8');
    const data = JSON.parse(raw);
    return { ...EMPTY_HISTORY, ...data, matches: Array.isArray(data.matches) ? data.matches : [] };
  } catch (err) {
    console.error('[games] CRITICAL: history.json unreadable', err);
    throw new Error('Match history unavailable');
  }
}

export async function appendMatchHistory(entry) {
  return withGamesAuxWrite(async () => {
    const db = await loadMatchHistory();
    db.matches.unshift(entry);
    db.matches = db.matches.slice(0, 200);
    await atomicWriteJson(HISTORY_FILE, db);
    return entry;
  });
}