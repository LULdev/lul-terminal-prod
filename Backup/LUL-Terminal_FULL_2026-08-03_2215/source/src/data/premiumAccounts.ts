/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PremiumAccountStatus = 'working' | 'working_free' | 'offline' | 'expired' | 'unchecked';

export type PremiumAccountPlan = 'Free' | 'Premium' | 'WorkingButFree';

export const PLAN_LABELS: Record<PremiumAccountPlan, string> = {
  Free: 'FREE',
  Premium: 'Premium',
  WorkingButFree: 'FREE 💩',
};

export const STATUS_LABELS: Record<PremiumAccountStatus, string> = {
  working: 'working',
  working_free: 'FREE 💩',
  offline: 'offline',
  expired: 'expired',
  unchecked: 'unchecked',
};

export type PremiumAccountCategory =
  | 'streaming'
  | 'vpn'
  | 'software'
  | 'gaming'
  | 'porn'
  | 'other';

export type PremiumAccount = {
  id: string;
  service: string;
  website?: string;
  category: PremiumAccountCategory;
  email: string;
  /** Present only after POST /accounts/:id/reveal — never in list responses. */
  password?: string;
  hasPassword?: boolean;
  status: PremiumAccountStatus;
  plan?: PremiumAccountPlan;
  vip?: boolean;
  views?: number;
  createdByUserId?: string | null;
  createdByUsername?: string | null;
  expiresAt?: string | null;
  lastVerifiedAt?: number | null;
  firstSeenAt?: number;
  notes?: string;
};

export const PREMIUM_CATEGORY_LABELS: Record<PremiumAccountCategory, string> = {
  streaming: 'Streaming',
  vpn: 'VPN',
  software: 'Software',
  gaming: 'Gaming',
  porn: 'Porn',
  other: 'Sonstige',
};