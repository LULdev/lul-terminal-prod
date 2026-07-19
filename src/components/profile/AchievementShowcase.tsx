/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  ACHIEVEMENT_CATALOG,
  TIER_STYLES,
  type EarnedAchievement,
} from '../../data/achievements';

type AchievementShowcaseProps = {
  earned: EarnedAchievement[];
  compact?: boolean;
};

export function AchievementShowcase({ earned, compact }: AchievementShowcaseProps) {
  const earnedMap = useMemo(
    () => new Map(earned.map((e) => [e.id, e.earnedAt])),
    [earned],
  );

  const achievements = ACHIEVEMENT_CATALOG.filter((a) => a.kind === 'achievement');
  const awards = ACHIEVEMENT_CATALOG.filter((a) => a.kind === 'award');

  return (
    <div className={`space-y-2.5 ${compact ? '' : 'rounded-xl border border-violet-500/15 bg-[#0c0d12]/80 px-3 py-2.5'}`}>
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[9px] font-mono font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
            <span className="text-sm">🏆</span> Showcase
          </h3>
          <span className="text-[8px] font-mono text-slate-600">
            {earned.length}/{ACHIEVEMENT_CATALOG.length}
          </span>
        </div>
      )}

      <ShowcaseGroup title="Achievements" items={achievements} earnedMap={earnedMap} />
      <ShowcaseGroup title="Awards" items={awards} earnedMap={earnedMap} />
    </div>
  );
}

function ShowcaseGroup({
  title,
  items,
  earnedMap,
}: {
  title: string;
  items: typeof ACHIEVEMENT_CATALOG;
  earnedMap: Map<string, number>;
}) {
  return (
    <div>
      <h4 className="text-[7px] font-mono uppercase tracking-widest text-slate-500 mb-1">{title}</h4>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1">
        {items.map((def) => {
          const unlocked = earnedMap.has(def.id);
          const earnedAt = earnedMap.get(def.id);
          return (
            <div
              key={def.id}
              title={unlocked
                ? `${def.name} — ${def.description}${earnedAt ? `\n${new Date(earnedAt).toLocaleDateString('en-US')}` : ''}`
                : def.howToUnlock}
              className={`relative rounded-lg border px-1.5 py-1.5 flex flex-col items-center gap-0.5 text-center transition-all duration-200 ${
                unlocked
                  ? `${TIER_STYLES[def.tier]} achievement-card-unlocked`
                  : 'border-slate-800/60 bg-slate-900/30 opacity-40 grayscale'
              }`}
            >
              {unlocked && def.tier === 'mythic' && (
                <span className="absolute inset-0 rounded-lg achievement-shimmer pointer-events-none" />
              )}
              <span className={`text-base leading-none relative z-10 ${unlocked ? 'achievement-icon-float' : ''}`}>
                {def.icon}
              </span>
              <span className="text-[7px] font-semibold text-white leading-tight relative z-10 line-clamp-2 w-full">
                {def.name}
              </span>
              <span className="text-[6px] font-mono uppercase text-slate-500 relative z-10 leading-none">
                {def.rarity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
