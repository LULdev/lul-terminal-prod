/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TabId =
  | 'dashboard'
  | 'stats'
  | 'status'
  | 'leaderboard'
  | 'games'
  | 'news'
  | 'fun'
  | 'faq'
  | 'invite'
  | 'changelog'
  | 'memegen'
  | 'imagehost'
  | 'paste'
  | 'proxydatabase'
  | 'premiumaccounts'
  | 'tools'
  | 'identity'
  | 'textlab'
  | 'colorlab'
  | 'meme'
  | 'toolvault'
  | 'profile'
  | 'activity'
  | 'admin';

export type MenuAccent = 'default' | 'amber' | 'indigo' | 'cyan' | 'rose' | 'emerald' | 'teal' | 'violet' | 'orange';

export type MenuItem = {
  id: TabId;
  icon: string;
  label: string;
  group: 'main' | 'labs';
  accent?: MenuAccent;
  tagline: string;
  locked?: boolean;
  vipBadge?: boolean;
};

export const ALL_TAB_IDS: TabId[] = [
  'dashboard', 'stats', 'status', 'leaderboard', 'games', 'news', 'fun', 'faq', 'invite', 'changelog',
  'memegen', 'imagehost', 'paste', 'proxydatabase', 'premiumaccounts', 'tools', 'identity', 'textlab',
  'colorlab', 'meme', 'toolvault', 'profile', 'activity', 'admin',
];

export const DASHBOARD_MENU_ITEM: MenuItem = {
  id: 'dashboard',
  icon: '🏠',
  label: 'Dashboard',
  group: 'main',
  accent: 'violet',
  tagline: 'Your Terminal · Stats · Settings',
};

export const MAIN_MENU_ITEMS: MenuItem[] = [
  { id: 'stats', icon: '📡', label: 'Terminal Pulse', group: 'main', accent: 'cyan', tagline: 'Live Stats · Real Counters · Community' },
  { id: 'status', icon: '📟', label: 'System Status', group: 'main', accent: 'emerald', tagline: 'Service Health · Live Probes · Uptime' },
  { id: 'leaderboard', icon: '🏆', label: 'Hall of Fame', group: 'main', accent: 'amber', tagline: 'Top 3 · Leaderboards · Awards' },
  { id: 'games', icon: '🎲', label: 'Games', group: 'main', accent: 'rose', tagline: 'LULcoins · RPS · Jackpot' },
  { id: 'news', icon: '📰', label: 'LUL Wire', group: 'main', accent: 'default', tagline: 'Live Bulletins · Breaking Updates' },
  { id: 'faq', icon: '❓', label: 'FAQ', group: 'main', accent: 'teal', tagline: 'Help · Features · Guides' },
  { id: 'invite', icon: '🎁', label: 'Invite Friends', group: 'main', accent: 'violet', tagline: 'Referral Link · Invite Friends' },
  { id: 'fun', icon: '🎮', label: 'Fun & Trap', group: 'main', accent: 'amber', tagline: 'Gravity Anomaly' },
  { id: 'changelog', icon: '📜', label: 'Changelog', group: 'main', accent: 'indigo', tagline: 'Release history' },
  { id: 'memegen', icon: '🖼️', label: 'Meme Generator', group: 'main', accent: 'rose', tagline: 'Imgflip DB · Text · Export' },
  { id: 'imagehost', icon: '☁️', label: 'Image Hosting', group: 'main', accent: 'cyan', tagline: 'Upload · Gallery · Stats · Tags' },
  { id: 'paste', icon: '📋', label: 'Paste', group: 'main', accent: 'emerald', tagline: 'Share Code · Syntax · Expiry · Password' },
  { id: 'proxydatabase', icon: '🗄️', label: 'Proxy Database', group: 'main', accent: 'indigo', tagline: 'Working Proxies · Daily Check · Auto-Purge' },
  { id: 'premiumaccounts', icon: '👑', label: 'Free Premium Accounts', group: 'main', accent: 'amber', tagline: 'Premium Logins · VIP Protection · Quick Add', vipBadge: true },
];

export const LAB_MENU_ITEMS: MenuItem[] = [
  { id: 'tools', icon: '🛠️', label: 'Net Toolkit', group: 'labs', accent: 'cyan', tagline: 'WHOIS · DNS · IP · Dedup' },
  { id: 'identity', icon: '🎭', label: 'Identity Forge', group: 'labs', accent: 'violet', tagline: 'Fake Personas & Aliases' },
  { id: 'textlab', icon: '📝', label: 'Text Laboratory', group: 'labs', accent: 'emerald', tagline: 'Transform · Count · Slugs' },
  { id: 'colorlab', icon: '🎨', label: 'Color Spectrum', group: 'labs', accent: 'rose', tagline: 'Palettes · Contrast · HEX' },
  { id: 'meme', icon: '🎲', label: 'Chaos Generator', group: 'labs', accent: 'orange', tagline: 'Memes · Jokes · Oracles' },
  { id: 'toolvault', icon: '🧰', label: 'Tool Vault', group: 'labs', accent: 'amber', tagline: '480+ Micro-Tools · Search · Filter' },
];

export const ACCENT_STYLES: Record<MenuAccent, { active: string; idle: string }> = {
  default: {
    active: 'border border-slate-700 bg-slate-800/20 text-slate-200',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  amber: {
    active: 'bg-amber-500/10 border border-amber-500/30 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  indigo: {
    active: 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  cyan: {
    active: 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  rose: {
    active: 'bg-rose-500/10 border border-rose-500/30 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  emerald: {
    active: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  teal: {
    active: 'bg-teal-500/10 border border-teal-500/30 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  violet: {
    active: 'bg-violet-500/10 border border-violet-500/30 text-violet-300 shadow-[0_0_15px_rgba(167,139,250,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
  orange: {
    active: 'bg-orange-500/10 border border-orange-500/30 text-orange-300 shadow-[0_0_15px_rgba(251,146,60,0.1)]',
    idle: 'text-slate-400 hover:bg-slate-800/30',
  },
};