/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rich hover tooltip for trophies (matches UserBar Hall of Fame style).
 */

import React from 'react';
import type { AchievementDef, AchievementRarity } from '../../data/achievements';

export function formatTrophyDate(ts?: number | null): string {
  if (ts == null || !Number.isFinite(ts)) return '';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();
}

type TrophyTipProps = {
  def: Pick<AchievementDef, 'name' | 'description' | 'howToUnlock' | 'rarity' | 'kind'>;
  unlocked?: boolean;
  earnedAt?: number | null;
};

/** Floating tip body — parent must use `.trophy-tip-host`. */
export function TrophyTip({ def, unlocked = true, earnedAt }: TrophyTipProps) {
  const desc = unlocked ? def.description : def.howToUnlock;
  const metaParts = [
    def.rarity.toUpperCase(),
    unlocked
      ? (formatTrophyDate(earnedAt) || undefined)
      : 'LOCKED',
  ].filter(Boolean);

  return (
    <span className="trophy-tip" role="tooltip">
      <span className="trophy-tip__name">{def.name}</span>
      {desc ? <span className="trophy-tip__desc">{desc}</span> : null}
      <span className={`trophy-tip__meta trophy-tip__meta--${def.rarity as AchievementRarity}`}>
        {metaParts.join(' · ')}
      </span>
    </span>
  );
}
