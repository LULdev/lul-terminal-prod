/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ARCADE_LB_AWARDS,
  ARCADE_META_ACHIEVEMENTS,
  ARCADE_STANDARD_ACHIEVEMENTS,
} from './arcadeAchievements';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type AchievementKind = 'achievement' | 'award';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'plasma' | 'mythic' | 'admin';
export type AchievementDifficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'legendary' | 'exclusive';

export type EarnedAchievement = {
  id: string;
  earnedAt: number;
  coinReward?: number;
};

export type AchievementDef = {
  id: string;
  kind: AchievementKind;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  tier: AchievementTier;
  difficulty: AchievementDifficulty;
  howToUnlock: string;
  auto?: boolean;
};

export const DIFFICULTY_LABELS: Record<AchievementDifficulty, string> = {
  trivial: 'Very Easy',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  legendary: 'Legendary',
  exclusive: 'Exclusive',
};

export const DIFFICULTY_STYLES: Record<AchievementDifficulty, string> = {
  trivial: 'achievement-diff-trivial',
  easy: 'achievement-diff-easy',
  medium: 'achievement-diff-medium',
  hard: 'achievement-diff-hard',
  legendary: 'achievement-diff-legendary',
  exclusive: 'achievement-diff-exclusive',
};

export const PAGE_VISIT_MILESTONES = [
  10, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 99999,
] as const;

const PAGE_VISIT_META: Record<
  (typeof PAGE_VISIT_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Tab Tourist', icon: '🧭', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Page Pilgrim', icon: '🚶', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'Route Runner', icon: '🏃', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'Menu Marathoner', icon: '🗺️', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Navigation Nut', icon: '🧭', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Hyper Hopper', icon: '⚡', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Grid Glider', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Terminal Tourist Supreme', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Dimension Drifter', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Omnipresent Navigator', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const PAGE_VISIT_ACHIEVEMENTS: AchievementDef[] = PAGE_VISIT_MILESTONES.map((count) => {
  const meta = PAGE_VISIT_META[count];
  return {
    id: `page_visit_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count.toLocaleString('en-US')} tabs or pages visited — you know every menu item.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Open a total of ${count.toLocaleString('en-US')} menu tabs or pages (while logged in).`,
    auto: true,
  };
});

export const PROFILE_VISIT_MILESTONES = PAGE_VISIT_MILESTONES;

const PROFILE_VISIT_META: Record<
  (typeof PROFILE_VISIT_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Profile Peeker', icon: '👀', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Profile Prowler', icon: '🕵️', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'Profile Pilgrim', icon: '🚶', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'Identity Investigator', icon: '🔍', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Member Mapper', icon: '🗺️', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Avatar Auditor', icon: '⚡', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Bio Browser', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Profile Pathfinder Supreme', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Omniscient Observer', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Universal Profile Phantom', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const PROFILE_VISIT_ACHIEVEMENTS: AchievementDef[] = PROFILE_VISIT_MILESTONES.map((count) => {
  const meta = PROFILE_VISIT_META[count];
  return {
    id: `profile_visit_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count.toLocaleString('en-US')} other profiles visited — you know the community.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Visit a total of ${count.toLocaleString('en-US')} other member profiles (while logged in).`,
    auto: true,
  };
});

export const SHOUTBOX_SEND_MILESTONES = PAGE_VISIT_MILESTONES;

const SHOUTBOX_SEND_META: Record<
  (typeof SHOUTBOX_SEND_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Shoutbox Starter', icon: '💬', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Chat Chatter', icon: '🗨️', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'Lobby Regular', icon: '📣', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'Terminal Talker', icon: '🎙️', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Shoutbox Specialist', icon: '📡', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Message Maverick', icon: '⚡', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Broadcast Buff', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Shoutbox Supreme', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Grid Communicator', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Eternal Broadcaster', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const SHOUTBOX_SEND_ACHIEVEMENTS: AchievementDef[] = SHOUTBOX_SEND_MILESTONES.map((count) => {
  const meta = SHOUTBOX_SEND_META[count];
  return {
    id: `shoutbox_send_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count.toLocaleString('en-US')} shoutbox messages sent — the lobby knows your voice.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Send a total of ${count.toLocaleString('en-US')} messages in the shoutbox.`,
    auto: true,
  };
});

export const CHANGELOG_READ_MILESTONES = PAGE_VISIT_MILESTONES;

const CHANGELOG_READ_META: Record<
  (typeof CHANGELOG_READ_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Changelog Peek', icon: '📜', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Patch Pilgrim', icon: '📋', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'Release Reader', icon: '📖', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'Version Marathoner', icon: '🗞️', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Update Enthusiast', icon: '📰', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Changelog Devotee', icon: '⚡', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Patch Historian', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Release Notes Supreme', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Version Archivist', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Eternal Changelog Keeper', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const CHANGELOG_READ_ACHIEVEMENTS: AchievementDef[] = CHANGELOG_READ_MILESTONES.map((count) => {
  const meta = CHANGELOG_READ_META[count];
  return {
    id: `changelog_read_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `Read new changelog entries ${count.toLocaleString('en-US')} times — you never miss an update.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Read new changelog entries a total of ${count.toLocaleString('en-US')} times (menu badge, while logged in).`,
    auto: true,
  };
});

export const IMAGE_UPLOAD_MILESTONES = PAGE_VISIT_MILESTONES;

const IMAGE_UPLOAD_META: Record<
  (typeof IMAGE_UPLOAD_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Upload Initiate', icon: '📤', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Pixel Pusher', icon: '🖼️', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'Gallery Grower', icon: '🎨', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'File Forager', icon: '📁', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Image Importer', icon: '🗂️', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Hosting Hero', icon: '⚡', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Cloud Collector', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Upload Supreme', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Pixel Phantom', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Eternal Archivist', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const IMAGE_UPLOAD_ACHIEVEMENTS: AchievementDef[] = IMAGE_UPLOAD_MILESTONES.map((count) => {
  const meta = IMAGE_UPLOAD_META[count];
  return {
    id: `image_upload_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count.toLocaleString('en-US')} images uploaded — your cloud archive keeps growing.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Upload a total of ${count.toLocaleString('en-US')} images via Image Hosting (while logged in).`,
    auto: true,
  };
});

export const PASTE_CREATE_MILESTONES = PAGE_VISIT_MILESTONES;

const PASTE_CREATE_META: Record<
  (typeof PASTE_CREATE_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Snippet Starter', icon: '📋', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Code Curator', icon: '📝', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'Paste Pro', icon: '⚡', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'Buffer Boss', icon: '🗂️', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Clipboard Captain', icon: '📎', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Snippet Sovereign', icon: '👑', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Paste Phantom', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Archive Architect', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Code Cosmos', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Eternal Paste Lord', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const PASTE_CREATE_ACHIEVEMENTS: AchievementDef[] = PASTE_CREATE_MILESTONES.map((count) => {
  const meta = PASTE_CREATE_META[count];
  return {
    id: `paste_create_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count.toLocaleString('en-US')} pastes created — your snippet library keeps growing.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Create a total of ${count.toLocaleString('en-US')} pastes (while logged in).`,
    auto: true,
  };
});

export const PASTE_VIEWS_MILESTONES = PAGE_VISIT_MILESTONES;

const PASTE_VIEWS_META: Record<
  (typeof PASTE_VIEWS_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'First Glance', icon: '👀', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Link Lurker', icon: '🔗', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'View Vanguard', icon: '📊', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'Traffic Tamer', icon: '🚦', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Share Specialist', icon: '📡', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Viral Vector', icon: '⚡', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Read Receipt Royalty', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Paste Phenomenon', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Omniscient Observer', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Universal View Counter', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const PASTE_VIEWS_ACHIEVEMENTS: AchievementDef[] = PASTE_VIEWS_MILESTONES.map((count) => {
  const meta = PASTE_VIEWS_META[count];
  return {
    id: `paste_views_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count.toLocaleString('en-US')} total views on your pastes — the world reads your code.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Accumulate ${count.toLocaleString('en-US')} total views across all your pastes.`,
    auto: true,
  };
});

export const RPS_GAME_MILESTONES = [10, 50, 100, 250] as const;

const RPS_GAME_META: Record<
  (typeof RPS_GAME_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Arcade Rookie', icon: '🎲', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  50: { name: 'Arena Regular', icon: '🕹️', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  100: { name: 'Coin Duelist', icon: '⚔️', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  250: { name: 'Terminal Gladiator', icon: '🏟️', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
};

export const RPS_GAME_ACHIEVEMENTS: AchievementDef[] = RPS_GAME_MILESTONES.map((count) => {
  const meta = RPS_GAME_META[count];
  return {
    id: `rps_games_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count} Rock Paper Scissors matches played — the arena knows your name.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Play ${count} RPS matches (PvP or vs BOT).`,
    auto: true,
  };
});

export const TTT_GAME_MILESTONES = [10, 50] as const;

const TTT_GAME_META: Record<
  (typeof TTT_GAME_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Grid Rookie', icon: '🔲', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  50: { name: 'Board Regular', icon: '📐', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
};

export const TTT_GAME_ACHIEVEMENTS: AchievementDef[] = TTT_GAME_MILESTONES.map((count) => {
  const meta = TTT_GAME_META[count];
  return {
    id: `ttt_games_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count} Tic-Tac-Toe matches played — the grid knows your name.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Play ${count} Tic-Tac-Toe matches (PvP or vs BOT).`,
    auto: true,
  };
});

export const RPS_MOVE_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'rps_stein_fan',
    kind: 'achievement',
    name: 'Rock Fan',
    description: 'Twenty-five rock picks — rock solid commitment.',
    icon: '✊',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Choose rock 25 times in RPS matches.',
    auto: true,
  },
  {
    id: 'rps_papier_fan',
    kind: 'achievement',
    name: 'Paper Fan',
    description: 'Twenty-five paper picks — documentation wins arguments.',
    icon: '✋',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Choose paper 25 times in RPS matches.',
    auto: true,
  },
  {
    id: 'rps_schere_fan',
    kind: 'achievement',
    name: 'Scissors Fan',
    description: 'Twenty-five scissors picks — cut through the meta.',
    icon: '✌️',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Choose scissors 25 times in RPS matches.',
    auto: true,
  },
  {
    id: 'rps_stein_master',
    kind: 'achievement',
    name: 'Rock Master',
    description: 'One hundred rock picks — immovable object energy.',
    icon: '🪨',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Choose rock 100 times in RPS matches.',
    auto: true,
  },
  {
    id: 'rps_papier_master',
    kind: 'achievement',
    name: 'Paper Master',
    description: 'One hundred paper picks — wrap the competition.',
    icon: '📜',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Choose paper 100 times in RPS matches.',
    auto: true,
  },
  {
    id: 'rps_schere_master',
    kind: 'achievement',
    name: 'Scissors Master',
    description: 'One hundred scissors picks — sharp instincts.',
    icon: '✂️',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Choose scissors 100 times in RPS matches.',
    auto: true,
  },
];

export const ONLINE_MINUTES_MILESTONES = PAGE_VISIT_MILESTONES;

const ONLINE_MINUTES_META: Record<
  (typeof ONLINE_MINUTES_MILESTONES)[number],
  Pick<AchievementDef, 'name' | 'icon' | 'rarity' | 'tier' | 'difficulty'>
> = {
  10: { name: 'Online Novice', icon: '🟢', rarity: 'common', tier: 'bronze', difficulty: 'trivial' },
  50: { name: 'Session Starter', icon: '⏱️', rarity: 'common', tier: 'bronze', difficulty: 'easy' },
  100: { name: 'Presence Pilot', icon: '⌚', rarity: 'common', tier: 'silver', difficulty: 'easy' },
  250: { name: 'Terminal Tenant', icon: '🏠', rarity: 'rare', tier: 'silver', difficulty: 'medium' },
  500: { name: 'Connected Citizen', icon: '📡', rarity: 'rare', tier: 'gold', difficulty: 'medium' },
  1000: { name: 'Uptime Unicorn', icon: '⚡', rarity: 'epic', tier: 'gold', difficulty: 'hard' },
  2000: { name: 'Always Awake', icon: '🛸', rarity: 'epic', tier: 'plasma', difficulty: 'hard' },
  5000: { name: 'Eternal Session', icon: '🌐', rarity: 'legendary', tier: 'plasma', difficulty: 'legendary' },
  10000: { name: 'Grid Guardian', icon: '🌀', rarity: 'legendary', tier: 'mythic', difficulty: 'legendary' },
  99999: { name: 'Omnipresent Entity', icon: '♾️', rarity: 'mythic', tier: 'mythic', difficulty: 'legendary' },
};

export const ONLINE_MINUTES_ACHIEVEMENTS: AchievementDef[] = ONLINE_MINUTES_MILESTONES.map((count) => {
  const meta = ONLINE_MINUTES_META[count];
  return {
    id: `online_minutes_${count}`,
    kind: 'achievement' as const,
    name: meta.name,
    description: `${count.toLocaleString('en-US')} minutes online — the terminal knows your presence.`,
    icon: meta.icon,
    rarity: meta.rarity,
    tier: meta.tier,
    difficulty: meta.difficulty,
    howToUnlock: `Be online in the terminal for a total of ${count.toLocaleString('en-US')} minutes (while logged in).`,
    auto: true,
  };
});

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  {
    id: 'journey_begins',
    kind: 'achievement',
    name: 'The Journey Begins',
    description: 'You signed in for the first time — welcome to the terminal.',
    icon: '🚀',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'trivial',
    howToUnlock: 'Sign in with your account for the first time.',
    auto: true,
  },
  {
    id: 'identity_forge',
    kind: 'achievement',
    name: 'Profile Pioneer',
    description: 'Website and short bio filled out on your profile.',
    icon: '✏️',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Save your profile with website and bio.',
  },
  {
    id: 'avatar_artist',
    kind: 'achievement',
    name: 'Avatar Artist',
    description: 'Uploaded your own profile picture — no more default avatar.',
    icon: '🎨',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'easy',
    howToUnlock: 'Upload a custom avatar image in profile settings.',
  },
  {
    id: 'social_butterfly',
    kind: 'achievement',
    name: 'Social Butterfly',
    description: 'Three or more social media links connected.',
    icon: '🦋',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Add at least 3 social media accounts to your profile.',
  },
  {
    id: 'faq_scholar',
    kind: 'achievement',
    name: 'FAQ Scholar',
    description: 'Read the FAQ — you know where to find help.',
    icon: '📚',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Open the FAQ menu item at least once (while logged in).',
  },
  {
    id: 'changelog_keeper',
    kind: 'achievement',
    name: 'Changelog Keeper',
    description: 'Opened the Change Log — you stay up to date.',
    icon: '📜',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Open the "Change Log" menu item (while logged in).',
  },
  ...CHANGELOG_READ_ACHIEVEMENTS,
  ...PAGE_VISIT_ACHIEVEMENTS,
  ...PROFILE_VISIT_ACHIEVEMENTS,
  ...SHOUTBOX_SEND_ACHIEVEMENTS,
  ...IMAGE_UPLOAD_ACHIEVEMENTS,
  ...PASTE_CREATE_ACHIEVEMENTS,
  ...PASTE_VIEWS_ACHIEVEMENTS,
  ...RPS_GAME_ACHIEVEMENTS,
  ...TTT_GAME_ACHIEVEMENTS,
  ...ARCADE_STANDARD_ACHIEVEMENTS,
  ...ARCADE_META_ACHIEVEMENTS,
  ...ARCADE_LB_AWARDS,
  ...RPS_MOVE_ACHIEVEMENTS,
  ...ONLINE_MINUTES_ACHIEVEMENTS,
  {
    id: 'command_rookie',
    kind: 'achievement',
    name: 'Command Rookie',
    description: 'Executed five terminal commands.',
    icon: '⌨️',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Run 5 commands in the console (e.g. stats, joke, matrix).',
  },
  {
    id: 'command_master',
    kind: 'achievement',
    name: 'Command Master',
    description: 'Fifty commands — you master the CLI.',
    icon: '🖥️',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Run a total of 50 terminal commands.',
  },
  {
    id: 'matrix_rain',
    kind: 'achievement',
    name: 'Matrix Rain',
    description: 'Matrix protocol activated — green code rain is running.',
    icon: '🟢',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Type !matrix in the console and start the overlay.',
  },
  {
    id: 'self_destruct_init',
    kind: 'achievement',
    name: 'Red Alert',
    description: 'Self-destruct sequence started — courage or recklessness?',
    icon: '🚨',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'easy',
    howToUnlock: 'Run the !self-destruct command in the console.',
  },
  {
    id: 'fun_survivor',
    kind: 'achievement',
    name: 'Fun Survivor',
    description: 'Entered Fun & Trap — the gravity anomaly awaits.',
    icon: '🎮',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Open the "Fun & Trap" menu item (while logged in).',
  },
  {
    id: 'claw_victim',
    kind: 'achievement',
    name: 'Claw Victim',
    description: 'Caught by the Claw — the cursor was not fast enough.',
    icon: '🦀',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Get grabbed by the Claw in the Fun tab (gravity anomaly).',
  },
  {
    id: 'meme_lord',
    kind: 'achievement',
    name: 'Meme Lord',
    description: 'Visited the Meme Generator — template power activated.',
    icon: '🖼️',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Open the Meme Generator in the main menu.',
  },
  {
    id: 'image_host',
    kind: 'achievement',
    name: 'Cloud Uploader',
    description: 'Uploaded your first image via Image Hosting.',
    icon: '☁️',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Upload an image in the Image Hosting module (while logged in).',
  },
  {
    id: 'paste_explorer',
    kind: 'achievement',
    name: 'Paste Explorer',
    description: 'Opened the Paste module — snippets await.',
    icon: '📋',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'trivial',
    howToUnlock: 'Visit the Paste tab while logged in.',
    auto: true,
  },
  {
    id: 'paste_pioneer',
    kind: 'achievement',
    name: 'Paste Pioneer',
    description: 'Published your first paste — snippets are live.',
    icon: '📋',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Create your first paste in the Paste module (while logged in).',
    auto: true,
  },
  {
    id: 'proxy_hunter',
    kind: 'achievement',
    name: 'Proxy Hunter',
    description: 'Explored Proxy Scraper or Proxy Database.',
    icon: '🕸️',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Open Proxy Scraper or Proxy Database.',
  },
  {
    id: 'tool_vault_explorer',
    kind: 'achievement',
    name: 'Tool Vault Explorer',
    description: 'Discovered the 480+ micro-tools library.',
    icon: '🧰',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Open Tool Vault in the Labs.',
  },
  {
    id: 'identity_smith',
    kind: 'achievement',
    name: 'Identity Smith',
    description: 'Opened Identity Forge — personas await.',
    icon: '🎭',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Open Identity Forge in the Labs.',
  },
  {
    id: 'lab_explorer',
    kind: 'achievement',
    name: 'Lab Explorer',
    description: 'Visited all six labs — full toolbox unlocked.',
    icon: '🧪',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Visit each lab at least once: Net Toolkit, Identity Forge, Text Lab, Color Spectrum, Chaos Generator, Tool Vault.',
  },
  {
    id: 'cover_curator',
    kind: 'achievement',
    name: 'Cover Curator',
    description: 'Set a custom profile cover image.',
    icon: '🖌️',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Save a custom cover image (URL or gradient) on your profile.',
  },
  {
    id: 'social_network',
    kind: 'achievement',
    name: 'Social Network',
    description: 'Connected all eight social platforms.',
    icon: '🌐',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'hard',
    howToUnlock: 'Fill in all 8 social link fields on your profile (GitHub through LinkedIn).',
  },
  {
    id: 'night_owl',
    kind: 'achievement',
    name: 'Night Owl',
    description: 'Signed in at night — the terminal never sleeps.',
    icon: '🦉',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Sign in between 00:00 and 05:00 (server time).',
  },
  {
    id: 'returning_user',
    kind: 'achievement',
    name: 'Returning User',
    description: 'Five separate logins — you keep coming back.',
    icon: '🔁',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Sign in a total of 5 times (separate sessions).',
  },
  {
    id: 'veteran_member',
    kind: 'achievement',
    name: 'Veteran Member',
    description: 'Account older than 30 days — a true terminal veteran.',
    icon: '🎖️',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Keep your account active for 30 days (since registration).',
  },
  {
    id: 'verified_trust',
    kind: 'achievement',
    name: 'Trusted Contributor',
    description: 'Marked as a verified user.',
    icon: '✅',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'An admin assigns you the "Verified" rank.',
  },
  {
    id: 'vip_crown',
    kind: 'achievement',
    name: 'VIP Crown',
    description: 'Unlocked access to the Premium Vault.',
    icon: '👑',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Receive the VIP role (from an admin).',
  },
  {
    id: 'vault_contributor',
    kind: 'achievement',
    name: 'Vault Contributor',
    description: 'Submitted your first premium account.',
    icon: '📦',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Submit at least 1 premium account as a verified user.',
  },
  {
    id: 'vault_master',
    kind: 'achievement',
    name: 'Vault Master',
    description: 'Gifted ten accounts to the vault.',
    icon: '🏦',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'hard',
    howToUnlock: 'Submit 10 premium accounts.',
  },
  {
    id: 'vault_legend',
    kind: 'achievement',
    name: 'Vault Legend',
    description: 'Twenty-five accounts — vault legend.',
    icon: '💎',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'legendary',
    howToUnlock: 'Submit 25 premium accounts.',
  },
  {
    id: 'profile_star',
    kind: 'achievement',
    name: 'Profile Star',
    description: 'Your public profile was viewed 50 times.',
    icon: '⭐',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Reach 50 profile views on /profile/yourname.',
  },
  {
    id: 'profile_legend',
    kind: 'achievement',
    name: 'Profile Legend',
    description: 'Two hundred profile views — community icon.',
    icon: '🌟',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'legendary',
    howToUnlock: 'Reach 200 profile views on your public profile URL.',
  },
  {
    id: 'admin_profile_visitor',
    kind: 'achievement',
    name: 'Behind the Shield',
    description: 'Visited an admin profile — looked behind the shield.',
    icon: '🛡️',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'easy',
    howToUnlock: 'Open the public profile of an admin user (e.g. /profile/admin, while logged in).',
  },
  {
    id: 'owner',
    kind: 'award',
    name: 'Owner',
    description: 'Founder & owner of LUL Terminal.',
    icon: '🔱',
    rarity: 'mythic',
    tier: 'admin',
    difficulty: 'exclusive',
    howToUnlock: 'Exclusive to admin users.',
    auto: true,
  },
  {
    id: 'administrator',
    kind: 'award',
    name: 'Administrator',
    description: 'Full system control — dashboard & user management.',
    icon: '🛡️',
    rarity: 'mythic',
    tier: 'admin',
    difficulty: 'exclusive',
    howToUnlock: 'Exclusive to admin users.',
    auto: true,
  },
  {
    id: 'site_architect',
    kind: 'award',
    name: 'Site Architect',
    description: 'Designed & programmed this entire site.',
    icon: '⚡',
    rarity: 'mythic',
    tier: 'admin',
    difficulty: 'exclusive',
    howToUnlock: 'Exclusive to admin users (code mastermind).',
    auto: true,
  },
  {
    id: 'member_of_month',
    kind: 'award',
    name: 'Member of the Month',
    description: 'Outstanding community presence in the terminal.',
    icon: '🌟',
    rarity: 'mythic',
    tier: 'admin',
    difficulty: 'exclusive',
    howToUnlock: 'Exclusive to admin users.',
    auto: true,
  },
  {
    id: 'lb_top_profile_views',
    kind: 'award',
    name: 'Profile Icon',
    description: 'Top 3 on the Profile Views leaderboard.',
    icon: '👁️',
    rarity: 'legendary',
    tier: 'gold',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Profile Views on the public leaderboard.',
  },
  {
    id: 'lb_top_referrals',
    kind: 'award',
    name: 'Referral Rocket',
    description: 'Top 3 on the Referrals leaderboard.',
    icon: '🚀',
    rarity: 'legendary',
    tier: 'gold',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Referrals on the public leaderboard.',
  },
  {
    id: 'lb_top_uploader',
    kind: 'award',
    name: 'Cloud Champion',
    description: 'Top 3 on the Image Uploader leaderboard.',
    icon: '☁️',
    rarity: 'legendary',
    tier: 'gold',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Image Uploads on the public leaderboard.',
  },
  {
    id: 'lb_top_meme_creator',
    kind: 'award',
    name: 'Meme Monarch',
    description: 'Top 3 on the Meme Creator leaderboard.',
    icon: '👑',
    rarity: 'legendary',
    tier: 'gold',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Memes Created on the public leaderboard.',
  },
  {
    id: 'lb_top_online',
    kind: 'award',
    name: 'Uptime Elite',
    description: 'Top 3 on the Online Time leaderboard.',
    icon: '⏱️',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Online Minutes on the public leaderboard.',
  },
  {
    id: 'lb_top_commands',
    kind: 'award',
    name: 'Command Lord',
    description: 'Top 3 on the Terminal Commands leaderboard.',
    icon: '⌨️',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Commands Run on the public leaderboard.',
  },
  {
    id: 'lb_top_achievements',
    kind: 'award',
    name: 'Trophy Hunter',
    description: 'Top 3 on the Achievement Hunter leaderboard.',
    icon: '🏆',
    rarity: 'mythic',
    tier: 'mythic',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in total achievements on the public leaderboard.',
  },
  {
    id: 'lb_top_shoutbox',
    kind: 'award',
    name: 'Shoutbox Star',
    description: 'Top 3 on the Shoutbox leaderboard.',
    icon: '📣',
    rarity: 'legendary',
    tier: 'gold',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Shoutbox messages on the public leaderboard.',
  },
  {
    id: 'lb_top_explorer',
    kind: 'award',
    name: 'Tab Titan',
    description: 'Top 3 on the Page Explorer leaderboard.',
    icon: '🧭',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in page visits on the public leaderboard.',
  },
  {
    id: 'lb_top_vault',
    kind: 'award',
    name: 'Vault Victor',
    description: 'Top 3 on the Vault Submitter leaderboard.',
    icon: '💎',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in vault account submissions on the public leaderboard.',
  },
  {
    id: 'lb_top_paste_creator',
    kind: 'award',
    name: 'Snippet Supreme',
    description: 'Top 3 on the Paste Creator leaderboard.',
    icon: '📋',
    rarity: 'legendary',
    tier: 'gold',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in pastes created on the public leaderboard.',
  },
  {
    id: 'lb_top_paste_views',
    kind: 'award',
    name: 'Paste Phenom',
    description: 'Top 3 on the Paste Views leaderboard.',
    icon: '⭐',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in total paste views on the public leaderboard.',
  },
  {
    id: 'lb_top_game_wins',
    kind: 'award',
    name: 'RPS Champion',
    description: 'Top 3 on the RPS Wins leaderboard.',
    icon: '✊',
    rarity: 'legendary',
    tier: 'gold',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Rock Paper Scissors wins on the public leaderboard.',
  },
  {
    id: 'lb_top_game_losses',
    kind: 'award',
    name: 'RPS Glutton',
    description: 'Top 3 on the RPS Losses leaderboard.',
    icon: '💀',
    rarity: 'legendary',
    tier: 'silver',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in Rock Paper Scissors losses on the public leaderboard.',
  },
  {
    id: 'lb_top_game_games',
    kind: 'award',
    name: 'Arcade Addict',
    description: 'Top 3 on the RPS Games Played leaderboard.',
    icon: '🎮',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in total RPS games played on the public leaderboard.',
  },
  {
    id: 'lb_top_lul_coins',
    kind: 'award',
    name: 'LULcoin Tycoon',
    description: 'Top 3 on the LULcoin balance leaderboard.',
    icon: '🪙',
    rarity: 'mythic',
    tier: 'mythic',
    difficulty: 'exclusive',
    howToUnlock: 'Reach Top 3 in LULcoin balance on the public leaderboard.',
  },
  {
    id: 'games_explorer',
    kind: 'achievement',
    name: 'Games Explorer',
    description: 'You opened the Games arcade at least once.',
    icon: '🎮',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'trivial',
    howToUnlock: 'Visit the Games tab while logged in.',
    auto: true,
  },
  {
    id: 'rps_first_play',
    kind: 'achievement',
    name: 'Arena Debut',
    description: 'Your first Rock Paper Scissors match — welcome to the pit.',
    icon: '🎲',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'trivial',
    howToUnlock: 'Complete your first RPS match (PvP or vs BOT).',
    auto: true,
  },
  {
    id: 'rps_first_win',
    kind: 'achievement',
    name: 'First Blood',
    description: 'Your first Rock Paper Scissors victory.',
    icon: '✊',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Win your first RPS match (PvP or vs BOT).',
    auto: true,
  },
  {
    id: 'rps_win_10',
    kind: 'achievement',
    name: 'RPS Fighter',
    description: 'Ten RPS victories — you know the meta.',
    icon: '🥊',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Win 10 Rock Paper Scissors matches.',
    auto: true,
  },
  {
    id: 'rps_win_50',
    kind: 'achievement',
    name: 'RPS Master',
    description: 'Fifty RPS wins — legendary hand discipline.',
    icon: '👑',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Win 50 Rock Paper Scissors matches.',
    auto: true,
  },
  {
    id: 'rps_win_100',
    kind: 'achievement',
    name: 'RPS Legend',
    description: 'One hundred victories — the arena bows.',
    icon: '🏆',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'legendary',
    howToUnlock: 'Win 100 Rock Paper Scissors matches.',
    auto: true,
  },
  {
    id: 'rps_glutton_10',
    kind: 'achievement',
    name: 'RPS Glutton',
    description: 'Ten defeats — you feed the jackpot with style.',
    icon: '💀',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Lose 10 Rock Paper Scissors matches.',
    auto: true,
  },
  {
    id: 'rps_streak_5',
    kind: 'achievement',
    name: 'Hot Hand',
    description: 'Five wins in a row — streak bonus unlocked.',
    icon: '🔥',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Reach a best win streak of 5 in RPS.',
    auto: true,
  },
  {
    id: 'rps_streak_10',
    kind: 'achievement',
    name: 'Unstoppable',
    description: 'Ten wins in a row — coin rain follows.',
    icon: '⚡',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Reach a best win streak of 10 in RPS.',
    auto: true,
  },
  {
    id: 'ttt_first_play',
    kind: 'achievement',
    name: 'Grid Debut',
    description: 'Your first Tic-Tac-Toe match on the arcade board.',
    icon: '🔲',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'trivial',
    howToUnlock: 'Complete your first Tic-Tac-Toe match (PvP or vs BOT).',
    auto: true,
  },
  {
    id: 'ttt_first_win',
    kind: 'achievement',
    name: 'Three in a Row',
    description: 'Your first Tic-Tac-Toe victory.',
    icon: '⭕',
    rarity: 'common',
    tier: 'bronze',
    difficulty: 'easy',
    howToUnlock: 'Win your first Tic-Tac-Toe match.',
    auto: true,
  },
  {
    id: 'ttt_win_10',
    kind: 'achievement',
    name: 'TTT Fighter',
    description: 'Ten Tic-Tac-Toe victories — grid mastery unlocked.',
    icon: '🥊',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Win 10 Tic-Tac-Toe matches.',
    auto: true,
  },
  {
    id: 'ttt_win_50',
    kind: 'achievement',
    name: 'TTT Master',
    description: 'Fifty TTT wins — the board fears you.',
    icon: '👑',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Win 50 Tic-Tac-Toe matches.',
    auto: true,
  },
  {
    id: 'ttt_glutton_10',
    kind: 'achievement',
    name: 'TTT Glutton',
    description: 'Ten TTT defeats — you feed the jackpot with style.',
    icon: '💀',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Lose 10 Tic-Tac-Toe matches.',
    auto: true,
  },
  {
    id: 'ttt_streak_5',
    kind: 'achievement',
    name: 'Grid Streak',
    description: 'Five TTT wins in a row — streak bonus unlocked.',
    icon: '🔥',
    rarity: 'rare',
    tier: 'silver',
    difficulty: 'medium',
    howToUnlock: 'Reach a best win streak of 5 in Tic-Tac-Toe.',
    auto: true,
  },
  {
    id: 'jackpot_hunter',
    kind: 'achievement',
    name: 'Jackpot Hunter',
    description: 'You cracked the community jackpot pool.',
    icon: '🎰',
    rarity: 'legendary',
    tier: 'plasma',
    difficulty: 'legendary',
    howToUnlock: 'Trigger a jackpot payout on a PvP win (0.6% chance per victory).',
    auto: true,
  },
  {
    id: 'lul_coins_5000',
    kind: 'achievement',
    name: 'Coin Baron',
    description: 'Five thousand LULcoins in your wallet.',
    icon: '🪙',
    rarity: 'epic',
    tier: 'gold',
    difficulty: 'hard',
    howToUnlock: 'Hold at least 5,000 LULcoins at once.',
    auto: true,
  },
  {
    id: 'bot_supreme_nerd',
    kind: 'award',
    name: 'Supreme Nerd Automaton',
    description: 'Especially nerdy performance — the BOT keeps shoutbox, reviews & terminal automation running.',
    icon: '🤖',
    rarity: 'mythic',
    tier: 'plasma',
    difficulty: 'exclusive',
    howToUnlock: 'Exclusive to the system BOT.',
    auto: true,
  },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENT_CATALOG.map((a) => [a.id, a]),
) as Record<string, AchievementDef>;

export const LAB_TAB_IDS = ['tools', 'identity', 'textlab', 'colorlab', 'meme', 'toolvault'] as const;

export const TIER_STYLES: Record<AchievementTier, string> = {
  bronze: 'achievement-tier-bronze',
  silver: 'achievement-tier-silver',
  gold: 'achievement-tier-gold',
  plasma: 'achievement-tier-plasma',
  mythic: 'achievement-tier-mythic',
  admin: 'achievement-tier-admin',
};

/** Shiny rarity shell — primary visual for awards & achievements. */
export const RARITY_STYLES: Record<AchievementRarity, string> = {
  common: 'ach-rarity ach-rarity--common',
  rare: 'ach-rarity ach-rarity--rare',
  epic: 'ach-rarity ach-rarity--epic',
  legendary: 'ach-rarity ach-rarity--legendary',
  mythic: 'ach-rarity ach-rarity--mythic',
};

/** Combined badge classes for trophy chips / cards. */
export function achievementBadgeClass(
  def: Pick<AchievementDef, 'rarity' | 'tier'>,
  opts: { unlocked?: boolean; compact?: boolean } = {},
): string {
  const unlocked = opts.unlocked !== false;
  return [
    'ach-badge',
    opts.compact ? 'ach-badge--compact' : '',
    RARITY_STYLES[def.rarity],
    TIER_STYLES[def.tier],
    unlocked ? 'ach-badge--live' : 'ach-badge--locked',
  ].filter(Boolean).join(' ');
}

export const SOCIAL_PLATFORMS = [
  { id: 'github', label: 'GitHub', icon: '⌨️', placeholder: 'https://github.com/user' },
  { id: 'twitter', label: 'X / Twitter', icon: '𝕏', placeholder: 'https://x.com/user' },
  { id: 'discord', label: 'Discord', icon: '💬', placeholder: 'https://discord.gg/invite' },
  { id: 'instagram', label: 'Instagram', icon: '📸', placeholder: 'https://instagram.com/user' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', placeholder: 'https://youtube.com/@user' },
  { id: 'twitch', label: 'Twitch', icon: '🎮', placeholder: 'https://twitch.tv/user' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', placeholder: 'https://tiktok.com/@user' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', placeholder: 'https://linkedin.com/in/user' },
] as const;

export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]['id'];

export type SocialLink = {
  platform: SocialPlatformId | string;
  url: string;
};