/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const MOODS = new Set(['chill', 'grinding', 'afk', 'vibing', 'chaotic', 'focus', 'sleepy']);
const THEMES = new Set(['indigo', 'rose', 'emerald', 'amber', 'violet', 'cyan', 'fuchsia']);
const FRAMES = new Set(['none', 'gold', 'neon', 'holo', 'fire']);
const GAME_IDS = new Set([
  'rps', 'ttt', 'connect4', 'nim', 'coinflip', 'dice', 'oddeven', 'war',
  'rpsls', 'numberduel', 'colorpick', 'highlow', 'mines', 'blackjack', 'dice100', 'roulette',
]);

export const DEFAULT_PROFILE_CUSTOMIZATION = {
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

function clampStr(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

function clampMonth(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return Math.floor(n);
}

function daysInMonth(month) {
  if (month === 2) return 29;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function clampDay(v, month = null) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  const max = month ? daysInMonth(month) : 31;
  if (n > max) return null;
  return Math.floor(n);
}

export function normalizeProfileCustomization(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const statusSrc = src.status && typeof src.status === 'object' ? src.status : {};
  const privacySrc = src.privacy && typeof src.privacy === 'object' ? src.privacy : {};
  const mood = MOODS.has(src.mood) ? src.mood : 'chill';
  const accentTheme = THEMES.has(src.accentTheme) ? src.accentTheme : 'indigo';
  const profileFrame = FRAMES.has(src.profileFrame) ? src.profileFrame : 'none';
  const favoriteGame = GAME_IDS.has(src.favoriteGame) ? src.favoriteGame : '';
  const birthdayMonth = clampMonth(src.birthdayMonth);
  const pinnedSocial = clampStr(src.pinnedSocial, 32);
  const statusText = clampStr(statusSrc.text, 80);
  const statusEmoji = clampStr(statusSrc.emoji, 8) || '✨';
  const statusUpdatedAt = statusText && Number(statusSrc.updatedAt) > 0
    ? Number(statusSrc.updatedAt)
    : null;

  return {
    status: {
      text: statusText,
      emoji: statusEmoji,
      updatedAt: statusUpdatedAt,
    },
    pronouns: clampStr(src.pronouns, 32),
    location: clampStr(src.location, 64),
    timezone: clampStr(src.timezone, 48),
    tagline: clampStr(src.tagline, 80),
    mood,
    vibeTag: clampStr(src.vibeTag, 48),
    favoriteEmoji: clampStr(src.favoriteEmoji, 8) || '✨',
    accentTheme,
    featuredAchievementId: clampStr(src.featuredAchievementId, 64),
    pinnedSocial,
    askMeAbout: clampStr(src.askMeAbout, 120),
    favoriteGame,
    profileFrame,
    funFact: clampStr(src.funFact, 160),
    birthdayMonth,
    birthdayDay: clampDay(src.birthdayDay, birthdayMonth),
    customTitle: clampStr(src.customTitle, 48),
    privacy: {
      showEmail: Boolean(privacySrc.showEmail),
      showLocation: privacySrc.showLocation !== false,
      showLastSeen: privacySrc.showLastSeen !== false,
      showCoins: privacySrc.showCoins !== false,
      showActivityStats: privacySrc.showActivityStats !== false,
    },
  };
}

export function mergeProfileCustomizationPatch(current, patch) {
  const base = normalizeProfileCustomization(current);
  if (!patch || typeof patch !== 'object') return base;

  const next = { ...base };
  if (patch.status && typeof patch.status === 'object') {
    const text = patch.status.text != null ? clampStr(patch.status.text, 80) : base.status.text;
    const emoji = patch.status.emoji != null ? (clampStr(patch.status.emoji, 8) || '✨') : base.status.emoji;
    const textChanged = text !== base.status.text;
    const emojiChanged = emoji !== base.status.emoji;
    next.status = {
      text,
      emoji,
      updatedAt: text
        ? (textChanged || emojiChanged ? Date.now() : base.status.updatedAt)
        : null,
    };
  }
  if (patch.pronouns != null) next.pronouns = clampStr(patch.pronouns, 32);
  if (patch.location != null) next.location = clampStr(patch.location, 64);
  if (patch.timezone != null) next.timezone = clampStr(patch.timezone, 48);
  if (patch.tagline != null) next.tagline = clampStr(patch.tagline, 80);
  if (patch.mood != null && MOODS.has(patch.mood)) next.mood = patch.mood;
  if (patch.vibeTag != null) next.vibeTag = clampStr(patch.vibeTag, 48);
  if (patch.favoriteEmoji != null) next.favoriteEmoji = clampStr(patch.favoriteEmoji, 8) || '✨';
  if (patch.accentTheme != null && THEMES.has(patch.accentTheme)) next.accentTheme = patch.accentTheme;
  if (patch.featuredAchievementId != null) next.featuredAchievementId = clampStr(patch.featuredAchievementId, 64);
  if (patch.pinnedSocial != null) next.pinnedSocial = clampStr(patch.pinnedSocial, 32);
  if (patch.askMeAbout != null) next.askMeAbout = clampStr(patch.askMeAbout, 120);
  if (patch.favoriteGame != null) next.favoriteGame = GAME_IDS.has(patch.favoriteGame) ? patch.favoriteGame : '';
  if (patch.profileFrame != null && FRAMES.has(patch.profileFrame)) next.profileFrame = patch.profileFrame;
  if (patch.funFact != null) next.funFact = clampStr(patch.funFact, 160);
  if ('birthdayMonth' in patch) next.birthdayMonth = clampMonth(patch.birthdayMonth);
  if ('birthdayDay' in patch) next.birthdayDay = clampDay(patch.birthdayDay);
  if (patch.customTitle != null) next.customTitle = clampStr(patch.customTitle, 48);
  if (patch.privacy && typeof patch.privacy === 'object') {
    next.privacy = {
      showEmail: patch.privacy.showEmail != null ? Boolean(patch.privacy.showEmail) : base.privacy.showEmail,
      showLocation: patch.privacy.showLocation != null ? Boolean(patch.privacy.showLocation) : base.privacy.showLocation,
      showLastSeen: patch.privacy.showLastSeen != null ? Boolean(patch.privacy.showLastSeen) : base.privacy.showLastSeen,
      showCoins: patch.privacy.showCoins != null ? Boolean(patch.privacy.showCoins) : base.privacy.showCoins,
      showActivityStats: patch.privacy.showActivityStats != null ? Boolean(patch.privacy.showActivityStats) : base.privacy.showActivityStats,
    };
  }
  return normalizeProfileCustomization(next);
}

/** Inject last-seen for display (own + public profiles). */
export function profileCustomizationForClient(customization, { lastSeenAt = null, lastLoginAt = null } = {}) {
  const c = normalizeProfileCustomization(customization);
  const seen = Number(lastSeenAt) || Number(lastLoginAt) || null;
  return {
    ...c,
    _lastSeenAt: c.privacy.showLastSeen && seen ? seen : null,
  };
}

/** Public view respects privacy toggles */
export function publicProfileCustomization(customization, { lastSeenAt = null, lastLoginAt = null } = {}) {
  const c = normalizeProfileCustomization(customization);
  const out = profileCustomizationForClient(c, { lastSeenAt, lastLoginAt });
  if (!c.privacy.showLocation) {
    out.location = '';
    out.timezone = '';
  }
  if (!c.privacy.showLastSeen) out._lastSeenAt = null;
  if (!c.privacy.showActivityStats) {
    out.favoriteGame = '';
    out.featuredAchievementId = '';
    out.birthdayMonth = null;
    out.birthdayDay = null;
  }
  return out;
}