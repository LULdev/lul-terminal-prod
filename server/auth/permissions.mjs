/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  computeDisplayAchievements,
  filterAchievementsForPrivacy,
  normalizeAchievements,
  normalizeSocialLinks,
} from './achievements.mjs';
import { extractPublicGameStats, zeroGameStats } from '../gameStatsConfig.mjs';
import {
  normalizeProfileCustomization,
  profileCustomizationForClient,
  publicProfileCustomization,
} from '../profileCustomization.mjs';

export const ROLES = ['user', 'vip', 'admin', 'bot'];

export function roleRank(role) {
  if (role === 'bot' || role === 'admin') return 4;
  if (role === 'vip') return 2;
  return 1;
}

export function isBotUser(user) {
  return user?.role === 'bot';
}

/** Users are active unless missing or explicitly deactivated (active === false). */
export function isEffectivelyActive(user) {
  if (!user) return false;
  return user.active !== false;
}

export function isActiveUser(user) {
  return isEffectivelyActive(user);
}

export function isVerifiedUser(user) {
  return isEffectivelyActive(user) && Boolean(user?.verified);
}

export function hasMinRole(user, minRole) {
  if (!isEffectivelyActive(user)) return false;
  return roleRank(user.role) >= roleRank(minRole);
}

export function canViewPremiumAccounts(user) {
  if (isBotUser(user)) return false;
  return hasMinRole(user, 'vip');
}

export function canSubmitPremiumAccounts(user) {
  if (isBotUser(user)) return false;
  return isVerifiedUser(user) || hasMinRole(user, 'admin');
}

export function canDeletePremiumAccounts(user) {
  if (isBotUser(user)) return false;
  return hasMinRole(user, 'admin');
}

/** @deprecated use canSubmitPremiumAccounts / canDeletePremiumAccounts */
export function canManagePremiumAccounts(user) {
  return canSubmitPremiumAccounts(user);
}

export function canAccessAdmin(user) {
  return user?.role === 'admin' && isEffectivelyActive(user);
}

export function countActiveAdmins(users) {
  return (users ?? []).filter((u) => u.role === 'admin' && isEffectivelyActive(u)).length;
}

export function normalizeUserRecord(user) {
  if (!user) return user;
  return {
    ...user,
    verified: Boolean(user.verified),
    profileViews: Number(user.profileViews) || 0,
    referralsCount: Math.max(0, Number(user.referralsCount) || 0),
    imagesUploaded: Math.max(0, Number(user.imagesUploaded) || 0),
    memesCreated: Math.max(0, Number(user.memesCreated) || 0),
    pastesCreated: Math.max(0, Number(user.pastesCreated) || 0),
    pasteViewsTotal: Math.max(0, Number(user.pasteViewsTotal) || 0),
    website: String(user.website ?? '').trim().slice(0, 256),
    bio: String(user.bio ?? '').trim().slice(0, 160),
    socialLinks: normalizeSocialLinks(user.socialLinks),
    achievements: normalizeAchievements(user.achievements),
    profileCustomization: normalizeProfileCustomization(user.profileCustomization),
  };
}

export function publicUser(user) {
  if (!user) return null;
  const u = normalizeUserRecord(user);
  const {
    id, username, email, role, active, verified, displayName, bio, website,
    avatarUrl, coverUrl, profileViews, referralsCount, imagesUploaded, memesCreated,
    pastesCreated, pasteViewsTotal,
    lulCoins, gameJackpotsWon, gameTotalWon, gameTotalLost,
    socialLinks, achievements, referralCode,
    createdAt, updatedAt, lastLoginAt,
  } = u;
  return {
    id, username, email, role, active, verified, displayName, bio, website,
    avatarUrl, coverUrl, profileViews, referralsCount, imagesUploaded, memesCreated,
    pastesCreated, pasteViewsTotal,
    lulCoins: lulCoins ?? 1000,
    ...extractPublicGameStats(u),
    gameJackpotsWon: gameJackpotsWon ?? 0,
    gameTotalWon: gameTotalWon ?? 0,
    gameTotalLost: gameTotalLost ?? 0,
    socialLinks, achievements, referralCode: referralCode ?? '',
    profileCustomization: profileCustomizationForClient(u.profileCustomization, {
      lastSeenAt: u.lastSeenAt,
      lastLoginAt: u.lastLoginAt,
    }),
    createdAt, updatedAt, lastLoginAt,
  };
}

export function enrichUserForClient(user, accountsSubmitted = 0, reportedNotWorkingAccounts = [], profileStats = null) {
  const pub = publicUser(user);
  if (!pub) return null;
  const act = user.activity && typeof user.activity === 'object' ? user.activity : {};
  pub.achievements = computeDisplayAchievements(user, accountsSubmitted);
  pub.reportedNotWorkingAccounts = reportedNotWorkingAccounts;
  pub.profileStats = profileStats;
  pub.changelogReads = Math.max(0, Number(act.changelogReads) || 0);
  pub.changelogLastReadVersion = act.changelogLastReadVersion
    ? String(act.changelogLastReadVersion).trim().slice(0, 32)
    : null;
  pub.newsReads = Math.max(0, Number(act.newsReads) || 0);
  pub.newsLastReadVersion = act.newsLastReadVersion
    ? String(act.newsLastReadVersion).trim().slice(0, 32)
    : null;
  return pub;
}

function sanitizePublicProfileStats(stats, showActivity, showLastSeen = true) {
  if (!stats) return null;
  if (!showActivity) {
    return {
      premiumAccounts: 0,
      freeAccounts: 0,
      abuseWarnings: 0,
      shoutboxMessages: 0,
      isOnline: false,
      onlineMinutes: 0,
      rank: '',
    };
  }
  return {
    ...stats,
    abuseWarnings: 0,
    onlineMinutes: 0,
    isOnline: showLastSeen ? stats.isOnline : false,
  };
}

export function publicProfileView(user, accountsSubmitted = 0, reportedNotWorkingAccounts = [], profileStats = null) {
  if (!isEffectivelyActive(user)) return null;
  const u = normalizeUserRecord(user);
  const {
    id, username, role, verified, displayName, bio, website, email,
    avatarUrl, coverUrl, profileViews, referralsCount, imagesUploaded, memesCreated,
    pastesCreated, pasteViewsTotal,
    lulCoins, gameJackpotsWon, gameTotalWon, gameTotalLost,
    socialLinks, createdAt,
  } = u;
  const customization = publicProfileCustomization(u.profileCustomization, {
    lastSeenAt: u.lastSeenAt,
    lastLoginAt: u.lastLoginAt,
  });
  const showCoins = customization.privacy.showCoins;
  const showActivity = customization.privacy.showActivityStats;
  const showEmail = customization.privacy.showEmail;
  const displayAchievements = computeDisplayAchievements(u, accountsSubmitted);
  const act = u.activity && typeof u.activity === 'object' ? u.activity : {};
  return {
    id, username, role, verified, displayName, bio, website,
    avatarUrl, coverUrl,
    ...(showActivity ? {
      profileViews,
      referralsCount,
      imagesUploaded,
      memesCreated,
      pastesCreated,
      pasteViewsTotal,
      accountsSubmitted,
    } : {
      profileViews: 0,
      referralsCount: 0,
      imagesUploaded: 0,
      memesCreated: 0,
      pastesCreated: 0,
      pasteViewsTotal: 0,
      accountsSubmitted: 0,
    }),
    ...(showCoins ? { lulCoins: lulCoins ?? 1000 } : {}),
    ...(showActivity ? extractPublicGameStats(u) : zeroGameStats()),
    ...(showCoins ? {
      gameJackpotsWon: gameJackpotsWon ?? 0,
      gameTotalWon: gameTotalWon ?? 0,
      gameTotalLost: gameTotalLost ?? 0,
    } : {
      gameJackpotsWon: 0,
      gameTotalWon: 0,
      gameTotalLost: 0,
    }),
    socialLinks,
    achievements: filterAchievementsForPrivacy(displayAchievements, { showActivity, showCoins }),
    createdAt,
    reportedNotWorkingAccounts: showActivity ? reportedNotWorkingAccounts : [],
    profileStats: sanitizePublicProfileStats(profileStats, showActivity, customization.privacy.showLastSeen),
    profileCustomization: customization,
    ...(showEmail ? { email } : {}),
    changelogReads: showActivity ? Math.max(0, Number(act.changelogReads) || 0) : 0,
    newsReads: showActivity ? Math.max(0, Number(act.newsReads) || 0) : 0,
  };
}