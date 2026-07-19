/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import {
  ACHIEVEMENT_BY_ID,
  TIER_STYLES,
  type EarnedAchievement,
} from '../../data/achievements';
import { isCoinSensitiveAchievement } from '../../lib/achievementPrivacy';
import { LEADERBOARD_AWARD_IDS } from '../../lib/leaderboards';

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
      <div className="flex flex-wrap items-center gap-1 mt-1.5" role="list" aria-label="Hall of Fame awards">
        <span className="text-[7px] font-mono uppercase tracking-wider text-amber-500/80 mr-0.5 inline-flex items-center gap-0.5">
          <Trophy size={9} className="text-amber-400" /> HoF
        </span>
        {badges.map(({ id, earnedAt, def }) => (
          <span
            key={id}
            role="listitem"
            title={`${def.name} — ${def.description}\n${new Date(earnedAt).toLocaleDateString('en-US')}`}
            className={`relative inline-flex items-center gap-0.5 rounded-md border px-1 py-0.5 ${TIER_STYLES[def.tier]}`}
          >
            <span className="text-xs leading-none">{def.icon}</span>
            <span className="text-[7px] font-semibold text-white leading-none max-w-[4.5rem] truncate hidden sm:inline">
              {def.name}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-[#0c0d12] to-violet-950/15 px-3 py-2.5 relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Trophy size={11} className="text-amber-400" />
            Hall of Fame
          </h3>
          <span className="text-[8px] font-mono text-amber-500/70">{badges.length} earned</span>
        </div>
        <p className="text-[8px] font-mono text-slate-500 mb-1.5 leading-snug">
          Top 3 podium awards · announced by the BOT in the terminal.
        </p>
        {badges.length === 0 ? (
          <p className="text-[8px] font-mono text-slate-600 leading-relaxed">
            No Hall of Fame awards yet — climb the leaderboards.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {badges.map(({ id, earnedAt, def }) => (
              <div
                key={id}
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
        )}
      </div>
    </div>
  );
}
