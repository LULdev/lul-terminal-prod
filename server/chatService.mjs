/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LOBBY_ID,
  DISPLAY_HISTORY,
  loadLobbyDb,
  saveLobbyDb,
  trimMessages,
  withLobbyWrite,
} from './chatStore.mjs';
import { PINNED_WELCOME } from './chatBot.mjs';
import { executeChatCommand } from './chatCommands.mjs';
import { loadUsersDb } from './auth/authStore.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { assertCanModerateShoutboxTarget } from './chatGuards.mjs';

import { sanitizeAvatarUrl } from './auth/safeMediaUrl.mjs';

function avatarFallback(username) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username ?? 'user')}`;
}

const EMOTE_TOKEN_RE = /:[A-Za-z][A-Za-z0-9_]*:/;

async function publicMessage(msg, userById, userByName) {
  const hit = userById?.get(msg.userId) ?? userByName?.get(msg.username);
  let avatarUrl = sanitizeAvatarUrl(msg.avatarUrl ?? hit?.avatarUrl) || avatarFallback(msg.username);
  const verified = msg.verified != null ? Boolean(msg.verified) : Boolean(hit?.verified);
  let segments = msg.segments ?? null;
  if (!segments && EMOTE_TOKEN_RE.test(String(msg.text ?? ''))) {
    const { buildEmoteSegments } = await import('./chatEmoteSegments.mjs');
    segments = await buildEmoteSegments(msg.text);
  }
  return {
    id: msg.id,
    lobby: msg.lobby,
    userId: msg.userId,
    username: msg.username,
    displayName: msg.displayName,
    role: msg.role,
    verified,
    avatarUrl,
    kind: msg.kind ?? 'chat',
    text: msg.text,
    segments,
    createdAt: msg.createdAt,
  };
}

async function buildUserLookups() {
  const db = await loadUsersDb();
  const byId = new Map();
  const byName = new Map();
  for (const u of db.users) {
    if (u.id) byId.set(u.id, u);
    if (u.username) byName.set(u.username, u);
  }
  return { byId, byName };
}

export async function listLobbyMessages({ since = 0, limit = DISPLAY_HISTORY } = {}) {
  const [db, lookups] = await Promise.all([loadLobbyDb(), buildUserLookups()]);
  const sinceTs = Math.max(0, Number(since) || 0);
  const cap = Math.min(120, Math.max(1, Number(limit) || DISPLAY_HISTORY));
  let list = db.messages.filter((m) => m.lobby === LOBBY_ID);

  if (sinceTs > 0) {
    // Inclusive since — client dedupes by id; strict > dropped same-ms burst messages.
    list = list.filter((m) => m.createdAt >= sinceTs);
    list = list.slice(-cap);
  } else {
    list = list.slice(-cap);
  }

  const messages = await Promise.all(list.map((m) => publicMessage(m, lookups.byId, lookups.byName)));

  return {
    lobby: LOBBY_ID,
    pinned: PINNED_WELCOME,
    messages,
    updatedAt: db.updatedAt,
  };
}

export async function postLobbyMessage(user, text) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('Message cannot be empty');
  return executeChatCommand(user, body);
}

const SHOUTBOX_KINDS = new Set(['chat', 'bot', 'system', 'action', 'ping', 'achievement', 'pinned']);

function normalizeShoutboxUsername(raw) {
  return String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function buildTopChatters(allLobby, lookups) {
  const counts = new Map();
  for (const m of allLobby) {
    if (m.role === 'bot' || m.kind === 'pinned') continue;
    const uname = normalizeShoutboxUsername(m.username);
    if (!uname) continue;
    counts.set(uname, (counts.get(uname) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([username, count]) => {
      const user = lookups.byName.get(username);
      return {
        username,
        count,
        displayName: user?.displayName ?? username,
        role: user?.role ?? 'user',
        verified: Boolean(user?.verified),
        chatBanned: Boolean(user?.chatBanned),
        chatMutedUntil: user?.chatMutedUntil ? Number(user.chatMutedUntil) : null,
      };
    });
}

export async function adminListAllMessages({ limit = 200, q, kind, username } = {}) {
  const [db, lookups] = await Promise.all([loadLobbyDb(), buildUserLookups()]);
  const cap = Math.min(500, Math.max(1, Number(limit) || 200));
  const allLobby = db.messages.filter((m) => m.lobby === LOBBY_ID);
  let list = [...allLobby];

  const kindFilter = String(kind ?? '').trim().toLowerCase();
  if (kindFilter && kindFilter !== 'all' && SHOUTBOX_KINDS.has(kindFilter)) {
    list = list.filter((m) => (m.kind ?? 'chat') === kindFilter);
  }

  const userFilter = normalizeShoutboxUsername(username);
  if (userFilter) {
    list = list.filter((m) => normalizeShoutboxUsername(m.username) === userFilter);
  }

  const query = q ? String(q).trim().slice(0, 80) : '';
  if (query) {
    const needle = query.toLowerCase();
    list = list.filter(
      (m) =>
        (m.text ?? '').toLowerCase().includes(needle) ||
        (m.username ?? '').toLowerCase().includes(needle) ||
        (m.displayName ?? '').toLowerCase().includes(needle) ||
        (m.id ?? '').toLowerCase().includes(needle),
    );
  }

  list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const messages = await Promise.all(
    list.slice(0, cap).map((m) => publicMessage(m, lookups.byId, lookups.byName)),
  );

  const uniqueUsers = new Set(
    allLobby.filter((m) => m.role !== 'bot').map((m) => m.username).filter(Boolean),
  ).size;

  return {
    lobby: LOBBY_ID,
    total: list.length,
    messages,
    updatedAt: db.updatedAt,
    stats: {
      stored: allLobby.length,
      uniqueUsers,
      byKind: allLobby.reduce((acc, m) => {
        const k = m.kind ?? 'chat';
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    },
    topChatters: buildTopChatters(allLobby, lookups),
  };
}

export async function adminDeleteMessage(id) {
  const needle = String(id ?? '').trim();
  if (!needle) throw new Error('Message id required');

  return withLobbyWrite(async () => {
    const db = await loadLobbyDb();
    const before = db.messages.length;
    db.messages = db.messages.filter((m) => m.id !== needle);
    if (db.messages.length === before) throw new Error('Message not found');

    db.messages = trimMessages(db.messages);
    await saveLobbyDb(db);
    return { ok: true, id: needle, removed: 1 };
  });
}

export async function adminBulkDeleteMessages(ids) {
  const list = (Array.isArray(ids) ? ids : [])
    .map((id) => String(id ?? '').trim())
    .filter((id) => /^[a-f0-9]{12}$/.test(id));
  if (!list.length) throw new Error('Valid message ids required');
  if (list.length > 50) throw new Error('Max 50 messages per batch');

  return withLobbyWrite(async () => {
    const db = await loadLobbyDb();
    const drop = new Set(list);
    const before = db.messages.length;
    db.messages = db.messages.filter((m) => !drop.has(m.id));
    const removed = before - db.messages.length;
    if (!removed) throw new Error('No messages found');
    db.messages = trimMessages(db.messages);
    await saveLobbyDb(db);
    return { ok: true, removed, ids: list };
  });
}

export async function adminClearLobby(actorUsername) {
  const actor = String(actorUsername ?? 'admin').trim().slice(0, 32) || 'admin';
  const { pushBotMessageInWrite } = await import('./chatBot.mjs');
  return withLobbyWrite(async () => {
    const db = await loadLobbyDb();
    const before = db.messages.filter((m) => m.lobby === LOBBY_ID).length;
    db.messages = db.messages.filter((m) => m.lobby !== LOBBY_ID);
    await pushBotMessageInWrite(db, {
      text: `Shoutbox cleared by @${actor} (admin monitor)`,
      kind: 'system',
    });
    return { ok: true, cleared: before };
  });
}

export async function adminBroadcastBot(text) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('Message required');
  if (body.length > 280) throw new Error('Message too long (max 280)');
  const { postBotMessage } = await import('./chatBot.mjs');
  const message = await postBotMessage({ text: body, kind: 'bot' });
  return { ok: true, message };
}

export async function adminModerateShoutboxUser(actor, { action, username, minutes } = {}) {
  if (!actor || !canAccessAdmin(actor)) throw new Error('Admin only');
  const uname = normalizeShoutboxUsername(username);
  if (!uname) throw new Error('Username required');
  const act = String(action ?? '').trim().toLowerCase();
  const actorUname = normalizeShoutboxUsername(actor.username);
  if ((act === 'ban' || act === 'mute') && actorUname === uname) {
    throw new Error('Cannot moderate yourself');
  }

  const { loadUsersDb, saveUsersDb, withUsersWrite } = await import('./auth/authStore.mjs');
  const { blockRegistrationSignalsForUser, unblockRegistrationSignalsForUser } = await import('./auth/registrationRegistry.mjs');
  const { revokeUserSessions } = await import('./auth/authService.mjs');
  const { incrementAbuseWarnings } = await import('./chatStats.mjs');
  const { postBotMessage } = await import('./chatBot.mjs');

  const target = await withUsersWrite(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.username === uname);
    if (!user) throw new Error('User not found');

    const now = Date.now();
    if (act === 'ban') {
      assertCanModerateShoutboxTarget(user);
      user.chatBanned = true;
      user.registrationBlocked = true;
      user.chatMutedUntil = null;
      user.updatedAt = now;
      await saveUsersDb(db);
      return { user, botText: `@${user.username} was banned from shoutbox by @${actor.username}` };
    }
    if (act === 'unban') {
      user.chatBanned = false;
      user.registrationBlocked = false;
      user.updatedAt = now;
      await saveUsersDb(db);
      return { user, botText: `@${user.username} was unbanned by @${actor.username}` };
    }
    if (act === 'mute') {
      assertCanModerateShoutboxTarget(user);
      const mins = Math.min(1440, Math.max(1, Number(minutes) || 30));
      user.chatMutedUntil = now + mins * 60 * 1000;
      user.updatedAt = now;
      await saveUsersDb(db);
      return { user, botText: `@${user.username} was muted for ${mins}m by @${actor.username}` };
    }
    if (act === 'unmute') {
      user.chatMutedUntil = null;
      user.updatedAt = now;
      await saveUsersDb(db);
      return { user, botText: `@${user.username} was unmuted by @${actor.username}` };
    }
    throw new Error('Unknown action');
  });

  if (act === 'ban') {
    const userId = target.user.id;
    await revokeUserSessions(userId);
    const { leaveAllGameQueues } = await import('./gamesService.mjs');
    const cleanup = await leaveAllGameQueues(userId);
    const { refundOrphanEscrowsAfterCleanup } = await import('./auth/authService.mjs');
    await refundOrphanEscrowsAfterCleanup(userId, cleanup);
    await blockRegistrationSignalsForUser(target.user);
    await incrementAbuseWarnings(userId, 1);
  } else if (act === 'unban') {
    await unblockRegistrationSignalsForUser(target.user);
  }

  await postBotMessage({ text: target.botText, kind: 'system' });
  return { ok: true, action: act, username: uname };
}