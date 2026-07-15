/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Coins, Sparkles, X } from 'lucide-react';
import { ACHIEVEMENT_BY_ID, TIER_STYLES } from '../../data/achievements';
import { LulCoinAmount } from '../games/LulCoinAmount';

type AchievementNotificationProps = {
  unlockIds: string[];
  unlockRewards?: Record<string, number>;
  onDismiss: () => void;
};

export function AchievementNotification({
  unlockIds,
  unlockRewards = {},
  onDismiss,
}: AchievementNotificationProps) {
  const items = useMemo(
    () => unlockIds.map((id) => ACHIEVEMENT_BY_ID[id]).filter(Boolean),
    [unlockIds],
  );
  const totalCoins = useMemo(
    () => unlockIds.reduce((sum, id) => sum + (unlockRewards[id] ?? 0), 0),
    [unlockIds, unlockRewards],
  );

  if (!unlockIds.length) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-2xl border border-amber-500/35 bg-gradient-to-br from-[#1a1528] via-[#0c0d12] to-[#0f172a] p-5 shadow-[0_0_60px_rgba(245,158,11,0.15)] achievement-notify-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-notify-title"
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-2 mb-4 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 achievement-notify-glow">
            <Sparkles className="text-amber-300" size={18} />
          </div>
          <div>
            <h2 id="achievement-notify-title" className="text-sm font-semibold text-amber-100">
              {items.length === 1 ? 'New Achievement!' : 'New Achievements!'}
            </h2>
            <p className="text-[9px] font-mono text-slate-500">
              Unlocked — congratulations!
              {totalCoins > 0 && (
                <span className="inline-flex items-center gap-1 ml-1">
                  · <LulCoinAmount amount={totalCoins} variant="earn" size="xs" suffix="LULcoins" showIcon />
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((def) => (
            <div
              key={def.id}
              className={`flex items-start gap-3 rounded-xl border p-3 ${TIER_STYLES[def.tier]}`}
            >
              <span className="text-2xl shrink-0 achievement-icon-float">{def.icon}</span>
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
                  {def.kind === 'award' ? 'Award' : 'Achievement'}
                </div>
                <div className="text-sm font-semibold text-white">{def.name}</div>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{def.description}</p>
                {(unlockRewards[def.id] ?? 0) > 0 && (
                  <p className="lul-coin-reward-line mt-1.5">
                    <Coins size={10} />
                    <LulCoinAmount amount={unlockRewards[def.id]} variant="earn" size="xs" suffix="LULcoins" />
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-[11px] font-mono font-semibold text-amber-200 hover:bg-amber-500/25 transition"
        >
          OK
        </button>
      </div>
    </div>
  );
}