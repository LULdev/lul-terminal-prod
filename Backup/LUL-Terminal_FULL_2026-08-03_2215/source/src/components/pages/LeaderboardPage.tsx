/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Shield, Trophy, Zap } from 'lucide-react';
import type { TabId } from '../../config/menuItems';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import {
  BOARD_ACCENT_STYLES,
  boardsDataEqual,
  fetchLeaderboards,
  filterLeaderboardBoards,
  formatBoardValue,
  formatRelativeEn,
  LEADERBOARD_FILTER_OPTIONS,
  RANK_STYLES,
  type LeaderboardBoard,
  type LeaderboardEntry,
  type LeaderboardAccent,
  type LeaderboardFilter,
} from '../../lib/leaderboards';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { PageShell } from './PageShell';

type LeaderboardPageProps = {
  onNavigate?: (tab: TabId, opts?: { profileUsername?: string }) => void;
};

export function LeaderboardPage({ onNavigate }: LeaderboardPageProps) {
  const [boards, setBoards] = useState<LeaderboardBoard[]>([]);
  const [generatedAt, setGeneratedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);
  const boardsRef = useRef<LeaderboardBoard[]>([]);
  const initialLoadedRef = useRef(false);
  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const visibleBoards = useMemo(
    () => filterLeaderboardBoards(boards, filter),
    [boards, filter],
  );

  const load = useCallback((background = false) => {
    if (background) {
      const since = Date.now() - lastFetchAtRef.current;
      if (since < 30_000) return;
    }
    const gen = ++loadGenRef.current;
    if (!background) setLoading(true);
    fetchLeaderboards()
      .then((d) => {
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        if (!boardsDataEqual(boardsRef.current, d.boards)) {
          boardsRef.current = d.boards;
          setBoards(d.boards);
        }
        setGeneratedAt((prev) => (prev === d.generatedAt ? prev : d.generatedAt));
        setErr('');
      })
      .catch((e) => {
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        setErr(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        lastFetchAtRef.current = Date.now();
        setLoading(false);
        initialLoadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (initialLoadedRef.current) return;
    load(false);
  }, [load]);

  useVisibilityAwarePoll(() => {
    if (!initialLoadedRef.current) return;
    load(true);
  }, 60_000, true);

  return (
    <PageShell
      id="leaderboard-module"
      pageId="leaderboard"
      icon="🏆"
      title="Hall of Fame"
      subtitle={`Top 3 leaderboards · ${boards.length || '…'} boards · exclusive awards`}
      accentClass="text-amber-400"
    >
      <div className="space-y-5 max-w-5xl">
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/35 via-[#0c0d12] to-violet-950/25 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-3">
            <Trophy size={18} className="text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Reach <span className="text-amber-300 font-semibold">Top 3</span> in any category to earn a permanent award.
                The BOT posts a public congratulations in the terminal — and your profile gets a Hall of Fame showcase.
              </p>
            </div>
            {generatedAt > 0 && (
              <span className="text-[8px] font-mono shrink-0 text-slate-600 tabular-nums min-w-[5.5rem] text-right">
                Synced {formatRelativeEn(generatedAt)}
              </span>
            )}
          </div>
        </div>

        {err && (
          <p className="text-[10px] font-mono text-rose-400 p-3 rounded-xl border border-rose-500/20 bg-rose-950/20">
            {err}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {LEADERBOARD_FILTER_OPTIONS.map((opt) => {
            const count = filterLeaderboardBoards(boards, opt.id).length;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-mono uppercase tracking-wide border transition-all ${
                  filter === opt.id
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                    : 'border-slate-800/80 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                }`}
              >
                {opt.icon} {opt.label}
                <span className="ml-1.5 text-slate-600 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {loading && !boards.length ? (
          <LeaderboardSkeleton />
        ) : visibleBoards.length === 0 ? (
          <p className="text-[10px] font-mono text-slate-600 text-center py-12">No boards in this category.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visibleBoards.map((board) => (
              <BoardCard key={board.id} board={board} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

const BoardCard = memo(function BoardCard({
  board,
  onNavigate,
}: {
  board: LeaderboardBoard;
  onNavigate?: LeaderboardPageProps['onNavigate'];
}) {
  const accent = (BOARD_ACCENT_STYLES[board.accent as LeaderboardAccent] ?? BOARD_ACCENT_STYLES.amber);
  const award = ACHIEVEMENT_BY_ID[board.awardId];
  const ordered = [2, 1, 3]
    .map((rank) => board.top3.find((e) => e.rank === rank))
    .filter(Boolean) as LeaderboardEntry[];

  return (
    <article
      className={`rounded-2xl border ${accent.border} bg-gradient-to-br ${accent.glow} via-[#0c0d12] to-[#0a0b10] p-4 flex flex-col gap-3`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`text-sm font-semibold text-white flex items-center gap-2`}>
            <span>{board.icon}</span>
            <span className="truncate">{board.title}</span>
          </h3>
          {award && (
            <p className="text-[9px] font-mono text-slate-500 mt-1 flex items-center gap-1.5">
              <Zap size={10} className="text-amber-400/80 shrink-0" />
              Award: <span className={accent.text}>{award.icon} {award.name}</span>
            </p>
          )}
        </div>
        <span className={`text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${accent.podium} ${accent.text}`}>
          Top 3
        </span>
      </header>

      {board.top3.length === 0 ? (
        <p className="text-[10px] font-mono text-slate-600 py-6 text-center">No qualifying members yet — be the first!</p>
      ) : (
        <div className="hof-podium-stage flex items-end justify-center gap-2 sm:gap-3 pt-2 pb-1 min-h-[200px]">
          {ordered.map((entry) => (
            <PodiumSlot
              key={`${board.id}:${entry.userId}`}
              entry={entry}
              unit={board.unit}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </article>
  );
});

const PodiumSlot = memo(function PodiumSlot({
  entry,
  unit,
  onNavigate,
}: {
  entry: LeaderboardEntry;
  unit: string;
  onNavigate?: LeaderboardPageProps['onNavigate'];
}) {
  const rank = entry.rank as 1 | 2 | 3;
  const style = RANK_STYLES[rank];
  const avatar = safeAvatarUrl(entry.avatarUrl, entry.username);
  const width = rank === 1 ? 'w-[34%]' : 'w-[30%]';

  return (
    <div
      className={`hof-podium-slot hof-podium-rank-${rank} flex flex-col items-center ${width} max-w-[140px]`}
    >
      <button
        type="button"
        onClick={() => onNavigate?.('profile', { profileUsername: entry.username })}
        className="group flex flex-col items-center gap-1.5 mb-2 w-full focus:outline-none"
        title={`View @${entry.username}`}
      >
        <div className={`hof-podium-avatar relative rounded-full ring-2 ${style.ring} transition-transform group-hover:scale-110`}>
          <img
            src={avatar}
            alt={entry.displayName}
            loading="lazy"
            decoding="async"
            className={`rounded-full object-cover border-2 border-[#0c0d12] ${
              rank === 1 ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-11 w-11 sm:h-12 sm:w-12'
            }`}
          />
          <span className="absolute -bottom-1 -right-1 text-sm leading-none drop-shadow">{style.medal}</span>
          {entry.role === 'admin' && (
            <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0d12] border border-violet-500/40">
              <Shield size={8} className="text-violet-400" />
            </span>
          )}
          {entry.role === 'vip' && (
            <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0d12] border border-amber-500/40">
              <Crown size={8} className="text-amber-400" />
            </span>
          )}
        </div>
        <span className={`text-[10px] font-semibold truncate max-w-full ${style.text} group-hover:text-white transition`}>
          {entry.displayName || entry.username}
        </span>
        <span className="text-[8px] font-mono text-slate-600 truncate max-w-full">@{entry.username}</span>
      </button>

      <div className={`hof-podium-bar w-full rounded-t-lg border-t border-x ${style.bar} ${style.height} flex flex-col items-center justify-end pb-2 px-1`}>
        <span className={`text-[11px] font-mono font-bold ${style.text}`}>
          {formatBoardValue(entry.value, unit)}
        </span>
        <span className="text-[7px] font-mono text-slate-500 uppercase">{unit}</span>
      </div>
    </div>
  );
});

function LeaderboardSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-800/60 bg-[#0c0d12]/80 p-4 h-52 animate-pulse" />
      ))}
    </div>
  );
}