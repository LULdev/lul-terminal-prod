/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { getGameAchievementBadges, type GameAchievementBadge } from '../../lib/arcadeStats';
import type { GameId } from '../../lib/gameCatalog';

type Props = {
  gameId: GameId;
  earnedIds: Set<string>;
  size?: 'sm' | 'md';
};

function BadgePip({ badge, size }: { badge: GameAchievementBadge; size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]';
  return (
    <span
      title={`${badge.label}${badge.earned ? ' ✓' : ' — locked'}`}
      className={`inline-flex items-center justify-center rounded-md border shrink-0 ${dim} ${
        badge.earned
          ? 'border-amber-500/40 bg-amber-500/15 opacity-100'
          : 'border-slate-800/80 bg-black/30 opacity-35 grayscale'
      }`}
    >
      {badge.icon}
    </span>
  );
}

export function GameAchievementBadges({ gameId, earnedIds, size = 'sm' }: Props) {
  const badges = getGameAchievementBadges(gameId, earnedIds);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div className="flex items-center justify-center gap-0.5 mt-1">
      {badges.map((b) => (
        <React.Fragment key={b.id}>
          <BadgePip badge={b} size={size} />
        </React.Fragment>
      ))}
      {earned > 0 && (
        <span className="text-[6px] font-mono text-amber-500/80 ml-0.5 tabular-nums">{earned}/3</span>
      )}
    </div>
  );
}