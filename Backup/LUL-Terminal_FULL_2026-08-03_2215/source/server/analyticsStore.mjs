/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'analytics');
const EVENTS_FILE = path.join(ROOT, 'events.json');
const AGGREGATES_FILE = path.join(ROOT, 'aggregates.json');

export const MAX_EVENTS = 8000;

const EMPTY_EVENTS = { version: 1, updatedAt: null, events: [] };
const EMPTY_AGGREGATES = {
  version: 1,
  updatedAt: null,
  tabHits: {},
  eventCounts: {},
  daily: {},
};

async function ensureStore() {
  await fs.mkdir(ROOT, { recursive: true });
  for (const [file, empty] of [
    [EVENTS_FILE, EMPTY_EVENTS],
    [AGGREGATES_FILE, EMPTY_AGGREGATES],
  ]) {
    try {
      await fs.access(file);
    } catch {
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(empty, null, 2), 'utf8');
      await fs.rename(tmp, file);
    }
  }
}

async function readJson(file, fallback) {
  await ensureStore();
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    try {
      await fs.access(file);
      throw new Error(`Corrupt analytics store: ${path.basename(file)}`);
    } catch (accessErr) {
      if (accessErr instanceof Error && accessErr.message.startsWith('Corrupt analytics store')) {
        throw accessErr;
      }
      return structuredClone(fallback);
    }
  }
}

async function writeJson(file, data) {
  await ensureStore();
  data.updatedAt = new Date().toISOString();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

let analyticsWriteChain = Promise.resolve();

export function withAnalyticsWrite(task) {
  const run = analyticsWriteChain.then(() => task());
  analyticsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function loadEventsDb() {
  const db = await readJson(EVENTS_FILE, EMPTY_EVENTS);
  db.events = Array.isArray(db.events) ? db.events : [];
  return db;
}

export async function saveEventsDb(db) {
  await writeJson(EVENTS_FILE, db);
}

export async function loadAggregatesDb() {
  const db = await readJson(AGGREGATES_FILE, EMPTY_AGGREGATES);
  db.tabHits = db.tabHits && typeof db.tabHits === 'object' ? db.tabHits : {};
  db.eventCounts = db.eventCounts && typeof db.eventCounts === 'object' ? db.eventCounts : {};
  db.daily = db.daily && typeof db.daily === 'object' ? db.daily : {};
  return db;
}

export async function saveAggregatesDb(db) {
  await writeJson(AGGREGATES_FILE, db);
}