/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  ACHIEVEMENT_CATALOG,
  achievementBadgeClass,
  type EarnedAchievement,
} from '../../data/achievements';
import { TrophyTip } from './TrophyTip';

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
    <div className={`space-y-2 trophy-section ${compact ? '' : 'rounded-xl border border-violet-500/15 bg-[#0c0d12]/80 px-2.5 py-2'}`}>
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1">
            <span className="text-sm leading-none">🏆</span> Showcase
          </h3>
          <span className="text-[7px] font-mono text-slate-600">
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
      <h4 className="text-[7px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">{title}</h4>
      <div className="trophy-section__row grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1">
        {items.map((def) => {
          const unlocked = earnedMap.has(def.id);
          const earnedAt = earnedMap.get(def.id);
          return (
            <div
              key={def.id}
              tabIndex={0}
              className={`${achievementBadgeClass(def, { unlocked, compact: true })} trophy-tip-host flex flex-col items-center gap-0.5 text-center px-1 py-1 min-h-[3.1rem]`}
            >
              <span className="ach-badge__icon text-[11px]">
                {def.icon}
              </span>
              <span className="ach-badge__name text-[7px] leading-snug line-clamp-2 w-full break-words">
                {def.name}
              </span>
              <span className="ach-badge__meta text-[6px]">
                {def.rarity}
              </span>
              <TrophyTip def={def} unlocked={unlocked} earnedAt={earnedAt} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
