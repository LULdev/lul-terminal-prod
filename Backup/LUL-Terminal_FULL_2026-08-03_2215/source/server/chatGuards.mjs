/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ensureActivity } from './auth/achievements.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { MIN_SEND_INTERVAL_MS } from './chatStore.mjs';

export function assertCanChat(user) {
  if (user.role === 'bot') throw new Error('BOT cannot send manual commands');
  if (user.chatBanned) throw new Error('You are banned from the shoutbox');
  if (user.chatMutedUntil && user.chatMutedUntil > Date.now()) {
    const mins = Math.ceil((user.chatMutedUntil - Date.now()) / 60000);
    throw new Error(`You are muted for ${mins} more minute(s)`);
  }
}

/** Ban/mute targets: admin, bot, and VIP accounts are protected. */
export function assertCanModerateShoutboxTarget(user) {
  if (!user) throw new Error('User not found');
  if (user.role === 'admin' || user.role === 'bot' || user.role === 'vip') {
    throw new Error('Cannot moderate this user');
  }
}

export function getActivityFlag(act, key) {
  return Number(act?.flags?.[key]) || 0;
}

export function setActivityFlag(act, key, value) {
  act.flags = { ...(act.flags ?? {}), [key]: value };
}

/** Atomically enforce shoutbox cooldown and reserve the next send slot. */
export async function reserveChatRateLimit(userId) {
  let previousLast = 0;
  await runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    const act = ensureActivity(user);
    const last = getActivityFlag(act, 'lastChatActionAt');
    if (Date.now() - last < MIN_SEND_INTERVAL_MS) {
      throw new Error('Please wait a few seconds before sending another message');
    }
    previousLast = last;
    setActivityFlag(act, 'lastChatActionAt', Date.now());
    user.updatedAt = Date.now();
    await saveUsersDb(db);
  });
  return previousLast;
}

/** Restore cooldown slot when message write fails after reserveChatRateLimit. */
export async function rollbackChatRateLimit(userId, previousLast) {
  await runCoinTransaction(async () => {
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return;
    const act = ensureActivity(user);
    if (previousLast > 0) {
      setActivityFlag(act, 'lastChatActionAt', previousLast);
    } else {
      const flags = { ...(act.flags ?? {}) };
      delete flags.lastChatActionAt;
      act.flags = flags;
    }
    user.updatedAt = Date.now();
    await saveUsersDb(db);
  });
}

/** @deprecated Use reserveChatRateLimit */
export async function checkChatRateLimit(userId) {
  await reserveChatRateLimit(userId);
}

/** @deprecated No-op — reserveChatRateLimit commits the slot */
export async function recordChatRateLimit(_userId) {}

/** @deprecated Use reserveChatRateLimit */
export async function assertChatRateLimit(userId) {
  await reserveChatRateLimit(userId);
}