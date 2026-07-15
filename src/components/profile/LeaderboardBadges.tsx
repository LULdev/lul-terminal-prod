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
};

function isLeaderboardActivitySensitive(id: string): boolean {
  if (id.startsWith('lb_top_game_')) return true;
  if (id === 'lb_top_lul_coins') return true;
  return false;
}

export function LeaderboardBadges({
  earned,
  showActivityStats = true,
  showCoins = true,
}: LeaderboardBadgesProps) {
  const badges = useMemo(() => {
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
      .filter((b) => b.def);
  }, [earned, showActivityStats, showCoins]);

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-[#0c0d12] to-violet-950/20 p-4 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <Trophy size={14} className="text-amber-400" />
            Hall of Fame — Leaderboard Awards
          </h3>
          <span className="text-[9px] font-mono text-amber-500/70">{badges.length} earned</span>
        </div>
        <p className="text-[9px] font-mono text-slate-500 mb-3 leading-relaxed">
          Permanent awards for reaching Top 3 on the public leaderboards. The BOT announces new entries in the terminal.
        </p>
        {badges.length === 0 ? (
          <p className="text-[9px] font-mono text-slate-600 leading-relaxed">
            No Hall of Fame awards yet — climb the leaderboards to earn permanent podium trophies.
          </p>
        ) : (
        <div className="flex flex-wrap gap-2">
          {badges.map(({ id, earnedAt, def }) => (
            <div
              key={id}
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
        )}
      </div>
    </div>
  );
}