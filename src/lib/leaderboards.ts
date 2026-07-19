/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API = '/api/leaderboards';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  verified: boolean;
  value: number;
};

export type LeaderboardBoard = {
  id: string;
  awardId: string;
  title: string;
  icon: string;
  unit: string;
  accent: string;
  top3: LeaderboardEntry[];
};

export type LeaderboardsResponse = {
  generatedAt: number;
  boards: LeaderboardBoard[];
  lastAwardSync?: {
    synced: boolean;
    grants: Array<{
      username: string;
      awardId: string;
      boardId: string;
      boardTitle: string;
      rank: number;
    }>;
  };
};

export const LEADERBOARD_AWARD_IDS = [
  'lb_top_profile_views',
  'lb_top_referrals',
  'lb_top_uploader',
  'lb_top_meme_creator',
  'lb_top_online',
  'lb_top_commands',
  'lb_top_achievements',
  'lb_top_shoutbox',
  'lb_top_explorer',
  'lb_top_vault',
  'lb_top_paste_creator',
  'lb_top_paste_views',
  'lb_top_game_wins',
  'lb_top_game_losses',
  'lb_top_game_games',
  'lb_top_lul_coins',
  'lb_top_ttt_wins',
  'lb_top_ttt_losses',
  'lb_top_ttt_games',
  'lb_top_connect4_wins',
  'lb_top_nim_wins',
  'lb_top_coinflip_wins',
  'lb_top_dice_wins',
  'lb_top_oddeven_wins',
  'lb_top_war_wins',
  'lb_top_rpsls_wins',
  'lb_top_numberduel_wins',
  'lb_top_colorpick_wins',
  'lb_top_highlow_wins',
  'lb_top_mines_wins',
  'lb_top_blackjack_wins',
  'lb_top_dice100_wins',
] as const;

export type LeaderboardAccent =
  | 'cyan'
  | 'violet'
  | 'sky'
  | 'rose'
  | 'emerald'
  | 'orange'
  | 'amber'
  | 'teal'
  | 'indigo';

export const BOARD_ACCENT_STYLES: Record<
  LeaderboardAccent,
  { border: string; glow: string; text: string; podium: string }
> = {
  cyan: {
    border: 'border-cyan-500/25',
    glow: 'from-cyan-500/10',
    text: 'text-cyan-300',
    podium: 'bg-cyan-500/15 border-cyan-500/30',
  },
  violet: {
    border: 'border-violet-500/25',
    glow: 'from-violet-500/10',
    text: 'text-violet-300',
    podium: 'bg-violet-500/15 border-violet-500/30',
  },
  sky: {
    border: 'border-sky-500/25',
    glow: 'from-sky-500/10',
    text: 'text-sky-300',
    podium: 'bg-sky-500/15 border-sky-500/30',
  },
  rose: {
    border: 'border-rose-500/25',
    glow: 'from-rose-500/10',
    text: 'text-rose-300',
    podium: 'bg-rose-500/15 border-rose-500/30',
  },
  emerald: {
    border: 'border-emerald-500/25',
    glow: 'from-emerald-500/10',
    text: 'text-emerald-300',
    podium: 'bg-emerald-500/15 border-emerald-500/30',
  },
  orange: {
    border: 'border-orange-500/25',
    glow: 'from-orange-500/10',
    text: 'text-orange-300',
    podium: 'bg-orange-500/15 border-orange-500/30',
  },
  amber: {
    border: 'border-amber-500/25',
    glow: 'from-amber-500/10',
    text: 'text-amber-300',
    podium: 'bg-amber-500/15 border-amber-500/30',
  },
  teal: {
    border: 'border-teal-500/25',
    glow: 'from-teal-500/10',
    text: 'text-teal-300',
    podium: 'bg-teal-500/15 border-teal-500/30',
  },
  indigo: {
    border: 'border-indigo-500/25',
    glow: 'from-indigo-500/10',
    text: 'text-indigo-300',
    podium: 'bg-indigo-500/15 border-indigo-500/30',
  },
};

export const RANK_STYLES = {
  1: {
    medal: '🥇',
    label: '#1',
    height: 'h-28',
    ring: 'ring-amber-400/60',
    bar: 'bg-gradient-to-t from-amber-600/40 to-amber-400/25 border-amber-400/50',
    text: 'text-amber-200',
  },
  2: {
    medal: '🥈',
    label: '#2',
    height: 'h-20',
    ring: 'ring-slate-300/40',
    bar: 'bg-gradient-to-t from-slate-600/40 to-slate-400/20 border-slate-400/40',
    text: 'text-slate-200',
  },
  3: {
    medal: '🥉',
    label: '#3',
    height: 'h-16',
    ring: 'ring-orange-700/50',
    bar: 'bg-gradient-to-t from-orange-900/50 to-orange-600/25 border-orange-600/40',
    text: 'text-orange-200',
  },
} as const;

export async function fetchLeaderboards(): Promise<LeaderboardsResponse> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Leaderboards unavailable');
  return res.json() as Promise<LeaderboardsResponse>;
}

/** Shallow compare — skip React state updates when poll returns identical podium data. */
export function boardsDataEqual(a: LeaderboardBoard[], b: LeaderboardBoard[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left.id !== right.id || left.top3.length !== right.top3.length) return false;
    for (let j = 0; j < left.top3.length; j += 1) {
      const le = left.top3[j];
      const re = right.top3[j];
      if (
        le.userId !== re.userId
        || le.rank !== re.rank
        || le.value !== re.value
        || le.username !== re.username
        || le.displayName !== re.displayName
        || le.avatarUrl !== re.avatarUrl
        || le.role !== re.role
      ) {
        return false;
      }
    }
  }
  return true;
}

export function formatBoardValue(value: number, unit: string): string {
  if (unit === 'minutes' && value >= 60) {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return value.toLocaleString('en-US');
}

export function formatRelativeEn(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type LeaderboardFilter = 'all' | 'community' | 'arcade';

export const LEADERBOARD_FILTER_OPTIONS: { id: LeaderboardFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🏆' },
  { id: 'community', label: 'Community', icon: '👥' },
  { id: 'arcade', label: 'Arcade Champions', icon: '🎮' },
];

/** Per-game win champion boards for all 14 arcade titles. */
export function isArcadeChampionBoard(board: LeaderboardBoard): boolean {
  return /^game_[a-z0-9]+_wins$/.test(board.id);
}

export function filterLeaderboardBoards(
  boards: LeaderboardBoard[],
  filter: LeaderboardFilter,
): LeaderboardBoard[] {
  if (filter === 'all') return boards;
  if (filter === 'arcade') return boards.filter(isArcadeChampionBoard);
  return boards.filter((b) => !isArcadeChampionBoard(b));
}