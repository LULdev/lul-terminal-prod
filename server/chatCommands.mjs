/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sanitizeAvatarUrl } from './auth/safeMediaUrl.mjs';
import {
  LOBBY_ID,
  newMessageId,
  loadLobbyDb,
  saveLobbyDb,
  trimMessages,
  withLobbyWrite,
  MAX_MESSAGE_LEN,
} from './chatStore.mjs';
import {
  assertCanChat,
  assertCanModerateShoutboxTarget,
  reserveChatRateLimit,
  rollbackChatRateLimit,
  getActivityFlag,
  setActivityFlag,
} from './chatGuards.mjs';
import { syncAchievementsOnLoadedUser } from './auth/authService.mjs';
import { ensureActivity } from './auth/achievements.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { loadUsersDb, saveUsersDb, withUsersWrite } from './auth/authStore.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { getBotUser, postBotMessage, pushBotMessageInWrite } from './chatBot.mjs';

const HELP_TEXT = [
  'Type normally to chat — no /say needed',
  '/me <action> — emote action',
  '/ping <username> — notify a user',
  '/who — recent chatters',
  '/help — this list',
  'Admin: /bot <msg> · /ban /unban /mute /unmute /clear',
].join('\n');

function normalizeUname(raw) {
  return String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function publicMessage(msg) {
  return {
    id: msg.id,
    lobby: msg.lobby,
    userId: msg.userId,
    username: msg.username,
    displayName: msg.displayName,
    role: msg.role,
    verified: Boolean(msg.verified),
    avatarUrl: msg.avatarUrl ?? null,
    kind: msg.kind ?? 'chat',
    text: msg.text,
    segments: msg.segments ?? null,
    createdAt: msg.createdAt,
  };
}

async function pushChatMessage(user, { text, kind = 'chat', segments = null }) {
  return withLobbyWrite(async () => {
    const db = await loadLobbyDb();
    const now = Date.now();
    const trimmed = String(text).trim();
    let resolvedSegments = segments;
    if (!resolvedSegments) {
      const { buildEmoteSegments } = await import('./chatEmoteSegments.mjs');
      resolvedSegments = await buildEmoteSegments(trimmed);
    }

    const message = {
      id: newMessageId(),
      lobby: LOBBY_ID,
      userId: user.id,
      username: user.username,
      displayName: String(user.displayName ?? user.username).trim().slice(0, 64) || user.username,
      role: user.role ?? 'user',
      verified: Boolean(user.verified),
      avatarUrl: sanitizeAvatarUrl(user.avatarUrl) || null,
      kind,
      text: trimmed,
      segments: resolvedSegments,
      createdAt: now,
    };

    db.messages.push(message);
    db.messages = trimMessages(db.messages);
    await saveLobbyDb(db);
    return publicMessage(message);
  });
}

async function findUserByUsername(username) {
  const db = await loadUsersDb();
  const uname = normalizeUname(username);
  if (!uname) return null;
  return db.users.find((u) => u.username === uname) ?? null;
}

async function cmdSay(actor, args, kind = 'chat') {
  const text = args.join(' ').trim();
  if (!text) throw new Error('Usage: /say <message>');
  if (text.length > MAX_MESSAGE_LEN) throw new Error(`Message too long (max ${MAX_MESSAGE_LEN})`);
  return pushChatMessage(actor, { text, kind });
}

async function cmdMe(actor, args) {
  const action = args.join(' ').trim();
  if (!action) throw new Error('Usage: /me <action>');
  const display = String(actor.displayName ?? actor.username);
  const text = `* ${display} ${action}`;
  if (text.length > MAX_MESSAGE_LEN) throw new Error(`Message too long (max ${MAX_MESSAGE_LEN})`);
  return pushChatMessage(actor, {
    text,
    kind: 'action',
  });
}

async function cmdPing(actor, args) {
  const targetName = args[0];
  if (!targetName) throw new Error('Usage: /ping <username>');
  const target = await findUserByUsername(targetName);
  if (!target) throw new Error('User not found');
  const from = String(actor.displayName ?? actor.username);
  const to = String(target.displayName ?? target.username);
  return pushChatMessage(actor, {
    text: `${from} pinged @${target.username}`,
    kind: 'ping',
    segments: [
      { type: 'text', text: `${from} pinged ` },
      { type: 'user', username: target.username, href: `/profile/${target.username}`, label: `@${target.username}` },
    ],
  });
}

async function cmdWho() {
  const db = await loadLobbyDb();
  const recent = db.messages
    .filter((m) => m.lobby === LOBBY_ID && m.kind !== 'pinned')
    .slice(-40);
  const seen = new Map();
  for (const m of [...recent].reverse()) {
    if (m.role === 'bot') continue;
    if (!seen.has(m.username)) seen.set(m.username, m.displayName);
  }
  const list = [...seen.entries()].map(([u, d]) => `@${u} (${d})`).join(', ') || 'nobody yet';
  return postBotMessage({
    text: `Recent chatters: ${list}`,
    kind: 'system',
  });
}

async function cmdBan(actor, args) {
  if (!canAccessAdmin(actor)) throw new Error('Admin only');
  const uname = normalizeUname(args[0]);
  if (!uname) throw new Error('Usage: /ban <username>');
  if (uname === normalizeUname(actor.username)) throw new Error('Cannot ban yourself');
  const target = await withUsersWrite(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.username === uname);
    if (!user) throw new Error('User not found');
    assertCanModerateShoutboxTarget(user);
    user.chatBanned = true;
    user.registrationBlocked = true;
    user.chatMutedUntil = null;
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return user;
  });
  const { revokeUserSessions } = await import('./auth/authService.mjs');
  await revokeUserSessions(target.id);
  const { leaveAllGameQueues } = await import('./gamesService.mjs');
  const cleanup = await leaveAllGameQueues(target.id);
  const { refundOrphanEscrowsAfterCleanup } = await import('./auth/authService.mjs');
  await refundOrphanEscrowsAfterCleanup(target.id, cleanup);
  const { blockRegistrationSignalsForUser } = await import('./auth/registrationRegistry.mjs');
  await blockRegistrationSignalsForUser(target);
  const { incrementAbuseWarnings } = await import('./chatStats.mjs');
  await incrementAbuseWarnings(target.id, 1);
  return postBotMessage({
    text: `@${target.username} was banned from shoutbox by @${actor.username}`,
    kind: 'system',
  });
}

async function cmdUnban(actor, args) {
  if (!canAccessAdmin(actor)) throw new Error('Admin only');
  const uname = normalizeUname(args[0]);
  if (!uname) throw new Error('Usage: /unban <username>');
  const target = await withUsersWrite(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.username === uname);
    if (!user) throw new Error('User not found');
    user.chatBanned = false;
    user.registrationBlocked = false;
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return user;
  });
  const { unblockRegistrationSignalsForUser } = await import('./auth/registrationRegistry.mjs');
  await unblockRegistrationSignalsForUser(target);
  return postBotMessage({
    text: `@${target.username} was unbanned by @${actor.username}`,
    kind: 'system',
  });
}

async function cmdMute(actor, args) {
  if (!canAccessAdmin(actor)) throw new Error('Admin only');
  const uname = normalizeUname(args[0]);
  if (!uname) throw new Error('Usage: /mute <username> [minutes]');
  if (uname === normalizeUname(actor.username)) throw new Error('Cannot mute yourself');
  const mins = Math.min(1440, Math.max(1, Number(args[1]) || 30));
  const target = await withUsersWrite(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.username === uname);
    if (!user) throw new Error('User not found');
    assertCanModerateShoutboxTarget(user);
    user.chatMutedUntil = Date.now() + mins * 60 * 1000;
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return user;
  });
  return postBotMessage({
    text: `@${target.username} was muted for ${mins}m by @${actor.username}`,
    kind: 'system',
  });
}

async function cmdUnmute(actor, args) {
  if (!canAccessAdmin(actor)) throw new Error('Admin only');
  const uname = normalizeUname(args[0]);
  if (!uname) throw new Error('Usage: /unmute <username>');
  const target = await withUsersWrite(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.username === uname);
    if (!user) throw new Error('User not found');
    user.chatMutedUntil = null;
    user.updatedAt = Date.now();
    await saveUsersDb(db);
    return user;
  });
  return postBotMessage({
    text: `@${target.username} was unmuted by @${actor.username}`,
    kind: 'system',
  });
}

async function cmdClear(actor) {
  if (!canAccessAdmin(actor)) throw new Error('Admin only');
  return withLobbyWrite(async () => {
    const db = await loadLobbyDb();
    db.messages = db.messages.filter((m) => m.lobby !== LOBBY_ID);
    return pushBotMessageInWrite(db, {
      text: `Shoutbox cleared by @${actor.username}`,
      kind: 'system',
    });
  });
}

async function cmdHelp(actor) {
  const extra = canAccessAdmin(actor) ? '\nAdmin: /bot <message> posts as BOT.' : '';
  return postBotMessage({
    text: HELP_TEXT + extra,
    kind: 'system',
  });
}

async function cmdBotAs(actor, args) {
  if (!canAccessAdmin(actor)) throw new Error('Admin only');
  const text = args.join(' ').trim();
  if (!text) throw new Error('Usage: /bot <message>');
  if (text.length > MAX_MESSAGE_LEN) throw new Error(`Message too long (max ${MAX_MESSAGE_LEN})`);
  const bot = await getBotUser();
  return pushChatMessage(bot, { text, kind: 'bot' });
}

export async function executeChatCommand(user, rawText) {
  const body = String(rawText ?? '').trim();
  if (!body) throw new Error('Message cannot be empty');

  assertCanChat(user);

  if (!body.startsWith('/')) {
    if (body.length > MAX_MESSAGE_LEN) throw new Error(`Message too long (max ${MAX_MESSAGE_LEN})`);
    const prevCooldown = await reserveChatRateLimit(user.id);
    try {
      return await pushChatMessage(user, { text: body, kind: 'chat' });
    } catch (e) {
      await rollbackChatRateLimit(user.id, prevCooldown);
      throw e;
    }
  }

  const withoutSlash = body.slice(1).trim();
  if (!withoutSlash) throw new Error('Type /help for available commands');

  const spaceIdx = withoutSlash.indexOf(' ');
  const cmd = (spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx)).toLowerCase();
  const rest = spaceIdx === -1 ? '' : withoutSlash.slice(spaceIdx + 1).trim();
  const args = rest ? rest.split(/\s+/) : [];

  const runCmd = async (fn) => {
    const prevCooldown = await reserveChatRateLimit(user.id);
    try {
      return await fn();
    } catch (e) {
      await rollbackChatRateLimit(user.id, prevCooldown);
      throw e;
    }
  };

  switch (cmd) {
    case 'say':
    case 'msg':
    case 'shout':
      return runCmd(() => cmdSay(user, args.length ? args : [rest]));
    case 'bot':
      return runCmd(() => cmdBotAs(user, args.length ? args : (rest ? [rest] : [])));
    case 'me':
    case 'action':
      return runCmd(() => cmdMe(user, args));
    case 'ping':
      return runCmd(() => cmdPing(user, args));
    case 'who':
      return runCmd(() => cmdWho());
    case 'help':
    case 'commands':
      return runCmd(() => cmdHelp(user));
    case 'ban':
      return runCmd(() => cmdBan(user, args));
    case 'unban':
      return runCmd(() => cmdUnban(user, args));
    case 'mute':
      return runCmd(() => cmdMute(user, args));
    case 'unmute':
      return runCmd(() => cmdUnmute(user, args));
    case 'clear':
      return runCmd(() => cmdClear(user));
    default:
      throw new Error(`Unknown command /${cmd} — type /help`);
  }
}