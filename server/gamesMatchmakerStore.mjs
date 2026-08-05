/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Durable arcade matchmaker (queue / rooms / activeMatches / room tombstones).
 * File-backed under data/games/matchmaker/ with cross-process locks so multi-PM2
 * workers on one host share state. Re-entrant withMatchmakerWrite (ALS).
 *
 * Lock order: matchmaker (this) OUTERMOST, then users coin lock (runCoinTransaction).
 * Never acquire matchmaker while holding users write.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { withCrossProcessLock } from './fileLock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'games', 'matchmaker');

const mmByGameId = new Map();
const writeChainByGame = new Map();
const mmWriteAls = new AsyncLocalStorage();

function emptyShape(gameId) {
  return {
    gameId: String(gameId),
    queue: [],
    rooms: new Map(),
    consumedRooms: new Map(),
    activeMatches: new Map(),
  };
}

function serializeMatch(m) {
  if (!m || typeof m !== 'object') return m;
  const o = { ...m };
  if (o._releasedStakeByUserId && typeof o._releasedStakeByUserId === 'object') {
    o._releasedStakeByUserId = { ...o._releasedStakeByUserId };
  }
  if (o._expireCreditUserIds instanceof Set) {
    o._expireCreditUserIds = [...o._expireCreditUserIds];
  }
  return o;
}

function deserializeMatch(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const o = { ...raw };
  if (Array.isArray(o._expireCreditUserIds)) {
    o._expireCreditUserIds = new Set(o._expireCreditUserIds);
  }
  return o;
}

function serializeMm(mm) {
  return {
    version: 1,
    gameId: mm.gameId,
    updatedAt: Date.now(),
    queue: Array.isArray(mm.queue) ? mm.queue.map((e) => ({ ...e })) : [],
    rooms: Object.fromEntries(
      [...(mm.rooms?.entries?.() ?? [])].map(([k, v]) => [k, { ...v }]),
    ),
    consumedRooms: Object.fromEntries(
      [...(mm.consumedRooms?.entries?.() ?? [])].map(([k, v]) => [k, Number(v) || 0]),
    ),
    activeMatches: Object.fromEntries(
      [...(mm.activeMatches?.entries?.() ?? [])].map(([k, v]) => [k, serializeMatch(v)]),
    ),
  };
}

function applyDiskToMm(mm, data) {
  mm.queue.length = 0;
  if (Array.isArray(data?.queue)) {
    for (const e of data.queue) mm.queue.push({ ...e });
  }
  mm.rooms.clear();
  if (data?.rooms && typeof data.rooms === 'object') {
    for (const [k, v] of Object.entries(data.rooms)) {
      mm.rooms.set(k, { ...v });
    }
  }
  mm.consumedRooms.clear();
  if (data?.consumedRooms && typeof data.consumedRooms === 'object') {
    for (const [k, v] of Object.entries(data.consumedRooms)) {
      mm.consumedRooms.set(k, Number(v) || 0);
    }
  }
  mm.activeMatches.clear();
  if (data?.activeMatches && typeof data.activeMatches === 'object') {
    for (const [k, v] of Object.entries(data.activeMatches)) {
      mm.activeMatches.set(k, deserializeMatch(v));
    }
  }
}

function filePath(gameId) {
  const safe = String(gameId).replace(/[^a-z0-9_-]/gi, '').slice(0, 48) || 'unknown';
  return path.join(ROOT, `${safe}.json`);
}

async function readDisk(gameId) {
  try {
    const raw = await fs.readFile(filePath(gameId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeDisk(gameId, mm) {
  await fs.mkdir(ROOT, { recursive: true });
  const file = filePath(gameId);
  const tmp = `${file}.tmp`;
  const payload = JSON.stringify(serializeMm(mm), null, 2);
  await fs.writeFile(tmp, payload, 'utf8');
  await fs.rename(tmp, file);
}

/**
 * Create or return the process-local matchmaker shell for a game.
 * State is hydrated from disk on withMatchmakerWrite / hydrateMatchmaker.
 */
export function createMatchmaker(gameId) {
  if (!gameId) {
    throw new Error('createMatchmaker(gameId) requires a game id');
  }
  const id = String(gameId);
  const existing = mmByGameId.get(id);
  if (existing) return existing;
  const mm = emptyShape(id);
  mmByGameId.set(id, mm);
  return mm;
}

export function getMatchmaker(gameId) {
  return mmByGameId.get(String(gameId)) ?? null;
}

export function listRegisteredMatchmakerGameIds() {
  return [...mmByGameId.keys()];
}

/** True while inside withMatchmakerWrite for any game. */
export function isInsideMatchmakerWrite() {
  return Boolean(mmWriteAls.getStore());
}

/**
 * Serialize matchmaker mutations for one game across processes.
 * Reloads disk → task(mm) → persists. Re-entrant for nested settle/expire.
 * Never call while holding withUsersWrite (lock order: matchmaker outer, users inner).
 */
export function withMatchmakerWrite(mmOrGameId, task) {
  return withMatchmakerAccess(mmOrGameId, task, { write: true });
}

/**
 * Lock + reload from disk + run task. Writes only when `opts.write` is true
 * (default true for withMatchmakerWrite). Use write:false for session checks /
 * polls that must not thrash disk or nest under users write incorrectly.
 */
export function withMatchmakerAccess(mmOrGameId, task, { write = true } = {}) {
  const gameId = typeof mmOrGameId === 'string'
    ? String(mmOrGameId)
    : String(mmOrGameId?.gameId ?? '');
  if (!gameId) {
    return Promise.resolve().then(() => task(mmOrGameId));
  }

  const store = mmWriteAls.getStore();
  if (store?.gameId === gameId) {
    const mm = store.mm ?? createMatchmaker(gameId);
    return Promise.resolve().then(() => task(mm));
  }

  const mm = createMatchmaker(gameId);
  let chain = writeChainByGame.get(gameId) ?? Promise.resolve();
  const run = chain.then(() =>
    withCrossProcessLock(
      `matchmaker-${gameId}`,
      async () => {
        const disk = await readDisk(gameId);
        if (disk) applyDiskToMm(mm, disk);
        return mmWriteAls.run({ gameId, mm }, async () => {
          const result = await task(mm);
          if (write) await writeDisk(gameId, mm);
          return result;
        });
      },
      { maxWaitMs: 15_000 },
    ),
  );
  writeChainByGame.set(
    gameId,
    run.then(() => undefined, () => undefined),
  );
  return run;
}

/** Read-only hydrate (no writeDisk). Safe for multi-worker refresh without thrash. */
export function withMatchmakerRead(mmOrGameId, task) {
  return withMatchmakerAccess(mmOrGameId, task, { write: false });
}

/** Hydrate from disk under lock (no-op mutate). Call before session checks / boot. */
export async function hydrateMatchmaker(gameId) {
  return withMatchmakerRead(gameId, async (mm) => mm);
}

/** Hydrate every registered matchmaker (import game modules first). Sorted lock order. */
export async function hydrateAllMatchmakers() {
  const ids = listRegisteredMatchmakerGameIds().sort();
  for (const id of ids) {
    await hydrateMatchmaker(id).catch((e) => {
      console.error('[games] matchmaker hydrate failed', id, e);
    });
  }
  return ids.length;
}

/**
 * True if user is in any registered matchmaker queue or non-done match.
 * In-memory only — call after hydrateAllMatchmakers when freshness matters.
 * Safe under users write lock (no matchmaker acquisition).
 */
export function userInAnyMatchmakerSession(userId) {
  if (!userId) return false;
  for (const mm of mmByGameId.values()) {
    if (mm.queue.some((q) => q.userId === userId)) return true;
    for (const m of mm.activeMatches.values()) {
      if (m.status === 'done') continue;
      if (m.player1?.userId === userId || m.player2?.userId === userId) return true;
    }
  }
  return false;
}

/** In-memory: queue or playing match on a game other than exceptGameId. */
export function userInOtherMatchmakerSession(userId, exceptGameId) {
  if (!userId) return false;
  const except = exceptGameId ? String(exceptGameId) : null;
  for (const [id, mm] of mmByGameId.entries()) {
    if (except && id === except) continue;
    if (mm.queue.some((q) => q.userId === userId)) return true;
    for (const m of mm.activeMatches.values()) {
      if (m.status === 'done') continue;
      if (m.player1?.userId === userId || m.player2?.userId === userId) return true;
    }
  }
  return false;
}
