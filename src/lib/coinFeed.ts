/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionJson } from './sessionFetch';

const API = '/api/games/coin-feed';

export type CoinFeedKind =
  | 'achievement'
  | 'daily_bonus'
  | 'game_win'
  | 'streak_bonus'
  | 'jackpot'
  | 'draw_refund'
  | string;

export type CoinFeedEntry = {
  id: string;
  kind: CoinFeedKind;
  amount: number;
  label: string;
  icon: string;
  at: number;
  meta?: {
    achievementId?: string;
    gameId?: string;
    matchId?: string;
    bet?: number;
    mode?: string;
  };
  legacy?: boolean;
};

export type CoinFeedResponse = {
  generatedAt: number;
  items: CoinFeedEntry[];
  totalShown: number;
  recentEarned: number;
  balance: number | null;
};

export async function fetchCoinFeed(limit = 40): Promise<CoinFeedResponse> {
  return sessionJson<CoinFeedResponse>(`${API}?limit=${limit}`);
}

export function formatCoinFeedTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const COIN_FEED_KIND_STYLES: Record<string, { chip: string; amount: string }> = {
  achievement: { chip: 'coin-feed-kind-chip coin-feed-kind--achievement', amount: 'coin-feed-amount--achievement' },
  daily_bonus: { chip: 'coin-feed-kind-chip coin-feed-kind--daily_bonus', amount: 'coin-feed-amount--daily_bonus' },
  game_win: { chip: 'coin-feed-kind-chip coin-feed-kind--game_win', amount: 'coin-feed-amount--game_win' },
  streak_bonus: { chip: 'coin-feed-kind-chip coin-feed-kind--streak_bonus', amount: 'coin-feed-amount--streak_bonus' },
  jackpot: { chip: 'coin-feed-kind-chip coin-feed-kind--jackpot', amount: 'coin-feed-amount--jackpot' },
  draw_refund: { chip: 'coin-feed-kind-chip coin-feed-kind--draw_refund', amount: 'coin-feed-amount--draw_refund' },
};