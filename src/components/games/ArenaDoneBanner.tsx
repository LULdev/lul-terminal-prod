/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { outcomeLabel, outcomeTone } from '../../lib/games';
import { LulCoinAmount } from './LulCoinAmount';

type Props = {
  catalog: GameCatalogEntry;
  outcome: string | null;
  streakBonus?: number;
  jackpotHit?: boolean;
  jackpotAmount?: number;
  detail?: React.ReactNode;
  onRematch: () => void;
  onPlayAgain: () => void;
  acting?: boolean;
};

export function ArenaDoneBanner({
  catalog,
  outcome,
  streakBonus = 0,
  jackpotHit = false,
  jackpotAmount = 0,
  detail,
  onRematch,
  onPlayAgain,
  acting = false,
}: Props) {
  const tone = outcomeTone(outcome);

  return (
    <div className="p-6 text-center space-y-3 arena-done-pop">
      <div className="text-3xl arena-done-icon">{catalog.icon}</div>
      {detail}
      <div className={`text-sm font-mono font-bold uppercase ${tone}`}>
        {outcomeLabel(outcome)}
      </div>
      {streakBonus > 0 && (
        <p className="text-[10px] font-mono flex items-center justify-center gap-1.5">
          🔥 Streak bonus <LulCoinAmount amount={streakBonus} variant="streak" size="sm" />
        </p>
      )}
      {jackpotHit && (
        <p className="lul-coin-jackpot-pool text-[11px] font-mono flex items-center justify-center">
          🎰 Jackpot <LulCoinAmount amount={jackpotAmount} variant="jackpot" size="md" />
        </p>
      )}
      <div className="flex justify-center gap-2 pt-2">
        <button
          type="button"
          disabled={acting}
          onClick={onRematch}
          className="px-4 py-2 rounded-xl border border-violet-500/35 text-[10px] font-mono text-violet-200 flex items-center gap-1 hover:bg-violet-500/10 transition disabled:opacity-40"
        >
          <RotateCcw size={12} /> Rematch
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={onPlayAgain}
          className={`px-4 py-2 rounded-xl border text-[10px] font-mono transition hover:brightness-110 disabled:opacity-40 ${catalog.borderClass}`}
        >
          New game
        </button>
      </div>
    </div>
  );
}