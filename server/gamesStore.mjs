/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'games');
const JACKPOT_FILE = path.join(ROOT, 'jackpot.json');
const HISTORY_FILE = path.join(ROOT, 'history.json');

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

/** Serialize jackpot/history RMW (independent of users.json coin lock). */
export function withGamesAuxWrite(task) {
  const run = gamesAuxWriteChain.then(() => task());
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
export const DAILY_BONUS_COINS = 50;
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MATCH_TIMEOUT_MS = 45_000;
/** How long settled matches stay in RAM so passive PvP clients can poll the result. */
export const MATCH_DONE_TTL_MS = 180_000;
/** Max time a queue entry may hold escrow without matching. */
export const QUEUE_TIMEOUT_MS = 30 * 60 * 1000;
export const STREAK_BONUS_RATE = 0.05;
export const STREAK_BONUS_CAP = 0.25;
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

export async function payoutJackpot(winner) {
  return withGamesAuxWrite(async () => {
    const db = await readJackpotFromDisk();
    const amount = Math.max(0, Number(db.pool) || 0);
    db.pool = 0;
    db.totalPaidOut = (Number(db.totalPaidOut) || 0) + amount;
    db.hits = (Number(db.hits) || 0) + 1;
    db.lastWinner = winner;
    db.lastWonAt = Date.now();
    await saveJackpot(db);
    return amount;
  });
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