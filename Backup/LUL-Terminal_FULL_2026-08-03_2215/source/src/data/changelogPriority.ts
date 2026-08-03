/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** One pulsar color per priority level (P0–P9). */
export type ChangelogPriority =
  | 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9';

export const CHANGELOG_PRIORITIES: ChangelogPriority[] = [
  'P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9',
];

export type ChangelogPriorityMeta = {
  priority: ChangelogPriority;
  color: string;
  title: string;
  desc: string;
  core: string;
  ping: string;
  glow: string;
};

export const CHANGELOG_PRIORITY_META: ChangelogPriorityMeta[] = [
  {
    priority: 'P0',
    color: 'Red',
    title: 'Critical',
    desc: 'Security, exploits, auth bypass',
    core: 'bg-red-666',
    ping: 'bg-red-555',
    glow: 'shadow-[0_0_10px_rgba(239,68,68,0.75)]',
  },
  {
    priority: 'P1',
    color: 'Orange',
    title: 'High',
    desc: 'Escrow, farming, broken APIs',
    core: 'bg-orange-600',
    ping: 'bg-orange-500',
    glow: 'shadow-[0_0_6px_rgba(249,115,22,0.75)]',
  },
  {
    priority: 'P2',
    color: 'Yellow',
    title: 'Medium',
    desc: 'Privacy leaks, leaderboard exposure',
    core: 'bg-yellow-400',
    ping: 'bg-yellow-300',
    glow: 'shadow-[0_0_6px_rgba(250,204,21,0.75)]',
  },
  {
    priority: 'P3',
    color: 'Cyan',
    title: 'UX',
    desc: 'Errors, loading, fetch churn',
    core: 'bg-cyan-500',
    ping: 'bg-cyan-400',
    glow: 'shadow-[0_0_6px_rgba(6,182,212,0.75)]',
  },
  {
    priority: 'P4',
    color: 'Sky',
    title: 'Polish',
    desc: 'A11y, empty states, retry buttons',
    core: 'bg-sky-500',
    ping: 'bg-sky-400',
    glow: 'shadow-[0_0_6px_rgba(14,165,233,0.75)]',
  },
  {
    priority: 'P5',
    color: 'Violet',
    title: 'Copy',
    desc: 'German→English, locale',
    core: 'bg-violet-500',
    ping: 'bg-violet-400',
    glow: 'shadow-[0_0_6px_rgba(139,92,246,0.75)]',
  },
  {
    priority: 'P6',
    color: 'Indigo',
    title: 'Meta',
    desc: 'OG tags, README, favicon',
    core: 'bg-indigo-500',
    ping: 'bg-indigo-400',
    glow: 'shadow-[0_0_6px_rgba(99,102,241,0.75)]',
  },
  {
    priority: 'P7',
    color: 'Fuchsia',
    title: 'Micro',
    desc: 'Placeholders, dead code',
    core: 'bg-fuchsia-500',
    ping: 'bg-fuchsia-400',
    glow: 'shadow-[0_0_6px_rgba(217,70,239,0.75)]',
  },
  {
    priority: 'P8',
    color: 'Zinc',
    title: 'Nitpick',
    desc: 'Minor inconsistencies',
    core: 'bg-zinc-400',
    ping: 'bg-zinc-300',
    glow: 'shadow-[0_0_6px_rgba(161,161,170,0.65)]',
  },
  {
    priority: 'P9',
    color: 'Emerald',
    title: 'Verified',
    desc: 'Audit pass clean',
    core: 'bg-emerald-500',
    ping: 'bg-emerald-400',
    glow: 'shadow-[0_0_6px_rgba(16,185,129,0.75)]',
  },
];

const META_BY_PRIORITY = Object.fromEntries(
  CHANGELOG_PRIORITY_META.map((m) => [m.priority, m]),
) as Record<ChangelogPriority, ChangelogPriorityMeta>;

export function changelogPriorityMeta(priority: ChangelogPriority): ChangelogPriorityMeta {
  return META_BY_PRIORITY[priority];
}

/** Parse `P{n} — …` prefix from changelog item text. */
export function priorityFromChangelogText(text: string): ChangelogPriority | null {
  const m = text.match(/^P(\d+)\s*—/);
  if (!m) return null;
  const n = Math.min(9, Math.max(0, Number(m[1])));
  return `P${n}` as ChangelogPriority;
}