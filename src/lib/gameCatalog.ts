/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameArenaType = 'rps' | 'ttt' | 'instant' | 'nim' | 'connect4' | 'mines';
export type GameCategory = 'classic' | 'instant' | 'strategy';

export const GAME_CATEGORIES: { id: GameCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'classic', label: 'Classic' },
  { id: 'instant', label: 'Instant' },
  { id: 'strategy', label: 'Strategy' },
];

export type InstantMove = {
  id: string;
  label: string;
  emoji: string;
  color?: string;
};

export type GameCatalogEntry = {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  accent: string;
  borderClass: string;
  bgClass: string;
  arenaType: GameArenaType;
  category: GameCategory;
  tagline: string;
  rules: string[];
  moves?: InstantMove[];
  singleAction?: { id: string; label: string; emoji: string };
};

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'rps',
    label: 'Rock Paper Scissors',
    shortLabel: 'RPS',
    icon: '✊',
    accent: 'text-rose-200',
    borderClass: 'border-rose-500/40 bg-rose-500/15',
    bgClass: 'border-rose-500/20 from-rose-950/40 to-amber-950/30',
    arenaType: 'rps',
    category: 'classic',
    tagline: 'PvP · BOT · Bo3',
    rules: ['PvP winner takes both bets', 'Bo3: first to 2 round wins', '0.6% jackpot on PvP win'],
  },
  {
    id: 'ttt',
    label: 'Tic-Tac-Toe',
    shortLabel: 'TTT',
    icon: '⭕',
    accent: 'text-teal-200',
    borderClass: 'border-teal-500/40 bg-teal-500/15',
    bgClass: 'border-teal-500/20 from-teal-950/40 to-cyan-950/30',
    arenaType: 'ttt',
    category: 'classic',
    tagline: '3×3 · ✕ vs ○',
    rules: ['Three in a row wins', 'Draw refunds both bets', 'Streak bonus on wins'],
  },
  {
    id: 'connect4',
    label: 'Connect Four',
    shortLabel: 'C4',
    icon: '🔴',
    accent: 'text-red-200',
    borderClass: 'border-red-500/40 bg-red-500/15',
    bgClass: 'border-red-500/20 from-red-950/40 to-orange-950/30',
    arenaType: 'connect4',
    category: 'strategy',
    tagline: '4 in a row',
    rules: ['Drop tokens in columns', 'First to connect 4 wins', 'Full board = draw'],
  },
  {
    id: 'nim',
    label: 'Nim',
    shortLabel: 'Nim',
    icon: '🪨',
    accent: 'text-stone-200',
    borderClass: 'border-stone-500/40 bg-stone-500/15',
    bgClass: 'border-stone-500/20 from-stone-950/40 to-zinc-950/30',
    arenaType: 'nim',
    category: 'strategy',
    tagline: 'Take stones · last wins',
    rules: ['Piles 3 · 5 · 7', 'Take 1–N stones from one pile', 'Last pick wins the pot'],
  },
  {
    id: 'coinflip',
    label: 'Coin Flip',
    shortLabel: 'Coin',
    icon: '🪙',
    accent: 'text-amber-200',
    borderClass: 'border-amber-500/40 bg-amber-500/15',
    bgClass: 'border-amber-500/20 from-amber-950/40 to-yellow-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'Heads or tails',
    rules: ['Pick heads or tails', 'Server flips coin', 'Match = win'],
    moves: [
      { id: 'heads', label: 'Heads', emoji: '🙂' },
      { id: 'tails', label: 'Tails', emoji: '🦅' },
    ],
  },
  {
    id: 'dice',
    label: 'Dice Duel',
    shortLabel: 'Dice',
    icon: '🎲',
    accent: 'text-violet-200',
    borderClass: 'border-violet-500/40 bg-violet-500/15',
    bgClass: 'border-violet-500/20 from-violet-950/40 to-purple-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'Roll 1d6',
    rules: ['Both roll a six-sided die', 'Higher roll wins', 'Tie = refund'],
    singleAction: { id: 'roll', label: 'Roll', emoji: '🎲' },
  },
  {
    id: 'oddeven',
    label: 'Odd or Even',
    shortLabel: 'O/E',
    icon: '🔢',
    accent: 'text-sky-200',
    borderClass: 'border-sky-500/40 bg-sky-500/15',
    bgClass: 'border-sky-500/20 from-sky-950/40 to-blue-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'Parity guess',
    rules: ['Pick odd or even', 'Server rolls d6', 'Correct parity wins'],
    moves: [
      { id: 'odd', label: 'Odd', emoji: '1️⃣' },
      { id: 'even', label: 'Even', emoji: '2️⃣' },
    ],
  },
  {
    id: 'war',
    label: 'Card War',
    shortLabel: 'War',
    icon: '🃏',
    accent: 'text-fuchsia-200',
    borderClass: 'border-fuchsia-500/40 bg-fuchsia-500/15',
    bgClass: 'border-fuchsia-500/20 from-fuchsia-950/40 to-pink-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'High card wins',
    rules: ['Flip one card each', 'Higher rank wins', 'Same rank = draw'],
    singleAction: { id: 'flip', label: 'Flip', emoji: '🃏' },
  },
  {
    id: 'rpsls',
    label: 'RPS Lizard Spock',
    shortLabel: 'RPSLS',
    icon: '🦎',
    accent: 'text-lime-200',
    borderClass: 'border-lime-500/40 bg-lime-500/15',
    bgClass: 'border-lime-500/20 from-lime-950/40 to-green-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: '5-way duel',
    rules: ['Extended RPS rules', '5 symbols', 'Classic counter logic'],
    moves: [
      { id: 'rock', label: 'Rock', emoji: '✊' },
      { id: 'paper', label: 'Paper', emoji: '✋' },
      { id: 'scissors', label: 'Scissors', emoji: '✌️' },
      { id: 'lizard', label: 'Lizard', emoji: '🦎' },
      { id: 'spock', label: 'Spock', emoji: '🖖' },
    ],
  },
  {
    id: 'numberduel',
    label: 'Number Duel',
    shortLabel: 'Num',
    icon: '🔟',
    accent: 'text-indigo-200',
    borderClass: 'border-indigo-500/40 bg-indigo-500/15',
    bgClass: 'border-indigo-500/20 from-indigo-950/40 to-violet-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'Pick 1–10',
    rules: ['Both pick 1–10 secretly', 'Higher number wins', 'Same = draw'],
    moves: Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      label: String(i + 1),
      emoji: String(i + 1),
    })),
  },
  {
    id: 'colorpick',
    label: 'Color Pick',
    shortLabel: 'Color',
    icon: '🎨',
    accent: 'text-pink-200',
    borderClass: 'border-pink-500/40 bg-pink-500/15',
    bgClass: 'border-pink-500/20 from-pink-950/40 to-rose-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'Lucky color',
    rules: ['Pick a color', 'Server picks winning color', 'Match = win'],
    moves: [
      { id: 'red', label: 'Red', emoji: '🔴' },
      { id: 'blue', label: 'Blue', emoji: '🔵' },
      { id: 'green', label: 'Green', emoji: '🟢' },
      { id: 'yellow', label: 'Yellow', emoji: '🟡' },
    ],
  },
  {
    id: 'highlow',
    label: 'High or Low',
    shortLabel: 'Hi/Lo',
    icon: '📈',
    accent: 'text-cyan-200',
    borderClass: 'border-cyan-500/40 bg-cyan-500/15',
    bgClass: 'border-cyan-500/20 from-cyan-950/40 to-teal-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'Above or below 50',
    rules: ['Random target 1–100', '>50 = high, else low', 'Correct guess wins'],
    moves: [
      { id: 'high', label: 'High', emoji: '📈' },
      { id: 'low', label: 'Low', emoji: '📉' },
    ],
  },
  {
    id: 'mines',
    label: 'Minefield',
    shortLabel: 'Mines',
    icon: '💣',
    accent: 'text-orange-200',
    borderClass: 'border-orange-500/40 bg-orange-500/15',
    bgClass: 'border-orange-500/20 from-orange-950/40 to-amber-950/30',
    arenaType: 'mines',
    category: 'instant',
    tagline: 'Avoid the mine',
    rules: ['3×3 grid, one hidden mine', 'Pick a cell', 'Hit mine = loss'],
  },
  {
    id: 'blackjack',
    label: 'Blackjack Duel',
    shortLabel: 'BJ',
    icon: '🂡',
    accent: 'text-emerald-200',
    borderClass: 'border-emerald-500/40 bg-emerald-500/15',
    bgClass: 'border-emerald-500/20 from-emerald-950/40 to-green-950/30',
    arenaType: 'instant',
    category: 'instant',
    tagline: 'Closest to 21',
    rules: ['Auto-deal 2 cards each', 'Closest to 21 wins', 'Bust = loss'],
    singleAction: { id: 'deal', label: 'Deal', emoji: '🂡' },
  },
];

export const GAME_CATALOG_MAP = Object.fromEntries(GAME_CATALOG.map((g) => [g.id, g]));

export type GameId = (typeof GAME_CATALOG)[number]['id'];