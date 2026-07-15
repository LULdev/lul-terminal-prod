/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PREMIUM_CATEGORY_LABELS, resolveAchievementChat } from './chatConstants.mjs';
import {
  LOBBY_ID,
  newMessageId,
  loadLobbyDb,
  saveLobbyDb,
  trimMessages,
  withLobbyWrite,
  MIN_SEND_INTERVAL_MS,
} from './chatStore.mjs';
import { loadUsersDb } from './auth/authStore.mjs';

export const BOT_USERNAME = 'bot';
export const BOT_DISPLAY = 'BOT';

export const PINNED_WELCOME = {
  id: 'pinned-welcome',
  kind: 'pinned',
  text: 'Welcome to LUL.bz :Welcome:',
  segments: [
    { type: 'text', text: 'Welcome to LUL.bz ' },
    {
      type: 'emote',
      code: 'Welcome',
      label: 'Welcome',
      url: '/emotes/welcome.svg',
    },
  ],
};

let botUserCache = null;
let lastBotPostAt = 0;

async function waitForBotSpacing() {
  const now = Date.now();
  const gap = now - lastBotPostAt;
  if (gap < MIN_SEND_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_SEND_INTERVAL_MS - gap));
  }
}

export async function getBotUser() {
  if (botUserCache) return botUserCache;
  const db = await loadUsersDb();
  const user = db.users.find((u) => u.username === BOT_USERNAME && u.active);
  if (!user) throw new Error('BOT user not configured');
  botUserCache = user;
  return user;
}

function publicBotMessage(msg) {
  return {
    id: msg.id,
    lobby: msg.lobby,
    userId: msg.userId,
    username: msg.username,
    displayName: msg.displayName,
    role: msg.role,
    avatarUrl: msg.avatarUrl ?? null,
    kind: msg.kind,
    text: msg.text,
    segments: msg.segments ?? null,
    createdAt: msg.createdAt,
  };
}

async function appendBotMessageToDb(db, { text, segments, kind = 'bot' }) {
  const bot = await getBotUser();

  const message = {
    id: newMessageId(),
    lobby: LOBBY_ID,
    userId: bot.id,
    username: bot.username,
    displayName: BOT_DISPLAY,
    role: 'bot',
    avatarUrl: String(bot.avatarUrl ?? '').trim().slice(0, 512) || null,
    kind,
    text: String(text ?? '').trim(),
    segments: segments ?? null,
    createdAt: Date.now(),
  };

  db.messages.push(message);
  db.messages = trimMessages(db.messages);
  lastBotPostAt = message.createdAt;
  return publicBotMessage(message);
}

/** Append a bot message when caller already holds withLobbyWrite (avoids nested deadlock). */
export async function pushBotMessageInWrite(db, opts) {
  const message = await appendBotMessageToDb(db, opts);
  await saveLobbyDb(db);
  return message;
}

export async function postBotMessage(opts) {
  await waitForBotSpacing();
  return withLobbyWrite(async () => {
    const db = await loadLobbyDb();
    const message = await appendBotMessageToDb(db, opts);
    await saveLobbyDb(db);
    return message;
  });
}

export function profileLink(username) {
  const uname = String(username ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `/profile/${encodeURIComponent(uname)}`;
}

export function premiumCategoryLink(category) {
  return `/?tab=premiumaccounts&category=${encodeURIComponent(category)}`;
}

export function premiumAccountLink(accountId, category) {
  const params = new URLSearchParams({ tab: 'premiumaccounts', account: accountId });
  if (category) params.set('category', category);
  return `/?${params.toString()}`;
}

export function appTabLink(tab, extra = {}) {
  const params = new URLSearchParams({ tab, ...extra });
  return `/?${params.toString()}`;
}

export function imageViewLink(imageId) {
  const id = String(imageId ?? '').trim();
  return id ? `/i/${id}` : appTabLink('imagehost');
}

export function pasteViewLink(pasteId) {
  const id = String(pasteId ?? '').trim();
  return id ? `/p/${id}` : appTabLink('paste');
}

export function pendingAccountLink(accountId, category) {
  const params = new URLSearchParams({ tab: 'premiumaccounts', account: accountId });
  if (category) params.set('category', category);
  return `/?${params.toString()}`;
}

export async function postBotWelcomeMember(username) {
  const uname = String(username ?? '').trim();
  const href = profileLink(uname);
  return postBotMessage({
    text: `Welcome to our newest Member @${uname}`,
    segments: [
      { type: 'text', text: 'Welcome to our newest Member ' },
      { type: 'user', username: uname, href, label: `@${uname}` },
    ],
  });
}

export async function postBotAccountAdded({ username, service, accountId, category, plan }) {
  const uname = String(username ?? '').trim();
  const site = String(service ?? '').trim() || 'Account';
  const planLabel = plan === 'Premium'
    ? 'Premium Account'
    : plan === 'WorkingButFree'
      ? 'FREE Account 💩'
      : 'Free Account';
  const catLabel = PREMIUM_CATEGORY_LABELS[category] ?? category;
  const catHref = premiumCategoryLink(category);
  const accHref = premiumAccountLink(accountId, category);

  return postBotMessage({
    text: `@${uname} has added new ${site} ${planLabel} in category ${catLabel}`,
    segments: [
      { type: 'user', username: uname, href: profileLink(uname), label: `@${uname}` },
      { type: 'text', text: ' has added new ' },
      { type: 'link', href: accHref, label: `${site} ${planLabel}` },
      { type: 'text', text: ' in category ' },
      { type: 'link', href: catHref, label: catLabel },
    ],
  });
}

export async function postBotAchievement(username, achievementId) {
  const uname = String(username ?? '').trim();
  const { name, icon } = resolveAchievementChat(achievementId);
  const profHref = profileLink(uname);
  const { achievementCoinReward } = await import('./achievementCoinRewards.mjs');
  const coins = achievementCoinReward(achievementId);
  const coinNote = coins > 0 ? ` +${coins} LULcoins` : '';

  return postBotMessage({
    kind: 'achievement',
    text: `🎖️ Achievement unlocked! @${uname} earned ${icon} ${name}${coinNote}!`,
    segments: [
      { type: 'text', text: '🎖️ Achievement unlocked! ' },
      { type: 'user', username: uname, href: profHref, label: `@${uname}` },
      { type: 'text', text: ' earned ' },
      { type: 'text', text: `${icon} ${name}`, style: 'achievement' },
      ...(coins > 0 ? [{ type: 'text', text: ` (+${coins} LULcoins)` }] : []),
      { type: 'text', text: '! Congrats — check ' },
      { type: 'link', href: profHref, label: 'your profile' },
      { type: 'text', text: '.' },
    ],
  });
}

export async function postBotAchievementsBatch(username, achievementIds) {
  const uname = String(username ?? '').trim();
  const ids = [...new Set(achievementIds.map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) return null;

  const shown = ids.slice(0, 4);
  const extra = ids.length - shown.length;
  const profHref = profileLink(uname);
  const labels = shown.map((id) => {
    const { name, icon } = resolveAchievementChat(id);
    return `${icon} ${name}`;
  });
  const summary = labels.join(' · ') + (extra > 0 ? ` · +${extra} more` : '');

  return postBotMessage({
    kind: 'achievement',
    text: `🎖️ @${uname} unlocked ${ids.length} achievements: ${summary}`,
    segments: [
      { type: 'text', text: '🎖️ ' },
      { type: 'user', username: uname, href: profHref, label: `@${uname}` },
      { type: 'text', text: ` unlocked ${ids.length} achievements: ` },
      ...shown.flatMap((id, i) => {
        const { name, icon } = resolveAchievementChat(id);
        const parts = [
          { type: 'text', text: `${icon} ` },
          { type: 'text', text: name, style: 'achievement' },
        ];
        if (i < shown.length - 1) parts.push({ type: 'text', text: ' · ' });
        return parts;
      }),
      ...(extra > 0 ? [{ type: 'text', text: ` · +${extra} more` }] : []),
      { type: 'text', text: ' — congrats!' },
    ],
  });
}

export async function notifyBotAchievements(username, achievementIds) {
  if (!achievementIds?.length) return [];
  const ids = [...new Set(achievementIds.map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) return [];

  if (ids.length === 1) {
    return [await postBotAchievement(username, ids[0])];
  }

  const batch = await postBotAchievementsBatch(username, ids);
  return batch ? [batch] : [];
}

export async function postBotLeaderboardAward({ username, awardId, boardTitle, rank }) {
  const uname = String(username ?? '').trim();
  const { name: awardName, icon } = resolveAchievementChat(awardId);
  const board = String(boardTitle ?? 'Leaderboard').trim();
  const rankLabel = rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : 'Top 3';
  const lbHref = appTabLink('leaderboard');

  return postBotMessage({
    text: `🏆 Leaderboard alert! @${uname} hit ${rankLabel} on ${board} and earned ${awardName}!`,
    segments: [
      { type: 'text', text: '🏆 Leaderboard alert! ' },
      { type: 'user', username: uname, href: profileLink(uname), label: `@${uname}` },
      { type: 'text', text: ` hit ${rankLabel} on ` },
      { type: 'link', href: lbHref, label: board },
      { type: 'text', text: ' and earned ' },
      { type: 'text', text: `${icon} ${awardName}`, style: 'achievement' },
      { type: 'text', text: '!' },
    ],
  });
}

export async function notifyBotLeaderboardAwards(grant) {
  return postBotLeaderboardAward(grant);
}

export async function postBotMemeCreated({ username, memeLabel, memeHref, templateId }) {
  const uname = String(username ?? '').trim();
  const label = String(memeLabel ?? 'Meme').trim() || 'Meme';
  const memeLink = memeHref || (templateId ? appTabLink('memegen', { template: templateId }) : appTabLink('memegen'));
  const generatorHref = appTabLink('memegen');
  return postBotMessage({
    text: `@${uname} has created a new ${label} with the Meme Generator`,
    segments: [
      { type: 'user', username: uname, href: profileLink(uname), label: `@${uname}` },
      { type: 'text', text: ' has created a new ' },
      { type: 'link', href: memeLink, label },
      { type: 'text', text: ' with the ' },
      { type: 'link', href: generatorHref, label: 'Meme Generator' },
    ],
  });
}

export async function postBotImageHosted({ username, imageName, imageHref }) {
  const uname = String(username ?? '').trim();
  const name = String(imageName ?? 'Image').trim() || 'Image';
  const imgHref = imageHref || appTabLink('imagehost');
  const hostHref = appTabLink('imagehost');
  return postBotMessage({
    text: `@${uname} has uploaded a new ${name} via Image Hosting`,
    segments: [
      { type: 'user', username: uname, href: profileLink(uname), label: `@${uname}` },
      { type: 'text', text: ' has uploaded a new ' },
      { type: 'link', href: imgHref, label: name },
      { type: 'text', text: ' via ' },
      { type: 'link', href: hostHref, label: 'Image Hosting' },
    ],
  });
}

export async function postBotPastePublished({ username, pasteTitle, pasteHref, visibility }) {
  const uname = String(username ?? '').trim();
  const title = String(pasteTitle ?? 'Untitled Paste').trim().slice(0, 80) || 'Untitled Paste';
  const pasteLink = pasteHref || appTabLink('paste');
  const pasteTabHref = appTabLink('paste');
  const vis = String(visibility ?? 'public');
  const visNote = vis === 'private'
    ? ' (private · only you)'
    : vis === 'protected'
      ? ' (password protected)'
      : '';
  return postBotMessage({
    text: `@${uname} has published a new paste ${title}${visNote} via Paste`,
    segments: [
      { type: 'user', username: uname, href: profileLink(uname), label: `@${uname}` },
      { type: 'text', text: ' has published a new paste ' },
      { type: 'link', href: pasteLink, label: title },
      ...(visNote ? [{ type: 'text', text: visNote }] : []),
      { type: 'text', text: ' via ' },
      { type: 'link', href: pasteTabHref, label: 'Paste' },
    ],
  });
}

export async function postBotAccountSubmitted({ username, service, accountId, category }) {
  const uname = String(username ?? '').trim();
  const site = String(service ?? '').trim() || 'Account';
  const accHref = pendingAccountLink(accountId, category);
  const vaultHref = appTabLink('premiumaccounts', category ? { category } : {});
  const catLabel = PREMIUM_CATEGORY_LABELS[category] ?? category ?? 'Vault';
  return postBotMessage({
    text: `@${uname} has submitted a new ${site} account for review in ${catLabel}`,
    segments: [
      { type: 'user', username: uname, href: profileLink(uname), label: `@${uname}` },
      { type: 'text', text: ' has submitted a new ' },
      { type: 'link', href: accHref, label: site },
      { type: 'text', text: ' account for review in ' },
      { type: 'link', href: vaultHref, label: catLabel },
    ],
  });
}

export async function postBotRpsVictory({ winner, loser, wager, jackpotHit = false }) {
  const w = String(winner ?? '').trim();
  const l = String(loser ?? '').trim();
  const gamesHref = appTabLink('games');
  const extra = jackpotHit ? ' — JACKPOT HIT! 🎰' : '';
  return postBotMessage({
    text: `@${w} beat @${l} in Rock Paper Scissors (+${wager} LULcoins)${extra}`,
    segments: [
      { type: 'user', username: w, href: profileLink(w), label: `@${w}` },
      { type: 'text', text: ' beat ' },
      { type: 'user', username: l, href: profileLink(l), label: `@${l}` },
      { type: 'text', text: ' in ' },
      { type: 'link', href: gamesHref, label: 'Rock Paper Scissors' },
      { type: 'text', text: ` (+${wager} LULcoins)${extra}` },
    ],
  });
}

export async function postBotArcadeVictory({ gameLabel, winner, loser, wager, jackpotHit = false }) {
  const w = String(winner ?? '').trim();
  const l = String(loser ?? '').trim();
  const label = String(gameLabel ?? 'Arcade').trim();
  const gamesHref = appTabLink('games');
  const extra = jackpotHit ? ' — JACKPOT HIT! 🎰' : '';
  return postBotMessage({
    text: `@${w} beat @${l} in ${label} (+${wager} LULcoins)${extra}`,
    segments: [
      { type: 'user', username: w, href: profileLink(w), label: `@${w}` },
      { type: 'text', text: ' beat ' },
      { type: 'user', username: l, href: profileLink(l), label: `@${l}` },
      { type: 'text', text: ' in ' },
      { type: 'link', href: gamesHref, label },
      { type: 'text', text: ` (+${wager} LULcoins)${extra}` },
    ],
  });
}

export async function postBotArcadeJackpot({ username, amount }) {
  return postBotRpsJackpot({ username, amount });
}

export async function postBotTttVictory({ winner, loser, wager, jackpotHit = false }) {
  const w = String(winner ?? '').trim();
  const l = String(loser ?? '').trim();
  const gamesHref = appTabLink('games');
  const extra = jackpotHit ? ' — JACKPOT HIT! 🎰' : '';
  return postBotMessage({
    text: `@${w} beat @${l} in Tic-Tac-Toe (+${wager} LULcoins)${extra}`,
    segments: [
      { type: 'user', username: w, href: profileLink(w), label: `@${w}` },
      { type: 'text', text: ' beat ' },
      { type: 'user', username: l, href: profileLink(l), label: `@${l}` },
      { type: 'text', text: ' in ' },
      { type: 'link', href: gamesHref, label: 'Tic-Tac-Toe' },
      { type: 'text', text: ` (+${wager} LULcoins)${extra}` },
    ],
  });
}

export async function postBotRpsJackpot({ username, amount }) {
  const uname = String(username ?? '').trim();
  const gamesHref = appTabLink('games');
  return postBotMessage({
    text: `🎰 JACKPOT! @${uname} cracked the pool for ${amount} LULcoins!`,
    segments: [
      { type: 'text', text: '🎰 JACKPOT! ' },
      { type: 'user', username: uname, href: profileLink(uname), label: `@${uname}` },
      { type: 'text', text: ' cracked the ' },
      { type: 'link', href: gamesHref, label: 'Games Jackpot' },
      { type: 'text', text: ` for ${amount} LULcoins!` },
    ],
  });
}

export async function postBotReferralJoined({ newUsername, referrerUsername }) {
  const newbie = String(newUsername ?? '').trim();
  const referrer = String(referrerUsername ?? '').trim();
  const inviteHref = appTabLink('invite');
  return postBotMessage({
    text: `@${newbie} joined LUL Terminal via @${referrer}'s invite link`,
    segments: [
      { type: 'user', username: newbie, href: profileLink(newbie), label: `@${newbie}` },
      { type: 'text', text: ' joined LUL Terminal via ' },
      { type: 'user', username: referrer, href: profileLink(referrer), label: `@${referrer}` },
      { type: 'text', text: "'s " },
      { type: 'link', href: inviteHref, label: 'invite link' },
    ],
  });
}