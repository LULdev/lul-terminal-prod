/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GAME_CATALOG_MAP } from '../../lib/gameCatalog';
import { MOVE_META, type MatchHistoryEntry, type RpsMove } from '../../lib/games';
import { LulCoinChip } from './LulCoinAmount';

function moveEmoji(m?: RpsMove) {
  return m ? MOVE_META[m].emoji : '·';
}

function boardPreview(board?: Array<'X' | 'O' | null>) {
  if (!board?.length) return '🔲';
  const filled = board.filter(Boolean).length;
  return filled >= 9 ? '⭕✕' : '🔲';
}

function gameIcon(gameId?: string) {
  return GAME_CATALOG_MAP[gameId ?? '']?.icon ?? '🎮';
}

function historyOutcomeLabel(h: MatchHistoryEntry): string {
  if (h.outcome === 'draw') return 'draw';
  if (h.outcome === 'win') return `${h.player1} won`;
  if (h.outcome === 'loss') return `${h.player2} won`;
  return h.outcome ?? '—';
}

export function MatchTicker({ matches }: { matches: MatchHistoryEntry[] }) {
  if (!matches.length) return null;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-black/20 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase text-slate-500">Live wire · recent duels</span>
        <span className="text-[8px] font-mono text-slate-600">{matches.length} shown</span>
      </div>
      <div className="divide-y divide-slate-800/40 max-h-48 overflow-y-auto">
        {matches.map((h) => {
          const isRps = h.game === 'rps';
          const isTtt = h.game === 'ttt';
          const leftIcon = isRps ? moveEmoji(h.p1Move) : isTtt ? boardPreview(h.board) : gameIcon(h.game);
          const rightIcon = isRps ? moveEmoji(h.p2Move) : '';
          return (
            <div key={h.id} className="px-3 py-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors">
              <span className="text-base shrink-0">{leftIcon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-mono text-slate-400 truncate">
                  <span className="text-[7px] uppercase px-1 py-0.5 rounded border border-slate-700 text-slate-500 mr-1">
                    {(h.game ?? 'rps').toUpperCase()}
                  </span>
                  <span className="text-slate-300">{h.player1}</span>
                  <span className="text-slate-600 mx-1">vs</span>
                  <span className="text-slate-300">{h.player2}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {!isTtt && h.seriesType === 'bo3' && (
                    <span className="text-[7px] font-mono uppercase px-1.5 py-0.5 rounded border border-violet-500/30 text-violet-300">Bo3</span>
                  )}
                  <LulCoinChip variant="bet" amount={h.bet} />
                  {h.streakBonus ? (
                    <LulCoinChip variant="streak" label={`+${h.streakBonus} streak`} />
                  ) : null}
                </div>
              </div>
              {rightIcon ? <span className="text-base shrink-0">{rightIcon}</span> : null}
              <span
                className={`text-[8px] font-mono uppercase font-bold shrink-0 min-w-[3rem] text-right ${
                  h.outcome === 'win' ? 'text-emerald-400' : h.outcome === 'loss' ? 'text-rose-400' : 'text-slate-500'
                }`}
              >
                {historyOutcomeLabel(h)}
              </span>
              {h.jackpotHit ? <span className="shrink-0">🎰</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}