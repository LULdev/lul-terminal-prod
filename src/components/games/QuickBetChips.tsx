/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QUICK_BETS } from '../../lib/games';

export function QuickBetChips({
  bet,
  maxBet,
  disabled,
  onSelect,
}: {
  bet: number;
  maxBet: number;
  disabled?: boolean;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_BETS.filter((n) => n <= maxBet).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(n)}
          className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold tabular-nums transition-all ${
            bet === n
              ? 'border-amber-400/50 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : 'border-slate-800 bg-black/30 text-slate-500 hover:border-slate-600 hover:text-slate-300'
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(maxBet)}
        className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold uppercase transition-all ${
          bet === maxBet
            ? 'border-violet-400/50 bg-violet-500/15 text-violet-200'
            : 'border-slate-800 bg-black/30 text-slate-500 hover:border-slate-600'
        }`}
      >
        Max
      </button>
    </div>
  );
}