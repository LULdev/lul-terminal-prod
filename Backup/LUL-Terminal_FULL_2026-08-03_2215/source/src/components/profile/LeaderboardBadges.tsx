/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import {
  ACHIEVEMENT_BY_ID,
  achievementBadgeClass,
  type EarnedAchievement,
} from '../../data/achievements';
import { isCoinSensitiveAchievement } from '../../lib/achievementPrivacy';
import { LEADERBOARD_AWARD_IDS } from '../../lib/leaderboards';
import { TrophyTip } from './TrophyTip';

type LeaderboardBadgesProps = {
  earned: EarnedAchievement[];
  showActivityStats?: boolean;
  showCoins?: boolean;
  /** Dense strip for profile hero (no outer card). */
  inline?: boolean;
};

function isLeaderboardActivitySensitive(id: string): boolean {
  if (id.startsWith('lb_top_game_')) return true;
  if (id === 'lb_top_lul_coins') return true;
  return false;
}

export function useHallOfFameBadges(
  earned: EarnedAchievement[],
  showActivityStats = true,
  showCoins = true,
) {
  return useMemo(() => {
    const map = new Map(earned.map((e) => [e.id, e.earnedAt]));
    return LEADERBOARD_AWARD_IDS
      .filter((id) => {
        if (!map.has(id)) return false;
        if (!showActivityStats && isLeaderboardActivitySensitive(id)) return false;
        if (!showCoins && isCoinSensitiveAchievement(id)) return false;
        return true;
      })
      .map((id) => ({
        id,
        earnedAt: map.get(id)!,
        def: ACHIEVEMENT_BY_ID[id],
      }))
      .filter((b): b is typeof b & { def: NonNullable<typeof b.def> } => Boolean(b.def));
  }, [earned, showActivityStats, showCoins]);
}

export function LeaderboardBadges({
  earned,
  showActivityStats = true,
  showCoins = true,
  inline = false,
}: LeaderboardBadgesProps) {
  const badges = useHallOfFameBadges(earned, showActivityStats, showCoins);

  if (inline) {
    if (badges.length === 0) return null;
    return (
      <div className="profile-hof-inline trophy-section__row" role="list" aria-label="Hall of Fame awards">
        <span className="profile-hof-inline__label">
          <Trophy size={9} aria-hidden /> HoF
        </span>
        {badges.map(({ id, earnedAt, def }) => (
          <span
            key={id}
            role="listitem"
            tabIndex={0}
            className={`${achievementBadgeClass(def, { compact: true })} trophy-tip-host`}
          >
            <span className="ach-badge__icon" aria-hidden>{def.icon}</span>
            <TrophyTip def={def} unlocked earnedAt={earnedAt} />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="trophy-section rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-[#0c0d12] to-violet-950/15 px-2.5 py-2 relative overflow-visible">
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="relative overflow-visible">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-[8px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
            <Trophy size={10} className="text-amber-400" />
            Hall of Fame
          </h3>
          <span className="text-[7px] font-mono text-amber-500/70">{badges.length} earned</span>
        </div>
        <p className="text-[7px] font-mono text-slate-500 mb-1 leading-snug">
          Top 3 podium awards · BOT announces in terminal.
        </p>
        {badges.length === 0 ? (
          <p className="text-[8px] font-mono text-slate-600 leading-relaxed">
            No Hall of Fame awards yet — climb the leaderboards.
          </p>
        ) : (
          <div className="trophy-section__row flex flex-wrap gap-1">
            {badges.map(({ id, earnedAt, def }) => (
              <div
                key={id}
                tabIndex={0}
                className={`${achievementBadgeClass(def, { compact: true })} trophy-tip-host inline-flex items-center gap-1 px-1.5 py-1 max-w-[9.5rem]`}
              >
                <span className="ach-badge__icon text-[11px]">{def.icon}</span>
                <div className="ach-badge__body min-w-0">
                  <p className="ach-badge__name text-[8px] leading-snug break-words">{def.name}</p>
                  <p className="ach-badge__meta text-[6px]">{def.rarity}</p>
                </div>
                <TrophyTip def={def} unlocked earnedAt={earnedAt} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
