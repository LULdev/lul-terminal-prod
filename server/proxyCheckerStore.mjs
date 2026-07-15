/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'proxy-checker');
const STATE_FILE = path.join(ROOT, 'state.json');
const RESULTS_FILE = path.join(ROOT, 'last-results.json');

const EMPTY_STATE = {
  lastCheckAt: null,
  totalChecked: 0,
  alive: 0,
  dead: 0,
  avgLatency: 0,
  databaseAdded: 0,
  databaseUpdated: 0,
};

const EMPTY_RESULTS = { checked: [], summary: null, checkedAt: null };

let checkerWriteChain = Promise.resolve();

export function withProxyCheckerWrite(task) {
  const run = checkerWriteChain.then(() => task());
  checkerWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(file, data) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

async function readJsonOrDefault(file, empty, label) {
  if (!(await fileExists(file))) return structuredClone(empty);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[proxy-checker] CRITICAL: ${label} unreadable`, err);
    throw new Error('Proxy checker data unavailable');
  }
}

export async function ensureStore() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function loadCheckerState() {
  await ensureStore();
  return readJsonOrDefault(STATE_FILE, EMPTY_STATE, 'state.json');
}

export async function saveCheckerState(state) {
  return withProxyCheckerWrite(async () => {
    await ensureStore();
    await atomicWrite(STATE_FILE, state);
  });
}

export async function saveCheckerResults(results) {
  return withProxyCheckerWrite(async () => {
    await ensureStore();
    await atomicWrite(RESULTS_FILE, results);
  });
}

export async function loadCheckerResults() {
  await ensureStore();
  return readJsonOrDefault(RESULTS_FILE, EMPTY_RESULTS, 'last-results.json');
}