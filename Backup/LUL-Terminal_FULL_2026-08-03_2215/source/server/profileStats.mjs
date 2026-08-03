/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadLobbyDb, LOBBY_ID } from './chatStore.mjs';
import { loadAccountsDb } from './premiumAccountsStore.mjs';

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Local calendar midnight for "active today" counts (server local timezone). */
export function localDayStart(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function rankLabel(role) {
  return String(role ?? 'user').toUpperCase();
}

export function isUserOnline(user) {
  if (user?.active === false) return false;
  if (user.role === 'bot') return true;
  const lastSeen = Number(user.lastSeenAt) || Number(user.lastLoginAt) || 0;
  if (!lastSeen) return false;
  return Date.now() - lastSeen < ONLINE_WINDOW_MS;
}

export async function countAccountsByCreatorBreakdown(userId) {
  if (!userId) return { premium: 0, free: 0 };
  const db = await loadAccountsDb();
  const mine = db.accounts.filter((a) => a.createdByUserId === userId);
  const premium = mine.filter((a) => a.status === 'working').length;
  const free = mine.filter((a) => a.status === 'working_free').length;
  return { premium, free };
}

export async function countChatMessagesByUser(userId) {
  if (!userId) return 0;
  const db = await loadLobbyDb();
  return db.messages.filter(
    (m) => m.lobby === LOBBY_ID && m.userId === userId && m.role !== 'bot',
  ).length;
}

export async function buildProfileStats(user) {
  if (!user) return null;
  const [{ premium, free }, shoutboxMessages] = await Promise.all([
    countAccountsByCreatorBreakdown(user.id),
    countChatMessagesByUser(user.id),
  ]);
  return {
    premiumAccounts: premium,
    freeAccounts: free,
    abuseWarnings: Math.max(0, Number(user.abuseWarnings) || 0),
    shoutboxMessages,
    isOnline: isUserOnline(user),
    onlineMinutes: Math.max(0, Number(user.onlineMinutes) || 0),
    rank: rankLabel(user.role),
  };
}