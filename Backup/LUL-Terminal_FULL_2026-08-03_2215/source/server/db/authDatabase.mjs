/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
  sessionToStorageRow,
  storageRowToSession,
  storageRowToUser,
  userToStorageRow,
} from './userRecord.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_DB_DIR = path.join(__dirname, '..', '..', 'data', 'auth');
export const AUTH_DB_FILE = path.join(AUTH_DB_DIR, 'lul-auth.sqlite');
const LEGACY_USERS_FILE = path.join(AUTH_DB_DIR, 'users.json');
const LEGACY_SESSIONS_FILE = path.join(AUTH_DB_DIR, 'sessions.json');

let dbInstance = null;

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE,
      email TEXT NOT NULL COLLATE NOCASE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      payload TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      remember INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);
}

function maybeMigrateLegacyJson(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;
  if (process.env.AUTH_MIGRATE_JSON !== '1') return;
  if (!fs.existsSync(LEGACY_USERS_FILE)) return;

  try {
    const raw = fs.readFileSync(LEGACY_USERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    const users = Array.isArray(data.users) ? data.users : [];
    if (!users.length) return;

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, role, password_hash, active, payload, updated_at)
      VALUES (@id, @username, @email, @role, @password_hash, @active, @payload, @updated_at)
    `);
    const writeUsers = db.transaction((list) => {
      for (const user of list) {
        const row = userToStorageRow(user);
        insertUser.run({ ...row, updated_at: new Date().toISOString() });
      }
    });
    writeUsers(users);
    console.warn(`[auth-db] Migrated ${users.length} users from users.json (AUTH_MIGRATE_JSON=1)`);

    if (fs.existsSync(LEGACY_SESSIONS_FILE)) {
      const sessionsRaw = fs.readFileSync(LEGACY_SESSIONS_FILE, 'utf8');
      const sessionsData = JSON.parse(sessionsRaw);
      const sessions = Array.isArray(sessionsData.sessions) ? sessionsData.sessions : [];
      const insertSession = db.prepare(`
        INSERT INTO sessions (token, user_id, remember, expires_at, created_at, payload)
        VALUES (@token, @user_id, @remember, @expires_at, @created_at, @payload)
      `);
      const writeSessions = db.transaction((list) => {
        for (const session of list) {
          insertSession.run(sessionToStorageRow(session));
        }
      });
      if (sessions.length) {
        writeSessions(sessions);
        console.warn(`[auth-db] Migrated ${sessions.length} sessions from sessions.json`);
      }
    }
  } catch (err) {
    console.error('[auth-db] Legacy JSON migration failed', err);
  }
}

export function getAuthDatabase() {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(AUTH_DB_DIR, { recursive: true });
  dbInstance = new Database(AUTH_DB_FILE);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  initSchema(dbInstance);
  maybeMigrateLegacyJson(dbInstance);
  return dbInstance;
}

export function readUsersDbShape() {
  const db = getAuthDatabase();
  const rows = db.prepare('SELECT * FROM users ORDER BY username ASC').all();
  const users = rows.map(storageRowToUser);
  const updatedAt = db.prepare("SELECT value FROM meta WHERE key = 'users_updated_at'").get()?.value ?? null;
  return { version: 2, updatedAt, users };
}

export function writeUsersDbShape(dbShape) {
  const db = getAuthDatabase();
  const updatedAt = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO users (id, username, email, role, password_hash, active, payload, updated_at)
    VALUES (@id, @username, @email, @role, @password_hash, @active, @payload, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      email = excluded.email,
      role = excluded.role,
      password_hash = excluded.password_hash,
      active = excluded.active,
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);
  const writeAll = db.transaction((users) => {
    const ids = users.map((u) => u.id);
    if (ids.length === 0) {
      db.prepare('DELETE FROM users').run();
    } else {
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM users WHERE id NOT IN (${placeholders})`).run(...ids);
    }
    for (const user of users) {
      const row = userToStorageRow(user);
      upsert.run({ ...row, updated_at: updatedAt });
    }
    db.prepare(`
      INSERT INTO meta (key, value) VALUES ('users_updated_at', @value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run({ value: updatedAt });
  });
  writeAll(dbShape.users);
  return { ...dbShape, updatedAt };
}

export function readSessionsDbShape() {
  const db = getAuthDatabase();
  const rows = db.prepare('SELECT * FROM sessions ORDER BY created_at ASC').all();
  return { version: 2, sessions: rows.map(storageRowToSession) };
}

export function writeSessionsDbShape(dbShape) {
  const db = getAuthDatabase();
  const insert = db.prepare(`
    INSERT INTO sessions (token, user_id, remember, expires_at, created_at, payload)
    VALUES (@token, @user_id, @remember, @expires_at, @created_at, @payload)
  `);
  const writeAll = db.transaction((sessions) => {
    db.prepare('DELETE FROM sessions').run();
    for (const session of sessions) {
      insert.run(sessionToStorageRow(session));
    }
  });
  writeAll(dbShape.sessions);
  return dbShape;
}

export function clearAuthDatabase() {
  const db = getAuthDatabase();
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM users').run();
  db.prepare("DELETE FROM meta WHERE key = 'users_updated_at'").run();
}