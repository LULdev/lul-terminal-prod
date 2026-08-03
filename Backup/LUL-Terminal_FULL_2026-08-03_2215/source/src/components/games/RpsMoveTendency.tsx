/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MOVE_META, type MoveCounts, type RpsMove } from '../../lib/games';

export function RpsMoveTendency({ moves, title = 'Your move DNA' }: { moves: MoveCounts; title?: string }) {
  const total = moves.rock + moves.paper + moves.scissors;
  const rows: RpsMove[] = ['rock', 'paper', 'scissors'];

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-black/25 p-3">
      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mb-3">{title}</div>
      <div className="space-y-2.5">
        {rows.map((m) => {
          const v = moves[m];
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          const meta = MOVE_META[m];
          return (
            <div key={m}>
              <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                <span className={`flex items-center gap-1.5 ${meta.color}`}>
                  <span>{meta.emoji}</span>
                  {meta.label}
                </span>
                <span className="text-slate-500 tabular-nums">{v} · {pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900/80 overflow-hidden border border-slate-800/60">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${meta.bg} transition-all duration-700`}
                  style={{ width: `${total > 0 ? pct : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {!total && (
        <p className="mt-3 text-[8px] font-mono text-slate-600 text-center">Play matches to unlock your tendency chart</p>
      )}
    </div>
  );
}

export function RpsGlobalMeta({
  totals,
  favorite,
}: {
  totals: MoveCounts;
  favorite: RpsMove | null;
}) {
  const total = totals.rock + totals.paper + totals.scissors;
  if (!total) return null;
  const fav = favorite ? MOVE_META[favorite] : null;

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-3 py-2.5 flex items-center gap-3">
      <span className="text-lg">{fav?.emoji ?? '🌐'}</span>
      <div>
        <div className="text-[8px] font-mono uppercase text-indigo-400/80">Community meta</div>
        <div className="text-[10px] font-mono text-slate-300">
          Most played: <span className={fav?.color}>{fav?.label ?? '—'}</span>
          <span className="text-slate-600 ml-1">({total.toLocaleString('en-US')} picks)</span>
        </div>
      </div>
    </div>
  );
}