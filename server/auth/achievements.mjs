/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { achievementCoinReward, creditAchievementCoins } from '../achievementCoinRewards.mjs';
import { syncStandardArcadeAchievements } from '../arcadeAchievements.mjs';
import {
  ARCADE_GAMES_META,
  ARCADE_LB_AWARD_IDS,
  ARCADE_META_ACHIEVEMENT_IDS,
  STANDARD_ARCADE_ACHIEVEMENT_IDS,
} from '../arcadeMeta.mjs';
import { getLatestChangelogVersion } from '../changelogMeta.mjs';
import { getLatestNewsVersion } from '../newsMeta.mjs';
import { sanitizeExternalUrl } from './safeMediaUrl.mjs';

const ADMIN_AWARDS = ['owner', 'administrator', 'site_architect', 'member_of_month'];
const BOT_AWARDS = ['bot_supreme_nerd'];

const STORED_ACHIEVEMENT_IDS = [
  'journey_begins',
  'identity_forge',
  'avatar_artist',
  'social_butterfly',
  'faq_scholar',
  'changelog_keeper',
  'command_rookie',
  'command_master',
  'matrix_rain',
  'self_destruct_init',
  'fun_survivor',
  'claw_victim',
  'meme_lord',
  'image_host',
  'paste_explorer',
  'paste_pioneer',
  'paste_create_10',
  'paste_create_50',
  'paste_create_100',
  'paste_create_250',
  'paste_create_500',
  'paste_create_1000',
  'paste_create_2000',
  'paste_create_5000',
  'paste_create_10000',
  'paste_create_99999',
  'paste_views_10',
  'paste_views_50',
  'paste_views_100',
  'paste_views_250',
  'paste_views_500',
  'paste_views_1000',
  'paste_views_2000',
  'paste_views_5000',
  'paste_views_10000',
  'paste_views_99999',
  'proxy_hunter',
  'tool_vault_explorer',
  'identity_smith',
  'lab_explorer',
  'cover_curator',
  'social_network',
  'night_owl',
  'returning_user',
  'veteran_member',
  'verified_trust',
  'vip_crown',
  'vault_contributor',
  'vault_master',
  'vault_legend',
  'profile_star',
  'profile_legend',
  'admin_profile_visitor',
  'page_visit_10',
  'page_visit_50',
  'page_visit_100',
  'page_visit_250',
  'page_visit_500',
  'page_visit_1000',
  'page_visit_2000',
  'page_visit_5000',
  'page_visit_10000',
  'page_visit_99999',
  'profile_visit_10',
  'profile_visit_50',
  'profile_visit_100',
  'profile_visit_250',
  'profile_visit_500',
  'profile_visit_1000',
  'profile_visit_2000',
  'profile_visit_5000',
  'profile_visit_10000',
  'profile_visit_99999',
  'shoutbox_send_10',
  'shoutbox_send_50',
  'shoutbox_send_100',
  'shoutbox_send_250',
  'shoutbox_send_500',
  'shoutbox_send_1000',
  'shoutbox_send_2000',
  'shoutbox_send_5000',
  'shoutbox_send_10000',
  'shoutbox_send_99999',
  'image_upload_10',
  'image_upload_50',
  'image_upload_100',
  'image_upload_250',
  'image_upload_500',
  'image_upload_1000',
  'image_upload_2000',
  'image_upload_5000',
  'image_upload_10000',
  'image_upload_99999',
  'online_minutes_10',
  'online_minutes_50',
  'online_minutes_100',
  'online_minutes_250',
  'online_minutes_500',
  'online_minutes_1000',
  'online_minutes_2000',
  'online_minutes_5000',
  'online_minutes_10000',
  'online_minutes_99999',
  'lb_top_profile_views',
  'lb_top_referrals',
  'lb_top_uploader',
  'lb_top_meme_creator',
  'lb_top_online',
  'lb_top_commands',
  'lb_top_achievements',
  'lb_top_shoutbox',
  'lb_top_explorer',
  'lb_top_vault',
  'lb_top_paste_creator',
  'lb_top_paste_views',
  'lb_top_game_wins',
  'lb_top_game_losses',
  'lb_top_game_games',
  'lb_top_lul_coins',
  'games_explorer',
  'rps_first_play',
  'rps_first_win',
  'rps_win_10',
  'rps_win_50',
  'rps_win_100',
  'rps_games_10',
  'rps_games_50',
  'rps_games_100',
  'rps_games_250',
  'rps_stein_fan',
  'rps_papier_fan',
  'rps_schere_fan',
  'rps_stein_master',
  'rps_papier_master',
  'rps_schere_master',
  'rps_streak_5',
  'rps_streak_10',
  'rps_glutton_10',
  'ttt_first_play',
  'ttt_first_win',
  'ttt_win_10',
  'ttt_win_50',
  'ttt_games_10',
  'ttt_games_50',
  'ttt_streak_5',
  'ttt_glutton_10',
  ...STANDARD_ARCADE_ACHIEVEMENT_IDS,
  ...ARCADE_META_ACHIEVEMENT_IDS,
  ...ARCADE_LB_AWARD_IDS,
  'jackpot_hunter',
  'lul_coins_5000',
  'changelog_read_10',
  'changelog_read_50',
  'changelog_read_100',
  'changelog_read_250',
  'changelog_read_500',
  'changelog_read_1000',
  'changelog_read_2000',
  'changelog_read_5000',
  'changelog_read_10000',
  'changelog_read_99999',
];

export const PAGE_VISIT_MILESTONES = [
  { count: 10, id: 'page_visit_10' },
  { count: 50, id: 'page_visit_50' },
  { count: 100, id: 'page_visit_100' },
  { count: 250, id: 'page_visit_250' },
  { count: 500, id: 'page_visit_500' },
  { count: 1000, id: 'page_visit_1000' },
  { count: 2000, id: 'page_visit_2000' },
  { count: 5000, id: 'page_visit_5000' },
  { count: 10000, id: 'page_visit_10000' },
  { count: 99999, id: 'page_visit_99999' },
];

export const PROFILE_VISIT_MILESTONES = [
  { count: 10, id: 'profile_visit_10' },
  { count: 50, id: 'profile_visit_50' },
  { count: 100, id: 'profile_visit_100' },
  { count: 250, id: 'profile_visit_250' },
  { count: 500, id: 'profile_visit_500' },
  { count: 1000, id: 'profile_visit_1000' },
  { count: 2000, id: 'profile_visit_2000' },
  { count: 5000, id: 'profile_visit_5000' },
  { count: 10000, id: 'profile_visit_10000' },
  { count: 99999, id: 'profile_visit_99999' },
];

export const SHOUTBOX_SEND_MILESTONES = [
  { count: 10, id: 'shoutbox_send_10' },
  { count: 50, id: 'shoutbox_send_50' },
  { count: 100, id: 'shoutbox_send_100' },
  { count: 250, id: 'shoutbox_send_250' },
  { count: 500, id: 'shoutbox_send_500' },
  { count: 1000, id: 'shoutbox_send_1000' },
  { count: 2000, id: 'shoutbox_send_2000' },
  { count: 5000, id: 'shoutbox_send_5000' },
  { count: 10000, id: 'shoutbox_send_10000' },
  { count: 99999, id: 'shoutbox_send_99999' },
];

export const IMAGE_UPLOAD_MILESTONES = [
  { count: 10, id: 'image_upload_10' },
  { count: 50, id: 'image_upload_50' },
  { count: 100, id: 'image_upload_100' },
  { count: 250, id: 'image_upload_250' },
  { count: 500, id: 'image_upload_500' },
  { count: 1000, id: 'image_upload_1000' },
  { count: 2000, id: 'image_upload_2000' },
  { count: 5000, id: 'image_upload_5000' },
  { count: 10000, id: 'image_upload_10000' },
  { count: 99999, id: 'image_upload_99999' },
];

export const ONLINE_MINUTES_MILESTONES = [
  { count: 10, id: 'online_minutes_10' },
  { count: 50, id: 'online_minutes_50' },
  { count: 100, id: 'online_minutes_100' },
  { count: 250, id: 'online_minutes_250' },
  { count: 500, id: 'online_minutes_500' },
  { count: 1000, id: 'online_minutes_1000' },
  { count: 2000, id: 'online_minutes_2000' },
  { count: 5000, id: 'online_minutes_5000' },
  { count: 10000, id: 'online_minutes_10000' },
  { count: 99999, id: 'online_minutes_99999' },
];

export const PASTE_CREATE_MILESTONES = [
  { count: 10, id: 'paste_create_10' },
  { count: 50, id: 'paste_create_50' },
  { count: 100, id: 'paste_create_100' },
  { count: 250, id: 'paste_create_250' },
  { count: 500, id: 'paste_create_500' },
  { count: 1000, id: 'paste_create_1000' },
  { count: 2000, id: 'paste_create_2000' },
  { count: 5000, id: 'paste_create_5000' },
  { count: 10000, id: 'paste_create_10000' },
  { count: 99999, id: 'paste_create_99999' },
];

export const RPS_GAME_MILESTONES = [
  { count: 10, id: 'rps_games_10' },
  { count: 50, id: 'rps_games_50' },
  { count: 100, id: 'rps_games_100' },
  { count: 250, id: 'rps_games_250' },
];

export const TTT_GAME_MILESTONES = [
  { count: 10, id: 'ttt_games_10' },
  { count: 50, id: 'ttt_games_50' },
];

export const RPS_MOVE_MILESTONES = [
  { move: 'rock', count: 25, id: 'rps_stein_fan' },
  { move: 'paper', count: 25, id: 'rps_papier_fan' },
  { move: 'scissors', count: 25, id: 'rps_schere_fan' },
  { move: 'rock', count: 100, id: 'rps_stein_master' },
  { move: 'paper', count: 100, id: 'rps_papier_master' },
  { move: 'scissors', count: 100, id: 'rps_schere_master' },
];

export const PASTE_VIEWS_MILESTONES = [
  { count: 10, id: 'paste_views_10' },
  { count: 50, id: 'paste_views_50' },
  { count: 100, id: 'paste_views_100' },
  { count: 250, id: 'paste_views_250' },
  { count: 500, id: 'paste_views_500' },
  { count: 1000, id: 'paste_views_1000' },
  { count: 2000, id: 'paste_views_2000' },
  { count: 5000, id: 'paste_views_5000' },
  { count: 10000, id: 'paste_views_10000' },
  { count: 99999, id: 'paste_views_99999' },
];

export const CHANGELOG_READ_MILESTONES = [
  { count: 10, id: 'changelog_read_10' },
  { count: 50, id: 'changelog_read_50' },
  { count: 100, id: 'changelog_read_100' },
  { count: 250, id: 'changelog_read_250' },
  { count: 500, id: 'changelog_read_500' },
  { count: 1000, id: 'changelog_read_1000' },
  { count: 2000, id: 'changelog_read_2000' },
  { count: 5000, id: 'changelog_read_5000' },
  { count: 10000, id: 'changelog_read_10000' },
  { count: 99999, id: 'changelog_read_99999' },
];

const LAB_TABS = new Set(['tools', 'identity', 'textlab', 'colorlab', 'meme', 'toolvault']);
const PROXY_TABS = new Set(['proxydatabase']);
const SOCIAL_PLATFORM_IDS = ['github', 'twitter', 'discord', 'instagram', 'youtube', 'twitch', 'tiktok', 'linkedin'];
const DEFAULT_COVER = 'linear-gradient(135deg,#0f172a,#1e293b,#020617)';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeAchievements(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e.id === 'string')
    .map((e) => ({ id: e.id, earnedAt: Number(e.earnedAt) || Date.now() }));
}

/** Normalize legacy string IDs or object entries into achievement ID strings. */
export function userAchievementIds(raw) {
  const normalized = normalizeAchievements(raw);
  if (normalized.length) return normalized.map((a) => a.id);
  if (!Array.isArray(raw)) return [];
  return raw.filter((id) => typeof id === 'string');
}

export function normalizeSocialLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({
      platform: String(l.platform ?? '').trim().slice(0, 24),
      url: sanitizeExternalUrl(l.url),
    }))
    .filter((l) => l.platform && l.url);
}

const EPHEMERAL_ACTIVITY_FLAGS = new Set([
  'achProofNonce',
  'achProofExp',
  'achProofTab',
  'lastMemeBotAt',
  'lastChatActionAt',
  'lastAchievementEventAt',
  'lastTerminalCommandAt',
]);
const MAX_PROFILE_VISIT_FLAGS = 256;
const MAX_ACTIVITY_FLAG_KEYS = 512;

function pruneActivityFlags(flags) {
  if (!flags || typeof flags !== 'object') return {};
  const out = { ...flags };
  for (const key of EPHEMERAL_ACTIVITY_FLAGS) delete out[key];
  for (const key of Object.keys(out)) {
    if (key.startsWith('claw_daily_') || key.startsWith('terminal_cmd_daily_')) delete out[key];
  }
  const profileKeys = Object.keys(out).filter((k) => k.startsWith('profile_visit_'));
  if (profileKeys.length > MAX_PROFILE_VISIT_FLAGS) {
    profileKeys.sort();
    for (let i = 0; i < profileKeys.length - MAX_PROFILE_VISIT_FLAGS; i += 1) {
      delete out[profileKeys[i]];
    }
  }
  const isDedupFlag = (key) =>
    key.startsWith('profile_visit_')
    || key.startsWith('paste_meta_view_')
    || key.startsWith('image_meta_view_')
    || key.startsWith('page_view_')
    || key.startsWith('post_view_')
    || key.startsWith('paste_view_');
  const keys = Object.keys(out).filter((k) => !isDedupFlag(k));
  if (keys.length > MAX_ACTIVITY_FLAG_KEYS) {
    keys.sort();
    for (let i = 0; i < keys.length - MAX_ACTIVITY_FLAG_KEYS; i += 1) {
      delete out[keys[i]];
    }
  }
  return out;
}

export function normalizeActivity(raw) {
  const base = {
    loginCount: 0,
    commandsRun: 0,
    pageVisits: 0,
    profileVisits: 0,
    shoutboxSent: 0,
    changelogReads: 0,
    changelogLastReadVersion: null,
    newsReads: 0,
    newsLastReadVersion: null,
    tabsVisited: [],
    flags: {},
  };
  if (!raw || typeof raw !== 'object') return base;
  const tabsVisited = Array.isArray(raw.tabsVisited)
    ? raw.tabsVisited.map((t) => String(t).slice(0, 24)).filter(Boolean)
    : [];
  const flags = pruneActivityFlags(raw.flags);
  return {
    loginCount: Math.max(0, Number(raw.loginCount) || 0),
    commandsRun: Math.max(0, Number(raw.commandsRun) || 0),
    pageVisits: Math.max(0, Number(raw.pageVisits) || 0),
    profileVisits: Math.max(0, Number(raw.profileVisits) || 0),
    shoutboxSent: Math.max(0, Number(raw.shoutboxSent) || 0),
    changelogReads: Math.max(0, Number(raw.changelogReads) || 0),
    changelogLastReadVersion: raw.changelogLastReadVersion
      ? String(raw.changelogLastReadVersion).trim().slice(0, 32)
      : null,
    newsReads: Math.max(0, Number(raw.newsReads) || 0),
    newsLastReadVersion: raw.newsLastReadVersion
      ? String(raw.newsLastReadVersion).trim().slice(0, 32)
      : null,
    tabsVisited: [...new Set(tabsVisited)],
    flags,
  };
}

export function ensureActivity(user) {
  user.activity = normalizeActivity(user.activity);
  return user.activity;
}

function hasAchievement(user, id) {
  return (user.achievements ?? []).some((a) => a.id === id);
}

function grant(user, id, now = Date.now()) {
  if (!STORED_ACHIEVEMENT_IDS.includes(id)) return false;
  if (hasAchievement(user, id)) return false;
  if (!user.achievements) user.achievements = [];
  const coinReward = achievementCoinReward(id);
  creditAchievementCoins(user, coinReward, id, now);
  user.achievements.push({ id, earnedAt: now, coinReward });
  return true;
}

/** Exported for leaderboard award sync. */
export function tryGrantAchievement(user, id, now = Date.now()) {
  return grant(user, id, now);
}

function isCustomAvatar(url) {
  const u = String(url ?? '');
  return u.includes('/api/auth/avatars/') || u.startsWith('data:image/');
}

function isCustomCover(url) {
  const v = String(url ?? '').trim();
  return v.length > 0 && v !== DEFAULT_COVER;
}

function hasAllSocialPlatforms(user) {
  const linked = new Set(
    (user.socialLinks ?? [])
      .filter((l) => l.url?.trim())
      .map((l) => String(l.platform ?? '').trim().toLowerCase()),
  );
  return SOCIAL_PLATFORM_IDS.every((p) => linked.has(p));
}

function visitedAllLabs(tabsVisited) {
  return [...LAB_TABS].every((t) => tabsVisited.includes(t));
}

export function applyActivityCtx(user, ctx = {}) {
  const act = ensureActivity(user);
  let touched = false;

  if (ctx.visitedTab) {
    const tab = String(ctx.visitedTab).slice(0, 24);
    if (tab) {
      const isNewTab = !act.tabsVisited.includes(tab);
      if (isNewTab) {
        act.pageVisits = Math.max(0, Number(act.pageVisits) || 0) + 1;
        act.tabsVisited.push(tab);
        touched = true;
      }
      if (tab === 'changelog') {
        const latest = getLatestChangelogVersion();
        const lastRead = act.changelogLastReadVersion ? String(act.changelogLastReadVersion) : null;
        if (lastRead !== latest) {
          act.changelogReads = Math.max(0, Number(act.changelogReads) || 0) + 1;
          act.changelogLastReadVersion = latest;
          touched = true;
        }
      }
      if (tab === 'news') {
        let latest = '0.0.0';
        try {
          latest = getLatestNewsVersion();
        } catch {
          latest = '0.0.0';
        }
        const lastRead = act.newsLastReadVersion ? String(act.newsLastReadVersion) : null;
        if (latest !== '0.0.0' && lastRead !== latest) {
          act.newsReads = Math.max(0, Number(act.newsReads) || 0) + 1;
          act.newsLastReadVersion = latest;
          touched = true;
        }
      }
    }
  }

  if (ctx.visitedProfile) {
    const target = String(ctx.visitedProfile).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const selfUname = String(user.username ?? '').trim().toLowerCase();
    const visitKey = target ? `profile_visit_${target}` : '';
    if (target && target !== selfUname && visitKey && !act.flags[visitKey]) {
      act.flags[visitKey] = true;
      act.profileVisits = Math.max(0, Number(act.profileVisits) || 0) + 1;
      touched = true;
    }
  }

  if (ctx.incrementCommands) {
    act.commandsRun += 1;
    touched = true;
  }

  if (ctx.flag) {
    const key = String(ctx.flag).slice(0, 32);
    if (key && !act.flags[key]) {
      act.flags[key] = true;
      touched = true;
    }
  }

  if (ctx.incrementLogin) {
    act.loginCount += 1;
    touched = true;
  }

  return touched;
}

const ACTIVITY_ACHIEVEMENT_IDS = new Set([
  'games_explorer',
  'jackpot_hunter',
  'lul_coins_5000',
  'lb_top_game_wins',
  'lb_top_game_losses',
  'lb_top_game_games',
  'lb_top_lul_coins',
  ...STANDARD_ARCADE_ACHIEVEMENT_IDS,
  ...ARCADE_META_ACHIEVEMENT_IDS,
  ...ARCADE_LB_AWARD_IDS,
]);

export function isActivitySensitiveAchievement(id) {
  const aid = String(id ?? '');
  if (ACTIVITY_ACHIEVEMENT_IDS.has(aid)) return true;
  if (aid.startsWith('rps_') || aid.startsWith('ttt_')) return true;
  if (aid.startsWith('lul_coins_') || aid.startsWith('jackpot_')) return true;
  if (aid.startsWith('lb_top_game_')) return true;
  return ARCADE_GAMES_META.some((g) => aid.startsWith(`${g.id}_`));
}

export function isCoinSensitiveAchievement(id) {
  const aid = String(id ?? '');
  if (aid.startsWith('lul_coins_') || aid.startsWith('jackpot_')) return true;
  if (aid === 'lb_top_lul_coins') return true;
  return false;
}

export function filterAchievementsForPrivacy(achievements, { showActivity = true, showCoins = true } = {}) {
  return (achievements ?? []).filter((a) => {
    if (!showActivity && isActivitySensitiveAchievement(a.id)) return false;
    if (!showCoins && isCoinSensitiveAchievement(a.id)) return false;
    return true;
  });
}

export function computeDisplayAchievements(user, accountsSubmitted = 0) {
  const earnedIds = new Set((user.achievements ?? []).map((a) => a.id));
  const list = [...(user.achievements ?? [])];

  if (user.role === 'admin') {
    const now = Date.now();
    for (const id of ADMIN_AWARDS) {
      if (!earnedIds.has(id)) {
        list.push({ id, earnedAt: now });
        earnedIds.add(id);
      }
    }
  }

  if (user.role === 'bot') {
    const now = Date.now();
    for (const id of BOT_AWARDS) {
      if (!earnedIds.has(id)) {
        list.push({ id, earnedAt: now });
        earnedIds.add(id);
      }
    }
  }

  return list.sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0));
}

export function syncAchievements(user, ctx = {}) {
  const now = Date.now();
  const unlocked = [];
  const accountsSubmitted = ctx.accountsSubmitted ?? 0;
  applyActivityCtx(user, ctx);
  const act = ensureActivity(user);
  const tabs = act.tabsVisited;

  if (user.website?.trim() && user.bio?.trim() && grant(user, 'identity_forge', now)) unlocked.push('identity_forge');
  if (isCustomAvatar(user.avatarUrl) && grant(user, 'avatar_artist', now)) unlocked.push('avatar_artist');
  if ((user.socialLinks ?? []).filter((l) => l.url?.trim()).length >= 3 && grant(user, 'social_butterfly', now)) {
    unlocked.push('social_butterfly');
  }
  if (hasAllSocialPlatforms(user) && grant(user, 'social_network', now)) unlocked.push('social_network');
  if (isCustomCover(user.coverUrl) && grant(user, 'cover_curator', now)) unlocked.push('cover_curator');

  if (tabs.includes('faq') && grant(user, 'faq_scholar', now)) unlocked.push('faq_scholar');
  if (tabs.includes('changelog') && grant(user, 'changelog_keeper', now)) unlocked.push('changelog_keeper');
  if (tabs.includes('fun') && grant(user, 'fun_survivor', now)) unlocked.push('fun_survivor');
  if (tabs.includes('paste') && grant(user, 'paste_explorer', now)) unlocked.push('paste_explorer');
  if (tabs.includes('games') && grant(user, 'games_explorer', now)) unlocked.push('games_explorer');
  if (tabs.includes('memegen') && grant(user, 'meme_lord', now)) unlocked.push('meme_lord');
  if (tabs.includes('toolvault') && grant(user, 'tool_vault_explorer', now)) unlocked.push('tool_vault_explorer');
  if (tabs.includes('identity') && grant(user, 'identity_smith', now)) unlocked.push('identity_smith');
  if ([...PROXY_TABS].some((t) => tabs.includes(t)) && grant(user, 'proxy_hunter', now)) unlocked.push('proxy_hunter');
  if (visitedAllLabs(tabs) && grant(user, 'lab_explorer', now)) unlocked.push('lab_explorer');

  if (act.commandsRun >= 5 && grant(user, 'command_rookie', now)) unlocked.push('command_rookie');
  if (act.commandsRun >= 50 && grant(user, 'command_master', now)) unlocked.push('command_master');

  for (const { count, id } of PAGE_VISIT_MILESTONES) {
    if (act.pageVisits >= count && grant(user, id, now)) unlocked.push(id);
  }
  for (const { count, id } of PROFILE_VISIT_MILESTONES) {
    if (act.profileVisits >= count && grant(user, id, now)) unlocked.push(id);
  }
  for (const { count, id } of SHOUTBOX_SEND_MILESTONES) {
    if (act.shoutboxSent >= count && grant(user, id, now)) unlocked.push(id);
  }
  for (const { count, id } of CHANGELOG_READ_MILESTONES) {
    if (act.changelogReads >= count && grant(user, id, now)) unlocked.push(id);
  }
  const imagesUploaded = Math.max(0, Number(user.imagesUploaded) || 0);
  for (const { count, id } of IMAGE_UPLOAD_MILESTONES) {
    if (imagesUploaded >= count && grant(user, id, now)) unlocked.push(id);
  }
  const onlineMinutes = Math.max(0, Number(user.onlineMinutes) || 0);
  for (const { count, id } of ONLINE_MINUTES_MILESTONES) {
    if (onlineMinutes >= count && grant(user, id, now)) unlocked.push(id);
  }
  if (act.flags.matrix && grant(user, 'matrix_rain', now)) unlocked.push('matrix_rain');
  if (act.flags.self_destruct && grant(user, 'self_destruct_init', now)) unlocked.push('self_destruct_init');
  if (act.flags.claw_victim && grant(user, 'claw_victim', now)) unlocked.push('claw_victim');
  const rpsGames = Math.max(0, Number(user.gameRpsGames) || 0);
  const rpsWins = Math.max(0, Number(user.gameRpsWins) || 0);
  const rpsLosses = Math.max(0, Number(user.gameRpsLosses) || 0);
  const rpsBestStreak = Math.max(0, Number(user.gameRpsBestStreak) || 0);
  const rpsMoves = user.gameRpsMoves && typeof user.gameRpsMoves === 'object' ? user.gameRpsMoves : {};

  if ((act.flags.rps_played || rpsGames >= 1) && grant(user, 'rps_first_play', now)) unlocked.push('rps_first_play');
  for (const { count, id } of RPS_GAME_MILESTONES) {
    if (rpsGames >= count && grant(user, id, now)) unlocked.push(id);
  }
  if (rpsWins >= 1 && grant(user, 'rps_first_win', now)) unlocked.push('rps_first_win');
  if (rpsWins >= 10 && grant(user, 'rps_win_10', now)) unlocked.push('rps_win_10');
  if (rpsWins >= 50 && grant(user, 'rps_win_50', now)) unlocked.push('rps_win_50');
  if (rpsWins >= 100 && grant(user, 'rps_win_100', now)) unlocked.push('rps_win_100');
  if (rpsLosses >= 10 && grant(user, 'rps_glutton_10', now)) unlocked.push('rps_glutton_10');
  if (rpsBestStreak >= 5 && grant(user, 'rps_streak_5', now)) unlocked.push('rps_streak_5');
  if (rpsBestStreak >= 10 && grant(user, 'rps_streak_10', now)) unlocked.push('rps_streak_10');
  for (const { move, count, id } of RPS_MOVE_MILESTONES) {
    if ((Number(rpsMoves[move]) || 0) >= count && grant(user, id, now)) unlocked.push(id);
  }
  const tttGames = Math.max(0, Number(user.gameTttGames) || 0);
  const tttWins = Math.max(0, Number(user.gameTttWins) || 0);
  const tttLosses = Math.max(0, Number(user.gameTttLosses) || 0);
  const tttBestStreak = Math.max(0, Number(user.gameTttBestStreak) || 0);

  if ((act.flags.ttt_played || tttGames >= 1) && grant(user, 'ttt_first_play', now)) unlocked.push('ttt_first_play');
  for (const { count, id } of TTT_GAME_MILESTONES) {
    if (tttGames >= count && grant(user, id, now)) unlocked.push(id);
  }
  if (tttWins >= 1 && grant(user, 'ttt_first_win', now)) unlocked.push('ttt_first_win');
  if (tttWins >= 10 && grant(user, 'ttt_win_10', now)) unlocked.push('ttt_win_10');
  if (tttWins >= 50 && grant(user, 'ttt_win_50', now)) unlocked.push('ttt_win_50');
  if (tttLosses >= 10 && grant(user, 'ttt_glutton_10', now)) unlocked.push('ttt_glutton_10');
  if (tttBestStreak >= 5 && grant(user, 'ttt_streak_5', now)) unlocked.push('ttt_streak_5');
  unlocked.push(...syncStandardArcadeAchievements(user, act, now, grant));
  const jackpots = Math.max(0, Number(user.gameJackpotsWon) || 0);
  if (jackpots >= 1 && grant(user, 'jackpot_hunter', now)) unlocked.push('jackpot_hunter');
  const coins = Math.max(0, Number(user.lulCoins) || 0);
  if (coins >= 5000 && grant(user, 'lul_coins_5000', now)) unlocked.push('lul_coins_5000');
  if (act.flags.image_host && grant(user, 'image_host', now)) unlocked.push('image_host');
  if (act.flags.paste_create && grant(user, 'paste_pioneer', now)) unlocked.push('paste_pioneer');

  const pastesCreated = Math.max(0, Number(user.pastesCreated) || 0);
  for (const { count, id } of PASTE_CREATE_MILESTONES) {
    if (pastesCreated >= count && grant(user, id, now)) unlocked.push(id);
  }
  const pasteViewsTotal = Math.max(0, Number(user.pasteViewsTotal) || 0);
  for (const { count, id } of PASTE_VIEWS_MILESTONES) {
    if (pasteViewsTotal >= count && grant(user, id, now)) unlocked.push(id);
  }

  if (ctx.loginHour != null) {
    const hour = Number(ctx.loginHour);
    if (hour >= 0 && hour < 5 && grant(user, 'night_owl', now)) unlocked.push('night_owl');
  }
  if (act.loginCount >= 5 && grant(user, 'returning_user', now)) unlocked.push('returning_user');
  if (user.createdAt && now - Number(user.createdAt) >= THIRTY_DAYS_MS && grant(user, 'veteran_member', now)) {
    unlocked.push('veteran_member');
  }

  if (user.verified && grant(user, 'verified_trust', now)) unlocked.push('verified_trust');
  if ((user.role === 'vip' || user.role === 'admin') && grant(user, 'vip_crown', now)) unlocked.push('vip_crown');
  if (accountsSubmitted >= 1 && grant(user, 'vault_contributor', now)) unlocked.push('vault_contributor');
  if (accountsSubmitted >= 10 && grant(user, 'vault_master', now)) unlocked.push('vault_master');
  if (accountsSubmitted >= 25 && grant(user, 'vault_legend', now)) unlocked.push('vault_legend');
  if ((user.profileViews ?? 0) >= 50 && grant(user, 'profile_star', now)) unlocked.push('profile_star');
  if ((user.profileViews ?? 0) >= 200 && grant(user, 'profile_legend', now)) unlocked.push('profile_legend');
  if (act.flags.visited_admin_profile && grant(user, 'admin_profile_visitor', now)) unlocked.push('admin_profile_visitor');

  return unlocked;
}

export function grantFirstLogin(user) {
  if (grant(user, 'journey_begins')) return ['journey_begins'];
  return [];
}