/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ARCADE_GAMES_META, lbWinsAwardId } from './arcadeMeta.mjs';

export const PREMIUM_CATEGORY_LABELS = {
  streaming: 'Streaming',
  vpn: 'VPN',
  software: 'Software',
  gaming: 'Gaming',
  porn: 'Adult',
  other: 'Other',
};

/** @type {Record<string, { name: string; icon: string }>} */
export const ACHIEVEMENT_LOOKUP = {
  journey_begins: { name: 'The Journey Begins', icon: '🚀' },
  identity_forge: { name: 'Profile Pioneer', icon: '✏️' },
  avatar_artist: { name: 'Avatar Artist', icon: '🎨' },
  social_butterfly: { name: 'Social Butterfly', icon: '🦋' },
  faq_scholar: { name: 'FAQ Scholar', icon: '📚' },
  changelog_keeper: { name: 'Changelog Keeper', icon: '📜' },
  command_rookie: { name: 'Command Rookie', icon: '⌨️' },
  command_master: { name: 'Command Master', icon: '🖥️' },
  matrix_rain: { name: 'Matrix Rain', icon: '🟢' },
  self_destruct_init: { name: 'Red Alert', icon: '🚨' },
  fun_survivor: { name: 'Fun Survivor', icon: '🎮' },
  claw_victim: { name: 'Claw Victim', icon: '🦀' },
  meme_lord: { name: 'Meme Lord', icon: '🖼️' },
  image_host: { name: 'Cloud Uploader', icon: '☁️' },
  proxy_hunter: { name: 'Proxy Hunter', icon: '🕸️' },
  tool_vault_explorer: { name: 'Tool Vault Explorer', icon: '🧰' },
  identity_smith: { name: 'Identity Smith', icon: '🎭' },
  lab_explorer: { name: 'Lab Explorer', icon: '🧪' },
  cover_curator: { name: 'Cover Curator', icon: '🖌️' },
  social_network: { name: 'Social Network', icon: '🌐' },
  night_owl: { name: 'Night Owl', icon: '🦉' },
  returning_user: { name: 'Returning User', icon: '🔁' },
  veteran_member: { name: 'Veteran Member', icon: '🎖️' },
  vault_contributor: { name: 'Vault Contributor', icon: '📦' },
  vault_master: { name: 'Vault Master', icon: '🏦' },
  vault_legend: { name: 'Vault Legend', icon: '💎' },
  verified_trust: { name: 'Trusted Contributor', icon: '✅' },
  vip_crown: { name: 'VIP Crown', icon: '👑' },
  profile_star: { name: 'Profile Star', icon: '⭐' },
  profile_legend: { name: 'Profile Legend', icon: '🌟' },
  admin_profile_visitor: { name: 'Behind the Shield', icon: '🛡️' },
  owner: { name: 'Owner', icon: '🔱' },
  administrator: { name: 'Administrator', icon: '🛡️' },
  site_architect: { name: 'Site Architect', icon: '⚡' },
  member_of_month: { name: 'Member of the Month', icon: '🌟' },
  bot_supreme_nerd: { name: 'Supreme Nerd Automaton', icon: '🤖' },
  page_visit_10: { name: 'Tab Tourist', icon: '🧭' },
  page_visit_50: { name: 'Page Pilgrim', icon: '🚶' },
  page_visit_100: { name: 'Route Runner', icon: '🏃' },
  page_visit_250: { name: 'Menu Marathoner', icon: '🗺️' },
  page_visit_500: { name: 'Navigation Nut', icon: '🧭' },
  page_visit_1000: { name: 'Hyper Hopper', icon: '⚡' },
  page_visit_2000: { name: 'Grid Glider', icon: '🛸' },
  page_visit_5000: { name: 'Terminal Tourist Supreme', icon: '🌐' },
  page_visit_10000: { name: 'Dimension Drifter', icon: '🌀' },
  page_visit_99999: { name: 'Omnipresent Navigator', icon: '♾️' },
  profile_visit_10: { name: 'Profile Peeker', icon: '👀' },
  profile_visit_50: { name: 'Profile Prowler', icon: '🕵️' },
  profile_visit_100: { name: 'Profile Pilgrim', icon: '🚶' },
  profile_visit_250: { name: 'Identity Investigator', icon: '🔍' },
  profile_visit_500: { name: 'Member Mapper', icon: '🗺️' },
  profile_visit_1000: { name: 'Avatar Auditor', icon: '⚡' },
  profile_visit_2000: { name: 'Bio Browser', icon: '🛸' },
  profile_visit_5000: { name: 'Profile Pathfinder Supreme', icon: '🌐' },
  profile_visit_10000: { name: 'Omniscient Observer', icon: '🌀' },
  profile_visit_99999: { name: 'Universal Profile Phantom', icon: '♾️' },
  shoutbox_send_10: { name: 'Shoutbox Starter', icon: '💬' },
  shoutbox_send_50: { name: 'Chat Chatter', icon: '🗨️' },
  shoutbox_send_100: { name: 'Lobby Regular', icon: '📣' },
  shoutbox_send_250: { name: 'Terminal Talker', icon: '🎙️' },
  shoutbox_send_500: { name: 'Shoutbox Specialist', icon: '📡' },
  shoutbox_send_1000: { name: 'Message Maverick', icon: '⚡' },
  shoutbox_send_2000: { name: 'Broadcast Buff', icon: '🛸' },
  shoutbox_send_5000: { name: 'Shoutbox Supreme', icon: '🌐' },
  shoutbox_send_10000: { name: 'Grid Communicator', icon: '🌀' },
  shoutbox_send_99999: { name: 'Eternal Broadcaster', icon: '♾️' },
  changelog_read_10: { name: 'Changelog Peek', icon: '📜' },
  changelog_read_50: { name: 'Patch Pilgrim', icon: '📋' },
  changelog_read_100: { name: 'Release Reader', icon: '📖' },
  changelog_read_250: { name: 'Version Marathoner', icon: '🗞️' },
  changelog_read_500: { name: 'Update Enthusiast', icon: '📰' },
  changelog_read_1000: { name: 'Changelog Devotee', icon: '⚡' },
  changelog_read_2000: { name: 'Patch Historian', icon: '🛸' },
  changelog_read_5000: { name: 'Release Notes Supreme', icon: '🌐' },
  changelog_read_10000: { name: 'Version Archivist', icon: '🌀' },
  changelog_read_99999: { name: 'Eternal Changelog Keeper', icon: '♾️' },
  image_upload_10: { name: 'Upload Initiate', icon: '📤' },
  image_upload_50: { name: 'Pixel Pusher', icon: '🖼️' },
  image_upload_100: { name: 'Gallery Grower', icon: '🎨' },
  image_upload_250: { name: 'File Forager', icon: '📁' },
  image_upload_500: { name: 'Image Importer', icon: '🗂️' },
  image_upload_1000: { name: 'Hosting Hero', icon: '⚡' },
  image_upload_2000: { name: 'Cloud Collector', icon: '🛸' },
  image_upload_5000: { name: 'Upload Supreme', icon: '🌐' },
  image_upload_10000: { name: 'Pixel Phantom', icon: '🌀' },
  image_upload_99999: { name: 'Eternal Archivist', icon: '♾️' },
  online_minutes_10: { name: 'Online Novice', icon: '🟢' },
  online_minutes_50: { name: 'Session Starter', icon: '⏱️' },
  online_minutes_100: { name: 'Presence Pilot', icon: '⌚' },
  online_minutes_250: { name: 'Terminal Tenant', icon: '🏠' },
  online_minutes_500: { name: 'Connected Citizen', icon: '📡' },
  online_minutes_1000: { name: 'Uptime Unicorn', icon: '⚡' },
  online_minutes_2000: { name: 'Always Awake', icon: '🛸' },
  online_minutes_5000: { name: 'Eternal Session', icon: '🌐' },
  online_minutes_10000: { name: 'Grid Guardian', icon: '🌀' },
  online_minutes_99999: { name: 'Omnipresent Entity', icon: '♾️' },
  lb_top_profile_views: { name: 'Profile Icon', icon: '👁️' },
  lb_top_referrals: { name: 'Referral Rocket', icon: '🚀' },
  lb_top_uploader: { name: 'Cloud Champion', icon: '☁️' },
  lb_top_meme_creator: { name: 'Meme Monarch', icon: '👑' },
  lb_top_online: { name: 'Uptime Elite', icon: '⏱️' },
  lb_top_commands: { name: 'Command Lord', icon: '⌨️' },
  lb_top_achievements: { name: 'Trophy Hunter', icon: '🏆' },
  lb_top_shoutbox: { name: 'Shoutbox Star', icon: '📣' },
  lb_top_explorer: { name: 'Tab Titan', icon: '🧭' },
  lb_top_vault: { name: 'Vault Victor', icon: '💎' },
  lb_top_paste_creator: { name: 'Snippet Supreme', icon: '📋' },
  lb_top_paste_views: { name: 'Paste Phenom', icon: '⭐' },
  lb_top_game_wins: { name: 'RPS Champion', icon: '✊' },
  lb_top_game_losses: { name: 'RPS Glutton', icon: '💀' },
  lb_top_game_games: { name: 'Arcade Addict', icon: '🎮' },
  lb_top_lul_coins: { name: 'LULcoin Tycoon', icon: '🪙' },
  paste_explorer: { name: 'Paste Explorer', icon: '📋' },
  paste_pioneer: { name: 'Paste Pioneer', icon: '📋' },
  games_explorer: { name: 'Games Explorer', icon: '🎮' },
  rps_first_play: { name: 'Arena Debut', icon: '🎲' },
  rps_first_win: { name: 'First Blood', icon: '✊' },
  rps_win_10: { name: 'RPS Fighter', icon: '🥊' },
  rps_win_50: { name: 'RPS Master', icon: '👑' },
  rps_win_100: { name: 'RPS Legend', icon: '🏆' },
  rps_stein_fan: { name: 'Rock Fan', icon: '✊' },
  rps_papier_fan: { name: 'Paper Fan', icon: '✋' },
  rps_schere_fan: { name: 'Scissors Fan', icon: '✌️' },
  rps_stein_master: { name: 'Rock Master', icon: '🪨' },
  rps_papier_master: { name: 'Paper Master', icon: '📜' },
  rps_schere_master: { name: 'Scissors Master', icon: '✂️' },
  rps_streak_5: { name: 'Hot Hand', icon: '🔥' },
  rps_streak_10: { name: 'Unstoppable', icon: '⚡' },
  rps_glutton_10: { name: 'RPS Glutton', icon: '💀' },
  ttt_first_play: { name: 'Grid Debut', icon: '🔲' },
  ttt_first_win: { name: 'Three in a Row', icon: '⭕' },
  ttt_win_10: { name: 'TTT Fighter', icon: '🥊' },
  ttt_win_50: { name: 'TTT Master', icon: '👑' },
  ttt_glutton_10: { name: 'TTT Glutton', icon: '💀' },
  ttt_streak_5: { name: 'Grid Streak', icon: '🔥' },
  arcade_variety_5: { name: 'Arcade Tourist', icon: '🗺️' },
  arcade_variety_10: { name: 'Arcade Explorer', icon: '🧭' },
  arcade_variety_all: { name: 'Arcade Completionist', icon: '👑' },
  arcade_total_100: { name: 'Coin Duelist', icon: '⚔️' },
  arcade_total_500: { name: 'Terminal Gladiator', icon: '🏟️' },
  jackpot_hunter: { name: 'Jackpot Hunter', icon: '🎰' },
  lul_coins_5000: { name: 'Coin Baron', icon: '🪙' },
};

const MILESTONE_COUNTS = [10, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 99999];

const PASTE_CREATE_CHAT = {
  10: { name: 'Snippet Starter', icon: '📋' },
  50: { name: 'Code Curator', icon: '📝' },
  100: { name: 'Paste Pro', icon: '⚡' },
  250: { name: 'Buffer Boss', icon: '🗂️' },
  500: { name: 'Clipboard Captain', icon: '📎' },
  1000: { name: 'Snippet Sovereign', icon: '👑' },
  2000: { name: 'Paste Phantom', icon: '🛸' },
  5000: { name: 'Archive Architect', icon: '🌐' },
  10000: { name: 'Code Cosmos', icon: '🌀' },
  99999: { name: 'Eternal Paste Lord', icon: '♾️' },
};

const PASTE_VIEWS_CHAT = {
  10: { name: 'First Glance', icon: '👀' },
  50: { name: 'Link Lurker', icon: '🔗' },
  100: { name: 'View Vanguard', icon: '📊' },
  250: { name: 'Traffic Tamer', icon: '🚦' },
  500: { name: 'Share Specialist', icon: '📡' },
  1000: { name: 'Viral Vector', icon: '⚡' },
  2000: { name: 'Read Receipt Royalty', icon: '🛸' },
  5000: { name: 'Paste Phenomenon', icon: '🌐' },
  10000: { name: 'Omniscient Observer', icon: '🌀' },
  99999: { name: 'Universal View Counter', icon: '♾️' },
};

const RPS_GAMES_CHAT = {
  10: { name: 'Arcade Rookie', icon: '🎲' },
  50: { name: 'Arena Regular', icon: '🕹️' },
  100: { name: 'Coin Duelist', icon: '⚔️' },
  250: { name: 'Terminal Gladiator', icon: '🏟️' },
};

for (const count of MILESTONE_COUNTS) {
  if (PASTE_CREATE_CHAT[count]) {
    ACHIEVEMENT_LOOKUP[`paste_create_${count}`] = PASTE_CREATE_CHAT[count];
  }
  if (PASTE_VIEWS_CHAT[count]) {
    ACHIEVEMENT_LOOKUP[`paste_views_${count}`] = PASTE_VIEWS_CHAT[count];
  }
}

for (const [count, meta] of Object.entries(RPS_GAMES_CHAT)) {
  ACHIEVEMENT_LOOKUP[`rps_games_${count}`] = meta;
}

const TTT_GAMES_CHAT = {
  10: { name: 'Grid Rookie', icon: '🔲' },
  50: { name: 'Board Regular', icon: '📐' },
};

for (const [count, meta] of Object.entries(TTT_GAMES_CHAT)) {
  ACHIEVEMENT_LOOKUP[`ttt_games_${count}`] = meta;
}

for (const g of ARCADE_GAMES_META) {
  ACHIEVEMENT_LOOKUP[lbWinsAwardId(g.id)] = { name: `${g.shortLabel} Champion`, icon: g.icon };
  if (g.extendedAchievements) continue;
  ACHIEVEMENT_LOOKUP[`${g.id}_first_play`] = { name: `${g.shortLabel} Debut`, icon: g.icon };
  ACHIEVEMENT_LOOKUP[`${g.id}_first_win`] = { name: `${g.shortLabel} Victor`, icon: '🏅' };
  ACHIEVEMENT_LOOKUP[`${g.id}_win_10`] = { name: `${g.shortLabel} Fighter`, icon: '🥊' };
}

/** Resolve display meta for shoutbox achievement congrats. */
export function resolveAchievementChat(id) {
  const key = String(id ?? '').trim();
  if (!key) return { name: 'Achievement', icon: '🏆' };
  return ACHIEVEMENT_LOOKUP[key] ?? {
    name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: '🏆',
  };
}