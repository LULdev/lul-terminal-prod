/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProfileMood = 'chill' | 'grinding' | 'afk' | 'vibing' | 'chaotic' | 'focus' | 'sleepy';
export type ProfileAccentTheme = 'indigo' | 'rose' | 'emerald' | 'amber' | 'violet' | 'cyan' | 'fuchsia';
export type ProfileFrame = 'none' | 'gold' | 'neon' | 'holo' | 'fire';

export type ProfileStatus = {
  text: string;
  emoji: string;
  updatedAt: number | null;
};

export type ProfilePrivacy = {
  showEmail: boolean;
  showLocation: boolean;
  showLastSeen: boolean;
  showCoins: boolean;
  showActivityStats: boolean;
};

export type ProfileCustomization = {
  status: ProfileStatus;
  pronouns: string;
  location: string;
  timezone: string;
  tagline: string;
  mood: ProfileMood;
  vibeTag: string;
  favoriteEmoji: string;
  accentTheme: ProfileAccentTheme;
  featuredAchievementId: string;
  pinnedSocial: string;
  askMeAbout: string;
  favoriteGame: string;
  profileFrame: ProfileFrame;
  funFact: string;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  customTitle: string;
  privacy: ProfilePrivacy;
  /** Server-only on public profiles when showLastSeen is true */
  _lastSeenAt?: number | null;
};

export const DEFAULT_PROFILE_CUSTOMIZATION: ProfileCustomization = {
  status: { text: '', emoji: '✨', updatedAt: null },
  pronouns: '',
  location: '',
  timezone: '',
  tagline: '',
  mood: 'chill',
  vibeTag: '',
  favoriteEmoji: '✨',
  accentTheme: 'indigo',
  featuredAchievementId: '',
  pinnedSocial: '',
  askMeAbout: '',
  favoriteGame: '',
  profileFrame: 'none',
  funFact: '',
  birthdayMonth: null,
  birthdayDay: null,
  customTitle: '',
  privacy: {
    showEmail: false,
    showLocation: true,
    showLastSeen: true,
    showCoins: true,
    showActivityStats: true,
  },
};

export const STATUS_PRESETS = [
  { emoji: '🎮', text: 'In the arcade — challenge me' },
  { emoji: '💤', text: 'AFK — back soon' },
  { emoji: '🔥', text: 'On a win streak' },
  { emoji: '🪙', text: 'Grinding LULcoins' },
  { emoji: '🧠', text: 'Deep focus mode' },
  { emoji: '🎉', text: 'Vibing — good mood' },
  { emoji: '👀', text: 'Just lurking' },
  { emoji: '🚀', text: 'Exploring the terminal' },
] as const;

export const MOOD_OPTIONS: { id: ProfileMood; label: string; emoji: string }[] = [
  { id: 'chill', label: 'Chill', emoji: '😌' },
  { id: 'grinding', label: 'Grinding', emoji: '⚔️' },
  { id: 'afk', label: 'AFK', emoji: '💤' },
  { id: 'vibing', label: 'Vibing', emoji: '🎧' },
  { id: 'chaotic', label: 'Chaotic', emoji: '🌀' },
  { id: 'focus', label: 'Focus', emoji: '🎯' },
  { id: 'sleepy', label: 'Sleepy', emoji: '🌙' },
];

export const ACCENT_THEMES: { id: ProfileAccentTheme; label: string; gradient: string; ring: string; glow: string }[] = [
  { id: 'indigo', label: 'Indigo', gradient: 'from-indigo-600/30 via-violet-900/20 to-[#0c0d12]', ring: 'ring-indigo-500/40', glow: 'from-indigo-500/30' },
  { id: 'rose', label: 'Rose', gradient: 'from-rose-600/30 via-fuchsia-900/20 to-[#0c0d12]', ring: 'ring-rose-500/40', glow: 'from-rose-500/30' },
  { id: 'emerald', label: 'Emerald', gradient: 'from-emerald-600/25 via-teal-900/20 to-[#0c0d12]', ring: 'ring-emerald-500/40', glow: 'from-emerald-500/30' },
  { id: 'amber', label: 'Amber', gradient: 'from-amber-600/25 via-orange-900/20 to-[#0c0d12]', ring: 'ring-amber-500/40', glow: 'from-amber-500/30' },
  { id: 'violet', label: 'Violet', gradient: 'from-violet-600/30 via-purple-900/20 to-[#0c0d12]', ring: 'ring-violet-500/40', glow: 'from-violet-500/30' },
  { id: 'cyan', label: 'Cyan', gradient: 'from-cyan-600/25 via-sky-900/20 to-[#0c0d12]', ring: 'ring-cyan-500/40', glow: 'from-cyan-500/30' },
  { id: 'fuchsia', label: 'Fuchsia', gradient: 'from-fuchsia-600/30 via-pink-900/20 to-[#0c0d12]', ring: 'ring-fuchsia-500/40', glow: 'from-fuchsia-500/30' },
];

export const PROFILE_FRAMES: { id: ProfileFrame; label: string; className: string }[] = [
  { id: 'none', label: 'None', className: '' },
  { id: 'gold', label: 'Gold', className: 'profile-frame-gold' },
  { id: 'neon', label: 'Neon', className: 'profile-frame-neon' },
  { id: 'holo', label: 'Holo', className: 'profile-frame-holo' },
  { id: 'fire', label: 'Fire', className: 'profile-frame-fire' },
];