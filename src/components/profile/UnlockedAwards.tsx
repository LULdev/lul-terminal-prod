/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import {
  ACHIEVEMENT_BY_ID,
  achievementBadgeClass,
  type EarnedAchievement,
} from '../../data/achievements';

type UnlockedAwardsProps = {
  earned: EarnedAchievement[];
};

export function UnlockedAwards({ earned }: UnlockedAwardsProps) {
  const unlocked = useMemo(
    () => earned
      .map((e) => ({ earnedAt: e.earnedAt, def: ACHIEVEMENT_BY_ID[e.id] }))
      .filter((e): e is { earnedAt: number; def: NonNullable<typeof e.def> } => Boolean(e.def))
      .sort((a, b) => b.earnedAt - a.earnedAt),
    [earned],
  );

  const achievements = unlocked.filter((e) => e.def.kind === 'achievement');
  const awards = unlocked.filter((e) => e.def.kind === 'award');

  return (
    <div className="rounded-xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/20 via-[#0c0d12] to-indigo-950/15 px-2.5 py-2 relative overflow-hidden">
      <div className="absolute -top-8 -left-8 w-24 h-24 bg-fuchsia-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider text-fuchsia-300 flex items-center gap-1">
            <Sparkles size={10} className="text-fuchsia-400" />
            Unlocked
          </h3>
          <span className="text-[7px] font-mono text-fuchsia-500/70">{unlocked.length} earned</span>
        </div>

        {unlocked.length === 0 ? (
          <p className="text-[8px] font-mono text-slate-500 leading-relaxed">
            No trophies yet — explore the terminal, arcade, and vault.
          </p>
        ) : (
          <div className="space-y-1.5">
            {achievements.length > 0 && (
              <UnlockedGroup label="Achievements" items={achievements} />
            )}
            {awards.length > 0 && (
              <UnlockedGroup label="Awards" items={awards} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UnlockedGroup({
  label,
  items,
}: {
  label: string;
  items: { earnedAt: number; def: NonNullable<(typeof ACHIEVEMENT_BY_ID)[string]> }[];
}) {
  return (
    <div>
      <h4 className="text-[7px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">{label}</h4>
      <div className="flex flex-wrap gap-1">
        {items.map(({ earnedAt, def }) => (
          <div
            key={def.id}
            title={`${def.name} — ${def.description}\n${new Date(earnedAt).toLocaleDateString('en-US')}`}
            className={`${achievementBadgeClass(def, { compact: true })} inline-flex items-center gap-1 px-1.5 py-0.5`}
          >
            <span className="ach-badge__icon text-[13px]">{def.icon}</span>
            <div className="ach-badge__body max-w-[6.5rem]">
              <p className="ach-badge__name text-[8px] truncate">{def.name}</p>
              <p className="ach-badge__meta text-[6px]">{def.rarity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
