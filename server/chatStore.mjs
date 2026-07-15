/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'chat');
const LOBBY_FILE = path.join(ROOT, 'lobby.json');

export const LOBBY_ID = 'main';
export const MAX_MESSAGE_LEN = 280;
/** Stored lobby rows (admin monitor); live terminal shows DISPLAY_HISTORY lines. */
export const MAX_MESSAGES = 2000;
export const MIN_SEND_INTERVAL_MS = 3000;
export const DISPLAY_HISTORY = 30;

const EMPTY_LOBBY = { version: 1, updatedAt: null, messages: [] };

export function newMessageId() {
  return crypto.randomBytes(6).toString('hex');
}

async function ensureLobbyStore() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    await fs.access(LOBBY_FILE);
  } catch {
    const tmp = `${LOBBY_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(EMPTY_LOBBY, null, 2), 'utf8');
    await fs.rename(tmp, LOBBY_FILE);
  }
}

export async function loadLobbyDb() {
  await ensureLobbyStore();
  try {
    const raw = await fs.readFile(LOBBY_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      ...EMPTY_LOBBY,
      ...data,
      messages: Array.isArray(data.messages) ? data.messages : [],
    };
  } catch (err) {
    console.error('[chat] CRITICAL: lobby.json unreadable — refusing empty fallback', err);
    throw new Error('Lobby database unavailable');
  }
}

let lobbyWriteChain = Promise.resolve();

/** Serialize lobby read-modify-write to avoid concurrent POST races. */
export function withLobbyWrite(task) {
  const run = lobbyWriteChain.then(() => task());
  lobbyWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function saveLobbyDb(db) {
  await fs.mkdir(ROOT, { recursive: true });
  db.updatedAt = new Date().toISOString();
  const tmp = `${LOBBY_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, LOBBY_FILE);
}

export function trimMessages(messages) {
  if (messages.length <= MAX_MESSAGES) return messages;
  return messages.slice(-MAX_MESSAGES);
}