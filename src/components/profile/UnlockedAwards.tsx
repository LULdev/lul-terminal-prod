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
    <div className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/25 via-[#0c0d12] to-indigo-950/20 p-4 relative overflow-hidden">
      <div className="absolute -top-10 -left-10 w-36 h-36 bg-fuchsia-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-fuchsia-300 flex items-center gap-2">
            <Sparkles size={14} className="text-fuchsia-400" />
            Unlocked Awards and Earned Achievements
          </h3>
          <span className="text-[9px] font-mono text-fuchsia-500/70">{unlocked.length} earned</span>
        </div>

        {unlocked.length === 0 ? (
          <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
            No trophies unlocked yet — explore the terminal, arcade, and vault to earn your first awards.
          </p>
        ) : (
          <div className="space-y-3">
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
      <h4 className="text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-2">{label}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map(({ earnedAt, def }) => (
          <div
            key={def.id}
            title={`${def.name} — ${def.description}`}
            className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all duration-300 hover:scale-[1.02] ${TIER_STYLES[def.tier]} achievement-card-unlocked`}
          >
            {def.tier === 'mythic' && (
              <span className="absolute inset-0 rounded-xl achievement-shimmer pointer-events-none" />
            )}
            <span className="text-2xl relative z-10 achievement-icon-float">{def.icon}</span>
            <div className="relative z-10 min-w-0">
              <p className="text-[10px] font-semibold text-white leading-tight truncate">{def.name}</p>
              <p className="text-[8px] font-mono text-slate-500 uppercase">{def.rarity}</p>
              <p className="text-[7px] font-mono text-slate-600">
                {new Date(earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}