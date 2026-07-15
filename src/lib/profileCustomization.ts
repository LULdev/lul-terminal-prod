/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { GAME_CATALOG_MAP } from '../lib/gameCatalog';
import { computeArcadeSummary } from '../lib/arcadeStats';
import {
  DEFAULT_PROFILE_CUSTOMIZATION,
  type ProfileCustomization,
} from '../types/profileCustomization';

const FORTUNE_TIPS = [
  'Bet small, streak big.',
  'Variety unlocks meta achievements.',
  'Jackpots favor the bold.',
  'Read the changelog — free wisdom.',
  'A draw still teaches patience.',
  'Your next rival might be a bot.',
  'Profile views are social XP.',
  'Coin flip: 50% skill, 50% luck, 100% drama.',
];

export function resolveCustomization(raw?: ProfileCustomization | null): ProfileCustomization {
  if (!raw) return { ...DEFAULT_PROFILE_CUSTOMIZATION, privacy: { ...DEFAULT_PROFILE_CUSTOMIZATION.privacy } };
  return {
    ...DEFAULT_PROFILE_CUSTOMIZATION,
    ...raw,
    status: { ...DEFAULT_PROFILE_CUSTOMIZATION.status, ...raw.status },
    privacy: { ...DEFAULT_PROFILE_CUSTOMIZATION.privacy, ...raw.privacy },
  };
}

export function daysInMonth(month: number): number {
  if (month === 2) return 29;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

export function clampBirthdayDay(month: number | null | undefined, day: number | null | undefined): number | null {
  if (day == null || !Number.isFinite(day)) return null;
  const d = Math.floor(day);
  if (d < 1) return null;
  const max = month ? daysInMonth(month) : 31;
  return d <= max ? d : null;
}

export function computeProfileCompletion(
  user: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    coverUrl?: string;
    website?: string;
    socialLinks?: { url?: string }[];
  },
  custom: ProfileCustomization,
  opts?: { showActivityStats?: boolean },
): { percent: number; missing: string[] } {
  const showActivity = opts?.showActivityStats !== false;
  const checks: [boolean, string][] = [
    [Boolean(user.displayName?.trim()), 'Display name'],
    [Boolean(user.bio?.trim()), 'Bio'],
    [Boolean(user.avatarUrl?.trim()), 'Avatar'],
    [Boolean(user.coverUrl?.trim()), 'Cover'],
    [Boolean(custom.status.text?.trim()), 'Status'],
    [Boolean(custom.tagline?.trim()), 'Tagline'],
    [Boolean(custom.pronouns?.trim()), 'Pronouns'],
    [Boolean(custom.location?.trim()), 'Location'],
    [Boolean(custom.askMeAbout?.trim()), 'Ask me about'],
    [Boolean(custom.funFact?.trim()), 'Fun fact'],
    [Boolean((user.socialLinks ?? []).some((l) => l.url?.trim())), 'Social link'],
    ...(showActivity ? [
      [Boolean(custom.featuredAchievementId), 'Featured trophy'] as [boolean, string],
      [Boolean(custom.favoriteGame), 'Favorite game'] as [boolean, string],
    ] : []),
    [Boolean(custom.vibeTag?.trim()), 'Vibe tag'],
    [Boolean(user.website?.trim()), 'Website'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return { percent: Math.round((done / checks.length) * 100), missing };
}

export function computeProfileLevel(achievementCount: number): { level: number; label: string; nextAt: number; progress: number } {
  const thresholds = [0, 3, 8, 15, 25, 40, 60, 90, 130, 180];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (achievementCount >= thresholds[i]) level = i + 1;
    else break;
  }
  const cur = thresholds[level - 1] ?? 0;
  const next = thresholds[level] ?? thresholds[thresholds.length - 1] + 50;
  const progress = next > cur ? Math.min(100, Math.round(((achievementCount - cur) / (next - cur)) * 100)) : 100;
  const labels = ['Rookie', 'Regular', 'Rising', 'Skilled', 'Veteran', 'Elite', 'Legend', 'Mythic', 'Transcendent', 'Immortal'];
  return { level, label: labels[Math.min(level - 1, labels.length - 1)], nextAt: next, progress };
}

export function computeArcadeTitle(source: object): string {
  const s = computeArcadeSummary(source);
  if (s.jackpotsWon >= 5) return 'Jackpot Hunter';
  if (s.variety >= 14) return 'Arcade Completionist';
  if (s.totalGames >= 500) return 'Gladiator';
  if (s.totalGames >= 100) return 'Coin Duelist';
  if (s.bestStreak >= 10) return 'Streak Machine';
  if (s.variety >= 8) return 'Arcade Explorer';
  if (s.totalGames >= 20) return 'High Roller';
  if (s.totalGames >= 1) return 'Arcade Tourist';
  return 'Newcomer';
}

export function computeTenureBadge(createdAt: number): { label: string; emoji: string } | null {
  const days = (Date.now() - createdAt) / 86400000;
  if (days >= 365) return { label: 'OG Member', emoji: '👑' };
  if (days >= 180) return { label: 'Veteran', emoji: '🛡️' };
  if (days >= 90) return { label: 'Regular', emoji: '⭐' };
  if (days >= 30) return { label: 'Settled In', emoji: '🌱' };
  return null;
}

export function computeSleepStyle(lastLoginAt: number | null | undefined): { label: string; emoji: string } | null {
  if (!lastLoginAt) return null;
  const h = new Date(lastLoginAt).getHours();
  if (h >= 0 && h < 5) return { label: 'Night Owl', emoji: '🦉' };
  if (h >= 5 && h < 9) return { label: 'Early Bird', emoji: '🌅' };
  return null;
}

export function computePersonalityType(
  custom: ProfileCustomization,
  stats: { totalGames: number; achievements: number; profileViews: number },
): string {
  if (custom.mood === 'chaotic') return 'Chaos Gremlin';
  if (custom.mood === 'grinding' && stats.totalGames > 50) return 'Grind Lord';
  if (stats.achievements > 30) return 'Trophy Hoarder';
  if (stats.profileViews > 200) return 'Magnetic Profile';
  if (custom.mood === 'vibing') return 'Good Vibes Only';
  if (custom.mood === 'focus') return 'Laser Focus';
  if (stats.totalGames > 100) return 'Arena Regular';
  return 'Terminal Wanderer';
}

export function formatBirthday(month: number | null, day: number | null): string | null {
  if (!month || !day) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}`;
}

export function formatLastSeen(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

export function profileViewsMilestone(views: number): { next: number; progress: number } {
  const milestones = [10, 50, 100, 250, 500, 1000, 5000];
  const next = milestones.find((m) => views < m) ?? views + 1000;
  const prev = milestones.filter((m) => views >= m).pop() ?? 0;
  const progress = next > prev ? Math.min(100, Math.round(((views - prev) / (next - prev)) * 100)) : 100;
  return { next, progress };
}

export function randomFortuneTip(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return FORTUNE_TIPS[Math.abs(h) % FORTUNE_TIPS.length];
}

export function featuredAchievement(custom: ProfileCustomization, earnedIds: Set<string>) {
  if (!custom.featuredAchievementId || !earnedIds.has(custom.featuredAchievementId)) return null;
  return ACHIEVEMENT_BY_ID[custom.featuredAchievementId] ?? null;
}

export function favoriteGameLabel(gameId: string): string | null {
  if (!gameId) return null;
  return GAME_CATALOG_MAP[gameId]?.label ?? gameId;
}