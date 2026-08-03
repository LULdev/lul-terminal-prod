/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EarnedAchievement, SocialLink } from '../data/achievements';
import type { AllArcadeStatFields } from '../lib/arcadeStats';
import type { ProfileCustomization } from './profileCustomization';

import type { PremiumAccountCategory } from '../data/premiumAccounts';

export type UserRole = 'user' | 'vip' | 'admin' | 'bot';

export type ProfileStats = {
  premiumAccounts: number;
  freeAccounts: number;
  abuseWarnings: number;
  shoutboxMessages: number;
  isOnline: boolean;
  onlineMinutes: number;
  rank: string;
};

export type ReportedNotWorkingAccount = {
  accountId: string;
  service: string;
  category: PremiumAccountCategory;
  website?: string;
  acceptedAt: number;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  active: boolean;
  verified: boolean;
  displayName: string;
  bio: string;
  website: string;
  avatarUrl: string;
  coverUrl: string;
  profileViews: number;
  referralsCount: number;
  imagesUploaded: number;
  memesCreated: number;
  pastesCreated?: number;
  pasteViewsTotal?: number;
  lulCoins?: number;
  gameJackpotsWon?: number;
  gameTotalWon?: number;
  gameTotalLost?: number;
  referralCode?: string;
  socialLinks: SocialLink[];
  achievements: EarnedAchievement[];
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  reportedNotWorkingAccounts?: ReportedNotWorkingAccount[];
  profileStats?: ProfileStats | null;
  changelogReads?: number;
  changelogLastReadVersion?: string | null;
  newsReads?: number;
  newsLastReadVersion?: string | null;
  profileCustomization?: ProfileCustomization;
} & AllArcadeStatFields;

export type PublicProfile = Pick<
  AuthUser,
  | 'id'
  | 'username'
  | 'role'
  | 'verified'
  | 'displayName'
  | 'bio'
  | 'website'
  | 'avatarUrl'
  | 'coverUrl'
  | 'profileViews'
  | 'referralsCount'
  | 'imagesUploaded'
  | 'memesCreated'
  | 'pastesCreated'
  | 'pasteViewsTotal'
  | 'lulCoins'
  | 'gameJackpotsWon'
  | 'gameTotalWon'
  | 'gameTotalLost'
  | 'socialLinks'
  | 'achievements'
  | 'createdAt'
> & {
  accountsSubmitted: number;
  reportedNotWorkingAccounts: ReportedNotWorkingAccount[];
  profileStats?: ProfileStats | null;
  changelogReads?: number;
  newsReads?: number;
  profileCustomization?: ProfileCustomization;
  email?: string;
} & AllArcadeStatFields;

export type AuthPermissions = {
  premiumView: boolean;
  premiumSubmit: boolean;
  premiumDelete: boolean;
  admin: boolean;
  isVip: boolean;
  isVerified: boolean;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  vip: 'VIP',
  admin: 'Admin',
  bot: 'BOT',
};