/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  ACHIEVEMENT_BY_ID,
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
    <div className={`space-y-4 ${compact ? '' : 'rounded-2xl border border-violet-500/20 bg-[#0c0d12]/80 p-4'}`}>
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-violet-300 flex items-center gap-2">
            <span className="text-base">🏆</span> Showcase — Awards & Achievements
          </h3>
          <span className="text-[9px] font-mono text-slate-600">
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
      <h4 className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map((def) => {
          const unlocked = earnedMap.has(def.id);
          const earnedAt = earnedMap.get(def.id);
          return (
            <div
              key={def.id}
              title={unlocked ? def.description : def.howToUnlock}
              className={`relative rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all duration-300 ${
                unlocked
                  ? `${TIER_STYLES[def.tier]} achievement-card-unlocked`
                  : 'border-slate-800/60 bg-slate-900/30 opacity-45 grayscale'
              }`}
            >
              {unlocked && def.tier === 'mythic' && (
                <span className="absolute inset-0 rounded-xl achievement-shimmer pointer-events-none" />
              )}
              <span className={`text-xl relative z-10 ${unlocked ? 'achievement-icon-float' : ''}`}>
                {def.icon}
              </span>
              <span className="text-[9px] font-semibold text-white leading-tight relative z-10">{def.name}</span>
              <span className="text-[7px] font-mono uppercase text-slate-500 relative z-10">{def.rarity}</span>
              {unlocked && earnedAt && (
                <span className="text-[7px] font-mono text-slate-600 relative z-10">
                  {new Date(earnedAt).toLocaleDateString('en-US')}
                </span>
              )}
              {!unlocked && (
                <span className="text-[7px] font-mono text-slate-600 relative z-10 line-clamp-2">🔒 {def.howToUnlock}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}