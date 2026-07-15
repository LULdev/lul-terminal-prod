/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bot, Users } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { QuickBetChips } from './QuickBetChips';
import { LulCoinAmount, LulCoinChip } from './LulCoinAmount';

type Props = {
  catalog: GameCatalogEntry;
  isLoggedIn: boolean;
  matchActive: boolean;
  bet: number;
  minBet: number;
  maxBet: number;
  mode: 'pvp' | 'bot';
  difficulty: string;
  roomCode: string;
  streak?: number;
  streakBonusHint?: number;
  onBetChange: (n: number) => void;
  onModeChange: (m: 'pvp' | 'bot') => void;
  onDifficultyChange: (d: string) => void;
  onRoomCodeChange: (c: string) => void;
};

export function ArenaSetupBar({
  catalog,
  isLoggedIn,
  matchActive,
  bet,
  minBet,
  maxBet,
  mode,
  difficulty,
  roomCode,
  streak,
  streakBonusHint,
  onBetChange,
  onModeChange,
  onDifficultyChange,
  onRoomCodeChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['pvp', 'bot'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={!isLoggedIn || matchActive}
            onClick={() => onModeChange(m)}
            className={`flex-1 min-w-[100px] py-2 rounded-xl border text-[10px] font-mono uppercase transition-all ${
              mode === m
                ? `${catalog.borderClass} ${catalog.accent}`
                : 'border-slate-800 text-slate-500 hover:border-slate-700'
            }`}
          >
            {m === 'pvp' ? <><Users size={12} className="inline mr-1" />Multiplayer</> : <><Bot size={12} className="inline mr-1" />vs BOT</>}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-mono uppercase text-slate-600 flex items-center gap-1">
            Wager · <LulCoinAmount amount={minBet} variant="bet" size="xs" suffix={false} />–<LulCoinAmount amount={maxBet} variant="bet" size="xs" />
          </span>
          {(streak ?? 0) > 0 && streakBonusHint ? (
            <LulCoinChip variant="streak" label={`🔥 +${streakBonusHint}`} />
          ) : null}
        </div>
        <QuickBetChips bet={bet} maxBet={maxBet} disabled={!isLoggedIn || matchActive} onSelect={onBetChange} />
        <input
          type="number"
          min={minBet}
          max={maxBet}
          value={bet}
          disabled={!isLoggedIn || matchActive}
          onChange={(e) => onBetChange(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
          className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[11px] font-mono text-slate-200"
        />
      </div>

      {mode === 'bot' ? (
        <div className="flex gap-1.5">
          {(['easy', 'normal', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={!isLoggedIn || matchActive}
              onClick={() => onDifficultyChange(d)}
              className={`flex-1 py-1.5 rounded-lg border text-[8px] font-mono uppercase transition ${
                difficulty === d ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-slate-800 text-slate-600 hover:border-slate-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      ) : (
        <input
          value={roomCode}
          disabled={!isLoggedIn || matchActive}
          onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
          placeholder="Private room code (optional)"
          className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-200 uppercase placeholder:normal-case placeholder:text-slate-600"
        />
      )}
    </div>
  );
}