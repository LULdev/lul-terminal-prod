/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import {
  ACHIEVEMENT_BY_ID,
  TIER_STYLES,
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
    <div className="rounded-xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/20 via-[#0c0d12] to-indigo-950/15 px-3 py-2.5 relative overflow-hidden">
      <div className="absolute -top-8 -left-8 w-24 h-24 bg-fuchsia-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className="text-[9px] font-mono font-bold uppercase tracking-wider text-fuchsia-300 flex items-center gap-1.5">
            <Sparkles size={11} className="text-fuchsia-400" />
            Unlocked · Achievements & Awards
          </h3>
          <span className="text-[8px] font-mono text-fuchsia-500/70">{unlocked.length} earned</span>
        </div>

        {unlocked.length === 0 ? (
          <p className="text-[8px] font-mono text-slate-500 leading-relaxed">
            No trophies yet — explore the terminal, arcade, and vault.
          </p>
        ) : (
          <div className="space-y-2">
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
      <h4 className="text-[7px] font-mono uppercase tracking-widest text-slate-500 mb-1">{label}</h4>
      <div className="flex flex-wrap gap-1">
        {items.map(({ earnedAt, def }) => (
          <div
            key={def.id}
            title={`${def.name} — ${def.description}\n${new Date(earnedAt).toLocaleDateString('en-US')}`}
            className={`group relative inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 transition-all duration-200 hover:scale-[1.03] ${TIER_STYLES[def.tier]} achievement-card-unlocked`}
          >
            {def.tier === 'mythic' && (
              <span className="absolute inset-0 rounded-lg achievement-shimmer pointer-events-none" />
            )}
            <span className="text-sm leading-none relative z-10">{def.icon}</span>
            <div className="relative z-10 min-w-0 max-w-[7.5rem]">
              <p className="text-[8px] font-semibold text-white leading-tight truncate">{def.name}</p>
              <p className="text-[6px] font-mono text-slate-500 uppercase leading-none">{def.rarity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
