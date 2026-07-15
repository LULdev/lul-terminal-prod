/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Crown, RefreshCw, Trophy } from 'lucide-react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import {
  fetchLeaderboards,
  type LeaderboardsResponse,
} from '../../lib/adminModules';
import { BOARD_ACCENT_STYLES, formatBoardValue, formatRelativeEn, type LeaderboardAccent } from '../../lib/leaderboards';
import { ToolCard } from '../pages/PageShell';

export function AdminLeaderboardsPanel() {
  const [data, setData] = useState<LeaderboardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    setLoading(true);
    try {
      const result = await fetchLeaderboards();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [loadGenRef, mountedRef]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500 max-w-xl">
          Leaderboard Control — all boards, top-3 podium & latest award sync.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-violet-300"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[8px] font-mono text-slate-600">
            <Trophy size={12} className="text-amber-400" />
            {data.boards.length} boards · {formatRelativeEn(data.generatedAt)}
            {data.lastAwardSync?.synced && (
              <span className="text-emerald-400/80">
                · Award sync: {data.lastAwardSync.grants.length} grants
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.boards.map((board) => {
              const accent = (board.accent in BOARD_ACCENT_STYLES ? board.accent : 'cyan') as LeaderboardAccent;
              const styles = BOARD_ACCENT_STYLES[accent];
              const isOpen = expanded === board.id;

              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : board.id)}
                  className={`text-left rounded-2xl border ${styles.border} bg-gradient-to-br ${styles.glow} to-black/30 p-4 transition-all hover:brightness-110`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{board.icon}</span>
                    <div className="min-w-0">
                      <div className={`text-[10px] font-mono font-bold ${styles.text}`}>{board.title}</div>
                      <div className="text-[7px] font-mono text-slate-600">{board.id}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {board.top3.map((entry) => (
                      <div key={entry.userId} className="flex items-center gap-2 text-[9px] font-mono">
                        <span className="text-slate-600 w-4">#{entry.rank}</span>
                        <span className="text-slate-300 truncate flex-1">@{entry.username}</span>
                        <span className={`${styles.text} tabular-nums`}>
                          {formatBoardValue(entry.value, board.unit)}
                        </span>
                      </div>
                    ))}
                    {!board.top3.length && (
                      <div className="text-[8px] font-mono text-slate-600">No entries</div>
                    )}
                  </div>

                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60 text-[7px] font-mono text-slate-600 space-y-1">
                      <div>Award: {board.awardId}</div>
                      <div>Unit: {board.unit}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {data.lastAwardSync?.grants?.length ? (
            <ToolCard title="Recent award grants" icon="🎖️" accent="amber">
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {data.lastAwardSync.grants.slice(0, 12).map((g, i) => (
                  <div key={`${g.username}-${g.awardId}-${i}`} className="text-[8px] font-mono text-slate-500 flex gap-2">
                    <Crown size={10} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-violet-300">@{g.username}</span>
                    <span>→ {g.boardTitle} #{g.rank}</span>
                  </div>
                ))}
              </div>
            </ToolCard>
          ) : null}
        </>
      )}
    </div>
  );
}