/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TabId } from './menuItems';

/** Fallback when API config is unavailable. */
export const DEFAULT_PUBLIC_TABS = new Set<TabId>(['faq', 'changelog', 'profile']);

export type FeatureGateInfo = {
  title: string;
  icon: string;
  accent: string;
  description: string;
  perks: string[];
};

const DEFAULT_GATE: FeatureGateInfo = {
  title: 'Members Only',
  icon: '🔐',
  accent: 'indigo',
  description: 'This area is reserved for signed-in LUL Terminal members. Create a free account or sign in to continue.',
  perks: ['Full terminal access', 'Achievements & stats', 'Uploads, tools & vault'],
};

export const FEATURE_GATE_COPY: Partial<Record<TabId, FeatureGateInfo>> = {
  stats: {
    title: 'Terminal Pulse',
    icon: '📡',
    accent: 'cyan',
    description: 'Only signed-in members can access the live terminal statistics dashboard.',
    perks: ['Real-time counters', 'Community highlights', 'Database-backed stats'],
  },
  status: {
    title: 'System Status',
    icon: '📟',
    accent: 'emerald',
    description: 'Only signed-in members can view the live system health and service status dashboard.',
    perks: ['20+ service probes', 'Operational / degraded / down', 'Auto-refresh every 30s'],
  },
  leaderboard: {
    title: 'Hall of Fame',
    icon: '🏆',
    accent: 'amber',
    description: 'Only signed-in members can view the public Top 3 leaderboards and Hall of Fame awards.',
    perks: ['31 live leaderboards', 'Top 3 podium rankings', 'Exclusive permanent awards'],
  },
  games: {
    title: 'Games Arcade',
    icon: '🎲',
    accent: 'rose',
    description: 'Only signed-in members can play Rock Paper Scissors and 13 more arcade games, bet LULcoins, and compete on leaderboards.',
    perks: ['PvP matchmaking & private rooms', 'Bot battles & daily bonus', 'Jackpot pool · 0.6% trigger chance'],
  },
  news: {
    title: 'LUL Wire',
    icon: '📰',
    accent: 'cyan',
    description: 'Only signed-in members can read the live news feed, bulletins, and breaking terminal updates.',
    perks: ['Live wire feed', 'Breaking alerts', 'Search & categories'],
  },
  changelog: {
    title: 'Changelog',
    icon: '📜',
    accent: 'indigo',
    description: 'Only signed-in members can browse the full version history and release notes.',
    perks: ['Every release documented', 'Unread version badge', 'Timeline view'],
  },
  dashboard: {
    title: 'Member Dashboard',
    icon: '🏠',
    accent: 'violet',
    description: 'Only signed-in members can access their personal dashboard with stats, achievements, and account settings.',
    perks: ['Your stats at a glance', 'Achievement progress', 'Security & quick links'],
  },
  imagehost: {
    title: 'Image Hosting',
    icon: '☁️',
    accent: 'cyan',
    description: 'Only signed-in members can upload images, host files, and manage their private gallery.',
    perks: ['Drag & drop uploads', 'Personal gallery & stats', 'Tags, favorites & share links'],
  },
  paste: {
    title: 'LUL Paste',
    icon: '📋',
    accent: 'emerald',
    description: 'Only signed-in members can create pastes. Choose public, private (only you), or password-protected sharing.',
    perks: ['Public · private · password modes', 'Syntax-highlighted snippets', 'Expiry · burn-after-read · raw links'],
  },
  memegen: {
    title: 'Meme Generator',
    icon: '🖼️',
    accent: 'rose',
    description: 'Only signed-in members can use the meme generator, export creations, and track their meme stats.',
    perks: ['Imgflip template library', 'Custom text & export', 'Hosted meme links'],
  },
  proxydatabase: {
    title: 'Proxy Database',
    icon: '🗄️',
    accent: 'indigo',
    description: 'Only signed-in members can browse the working proxy database and use daily-checked lists.',
    perks: ['Live proxy pool', 'Protocol filters', 'Daily health checks'],
  },
  premiumaccounts: {
    title: 'Premium Accounts Vault',
    icon: '👑',
    accent: 'amber',
    description: 'Only signed-in members can access the free & premium account vault and submit working logins.',
    perks: ['Curated premium logins', 'Quick-add accounts', 'VIP-protected entries'],
  },
  invite: {
    title: 'Invite Friends',
    icon: '🎁',
    accent: 'violet',
    description: 'Only signed-in members can generate referral links and invite friends to the terminal.',
    perks: ['Personal invite link', 'Referral tracking', 'Achievement unlocks'],
  },
  fun: {
    title: 'Fun & Trap',
    icon: '🎮',
    accent: 'amber',
    description: 'Only signed-in members can access the Fun & Trap zone. Sign in — if you dare.',
    perks: ['Gravity anomalies', 'Achievement traps', 'Terminal chaos'],
  },
  tools: {
    title: 'Net Toolkit',
    icon: '🛠️',
    accent: 'cyan',
    description: 'Only signed-in members can use the network toolkit for WHOIS, DNS, IP lookups, and more.',
    perks: ['WHOIS & DNS tools', 'IP utilities', 'Dedup helpers'],
  },
  identity: {
    title: 'Identity Forge',
    icon: '🎭',
    accent: 'violet',
    description: 'Only signed-in members can forge personas and generate fake identities.',
    perks: ['Fake personas', 'Alias generator', 'Export profiles'],
  },
  textlab: {
    title: 'Text Laboratory',
    icon: '📝',
    accent: 'emerald',
    description: 'Only signed-in members can use text transforms, counters, and slug tools.',
    perks: ['Text transforms', 'Character counts', 'Slug generator'],
  },
  colorlab: {
    title: 'Color Spectrum',
    icon: '🎨',
    accent: 'rose',
    description: 'Only signed-in members can explore palettes, contrast checks, and HEX tools.',
    perks: ['Palette builder', 'Contrast checker', 'HEX & RGB tools'],
  },
  meme: {
    title: 'Chaos Generator',
    icon: '🎲',
    accent: 'orange',
    description: 'Only signed-in members can spin the chaos generator for memes, jokes, and oracles.',
    perks: ['Random memes', 'Dev jokes', 'Terminal oracles'],
  },
  toolvault: {
    title: 'Tool Vault',
    icon: '🧰',
    accent: 'amber',
    description: 'Only signed-in members can search and use 480+ micro-tools in the vault.',
    perks: ['480+ micro-tools', 'Search & filter', 'One-click utilities'],
  },
  activity: {
    title: 'My Activity',
    icon: '📊',
    accent: 'indigo',
    description: 'Only signed-in members can view their personal activity analytics and usage history.',
    perks: ['Page visit stats', 'Command history', 'Engagement tracking'],
  },
  admin: {
    title: 'Admin Panel',
    icon: '🛡️',
    accent: 'violet',
    description: 'Only administrators with an active session can access the admin dashboard.',
    perks: ['User management', 'Analytics overview', 'System controls'],
  },
};

export function getFeatureGateInfo(tab: TabId): FeatureGateInfo {
  return FEATURE_GATE_COPY[tab] ?? { ...DEFAULT_GATE, title: DEFAULT_GATE.title };
}