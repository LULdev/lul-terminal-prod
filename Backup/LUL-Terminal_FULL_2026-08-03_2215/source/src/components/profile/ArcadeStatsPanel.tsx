/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Award, BarChart3, Coins, Flame, Gamepad2, Medal, Search, Sparkles, Trophy, Zap } from 'lucide-react';
import type { EarnedAchievement } from '../../data/achievements';
import { GAME_CATALOG, type GameId } from '../../lib/gameCatalog';
import {
  computeArcadeSummary,
  countEarnedGameBadges,
  findUserLeaderboardRanks,
  GAME_CATEGORIES,
  getGameAchievementBadges,
  getGameStats,
  rankGamesByPlayed,
  type ArcadeStatsSource,
  type GameCategory,
} from '../../lib/arcadeStats';
import type { GamesLeaderboard, GamesState, MoveCounts, RpsStats } from '../../lib/games';
import { LulCoinAmount } from '../games/LulCoinAmount';

type Props = {
  source: ArcadeStatsSource;
  compact?: boolean;
  username?: string;
  achievements?: EarnedAchievement[];
  gamesState?: GamesState | null;
  leaderboard?: GamesLeaderboard | null;
  showCoins?: boolean;
  showActivityStats?: boolean;
};

type SortMode = 'played' | 'winrate' | 'streak';

function getGameSlice(state: GamesState | null | undefined, gameId: string) {
  return state?.games?.[gameId] ?? state?.[gameId as 'rps' | 'ttt'];
}

function SummaryTile({
  label,
  value,
  sub,
  icon,
  accent,
  coinTile = false,
  coinAmount,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  coinTile?: boolean;
  coinAmount?: number;
}) {
  return (
    <div className={`rounded-xl border border-slate-800/70 bg-black/25 px-3 py-2.5 ${coinTile ? 'lul-coin-summary-tile' : ''}`}>
      <div className={`flex items-center gap-1 text-[7px] font-mono uppercase ${coinTile ? 'lul-coin-label lul-coin-label--sm' : `text-slate-600 ${accent}`}`}>
        {icon}
        {label}
      </div>
      {coinTile && coinAmount != null ? (
        <LulCoinAmount amount={coinAmount} variant="balance" size="lg" suffix={false} className="mt-1" />
      ) : (
        <div className={`text-lg font-mono font-bold tabular-nums mt-1 ${accent}`}>{value}</div>
      )}
      {sub && <div className="text-[7px] font-mono text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function RpsMovesBar({ moves }: { moves: MoveCounts }) {
  const total = moves.rock + moves.paper + moves.scissors;
  if (total < 1) return null;
  const rows = [
    { key: 'rock', label: 'Rock', emoji: '✊', count: moves.rock, color: 'bg-rose-500/70' },
    { key: 'paper', label: 'Paper', emoji: '✋', count: moves.paper, color: 'bg-sky-500/70' },
    { key: 'scissors', label: 'Scissors', emoji: '✌️', count: moves.scissors, color: 'bg-amber-500/70' },
  ];
  const favorite = rows.reduce((a, b) => (b.count > a.count ? b : a));
  return (
    <div className="mt-2 pt-2 border-t border-slate-800/50">
      <div className="text-[6px] font-mono uppercase text-slate-600 mb-1">RPS tendencies · fav {favorite.emoji}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-1.5">
            <span className="text-[8px] w-4">{r.emoji}</span>
            <div className="flex-1 h-1 rounded-full bg-slate-800/80 overflow-hidden">
              <div className={`h-full rounded-full ${r.color}`} style={{ width: `${Math.round((r.count / total) * 100)}%` }} />
            </div>
            <span className="text-[7px] font-mono text-slate-500 tabular-nums w-8 text-right">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArcadeStatsPanel({
  source,
  compact = false,
  username,
  achievements = [],
  gamesState = null,
  leaderboard = null,
  showCoins = true,
  showActivityStats = true,
}: Props) {
  const summary = useMemo(() => computeArcadeSummary(source), [source]);
  const topGames = useMemo(() => rankGamesByPlayed(source, 3), [source]);
  const earnedIds = useMemo(() => new Set(achievements.map((a) => a.id)), [achievements]);
  const lbRanks = useMemo(
    () => findUserLeaderboardRanks(username ?? '', leaderboard, { showCoins, showActivityStats }),
    [username, leaderboard, showCoins, showActivityStats],
  );
  const [category, setCategory] = useState<GameCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('played');

  const games = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = GAME_CATALOG.filter((g) => {
      if (category !== 'all' && g.category !== category) return false;
      if (!q) return true;
      return g.label.toLowerCase().includes(q) || g.shortLabel.toLowerCase().includes(q) || g.id.includes(q);
    }).map((g) => {
      const gameId = g.id as GameId;
      const slice = getGameSlice(gamesState, g.id);
      const liveStats = slice?.myStats ?? null;
      const rpsMoves = liveStats && 'moves' in liveStats ? (liveStats as RpsStats).moves : null;
      return {
        catalog: g,
        stats: getGameStats(source, gameId),
        live: liveStats,
        rpsMoves,
        inQueue: Boolean(slice?.inQueue),
        nextStreakBonus: liveStats?.nextStreakBonus ?? 0,
        badges: getGameAchievementBadges(gameId, earnedIds),
        badgeCount: countEarnedGameBadges(gameId, earnedIds),
      };
    });

    const sorters: Record<SortMode, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      played: (a, b) => b.stats.games - a.stats.games,
      winrate: (a, b) => b.stats.winRate - a.stats.winRate || b.stats.games - a.stats.games,
      streak: (a, b) => b.stats.streak - a.stats.streak || b.stats.games - a.stats.games,
    };
    return [...list].sort(sorters[sort]);
  }, [source, category, search, sort, gamesState, earnedIds]);

  const playedGames = games.filter((g) => g.stats.games > 0);
  const varietyPct = Math.min(100, Math.round((summary.variety / GAME_CATALOG.length) * 100));
  const jackpot = gamesState?.jackpot;

  return (
    <section className="rounded-2xl border border-rose-500/15 bg-gradient-to-br from-rose-950/20 via-[#0c0d12] to-violet-950/15 overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-800/60 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Gamepad2 size={14} className="text-rose-300" />
          <div>
            <h3 className="text-[11px] font-semibold text-white">Arcade Career</h3>
            <p className="text-[8px] font-mono text-slate-500">
              {summary.variety}/{GAME_CATALOG.length} titles · {summary.totalGames.toLocaleString('en-US')} matches · {summary.overallWinRate}% win rate
            </p>
          </div>
        </div>
        {!compact && (
          <div className="relative ml-auto w-full sm:w-44">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter games"
              placeholder="Filter games…"
              className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-800/80 bg-black/30 text-[9px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>
        )}
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {showCoins && (
            <SummaryTile
              label="LULcoins"
              value={summary.lulCoins.toLocaleString('en-US')}
              icon={<Coins size={10} />}
              accent="text-amber-300"
              coinTile
              coinAmount={summary.lulCoins}
            />
          )}
          <SummaryTile
            label="Record"
            value={`${summary.totalWins}W · ${summary.totalLosses}L`}
            sub={summary.totalDraws > 0 ? `${summary.totalDraws} draws · ${summary.overallWinRate}%` : `${summary.overallWinRate}% win rate`}
            icon={<Trophy size={10} />}
            accent="text-emerald-300"
          />
          {showCoins && (
            <SummaryTile
              label="Net coins"
              value={`${summary.netCoins >= 0 ? '+' : ''}${summary.netCoins.toLocaleString('en-US')}`}
              sub={`+${summary.coinsWon.toLocaleString('en-US')} / -${summary.coinsLost.toLocaleString('en-US')}`}
              icon={<BarChart3 size={10} />}
              accent={summary.netCoins >= 0 ? 'text-emerald-400' : 'text-rose-400'}
            />
          )}
          <SummaryTile
            label="Streak"
            value={`${summary.currentStreak} now`}
            sub={`best ${summary.bestStreak}`}
            icon={<Flame size={10} />}
            accent="text-orange-300"
          />
          <SummaryTile
            label="Jackpots"
            value={String(summary.jackpotsWon)}
            sub={
              showCoins && jackpot
                ? `pool ${jackpot.pool.toLocaleString('en-US')} · ${jackpot.chancePercent}%`
                : undefined
            }
            icon={<Zap size={10} />}
            accent="text-amber-200"
          />
          <SummaryTile
            label="Variety"
            value={`${summary.variety}/${GAME_CATALOG.length}`}
            sub={`${varietyPct}% catalog`}
            icon={<Sparkles size={10} />}
            accent="text-violet-300"
          />
        </div>

        {!compact && varietyPct < 100 && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/15 px-3 py-2.5">
            <div className="flex justify-between text-[8px] font-mono text-slate-500 mb-1">
              <span>Arcade variety progress</span>
              <span className="text-violet-300">{summary.variety} titles tried</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400" style={{ width: `${varietyPct}%` }} />
            </div>
          </div>
        )}

        {!compact && topGames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[7px] font-mono uppercase text-slate-600 w-full">Most played</span>
            {topGames.map((g, i) => (
              <span
                key={g.gameId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800/80 bg-black/25 text-[8px] font-mono"
              >
                <span className="text-slate-600">#{i + 1}</span>
                <span>{g.icon}</span>
                <span className="text-slate-300">{g.label}</span>
                <span className="text-rose-300 font-bold tabular-nums">{g.stats.games}</span>
                <span className="text-slate-600">· {g.stats.winRate}%</span>
              </span>
            ))}
          </div>
        )}

        {!compact && lbRanks.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase text-amber-400/80 mb-2">
              <Medal size={10} /> Leaderboard ranks
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lbRanks.map((r) => (
                <span
                  key={r.category}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-amber-500/25 bg-black/20 text-[8px] font-mono"
                >
                  <span className="text-amber-300 font-bold">#{r.rank}</span>
                  <span className="text-slate-400">{r.category}</span>
                  <span className="text-slate-500 tabular-nums">({r.value})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {!compact && (
          <div className="flex flex-wrap gap-1 items-center">
            {GAME_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                aria-pressed={category === cat.id}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-mono uppercase border transition ${
                  category === cat.id
                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                    : 'border-slate-800/80 text-slate-500 hover:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
            <span className="text-[7px] font-mono text-slate-600 mx-1">sort</span>
            {(['played', 'winrate', 'streak'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSort(m)}
                aria-pressed={sort === m}
                className={`px-2 py-1 rounded-lg text-[7px] font-mono uppercase border transition ${
                  sort === m
                    ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                    : 'border-slate-800/80 text-slate-600 hover:border-slate-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {playedGames.length === 0 ? (
          <p className="text-[10px] font-mono text-slate-600 text-center py-8">
            No arcade matches yet — head to Games and place your first bet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {games.map(({ catalog: g, stats, rpsMoves, inQueue, nextStreakBonus, badges, badgeCount }) => {
              if (compact && stats.games === 0) return null;
              const inactive = stats.games === 0;
              return (
                <article
                  key={g.id}
                  className={`rounded-xl border p-3 transition ${
                    inactive
                      ? 'border-slate-800/50 bg-black/10 opacity-50'
                      : `border-slate-800/70 bg-black/20 hover:border-slate-700/80 ${g.bgClass}`
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl leading-none">{g.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-[10px] font-mono font-bold truncate ${g.accent}`}>{g.label}</h4>
                      <p className="text-[7px] font-mono text-slate-600 uppercase">{g.shortLabel} · {g.category}</p>
                    </div>
                    {stats.games > 0 && (
                      <span className="text-[9px] font-mono font-bold text-slate-400 tabular-nums">{stats.winRate}%</span>
                    )}
                  </div>
                  {stats.games > 0 ? (
                    <>
                      <div className="h-1 rounded-full bg-slate-800/80 overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/60"
                          style={{ width: `${stats.winRate}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        {[
                          { k: 'W', v: stats.wins, c: 'text-emerald-400' },
                          { k: 'L', v: stats.losses, c: 'text-rose-400' },
                          { k: 'D', v: stats.draws, c: 'text-slate-400' },
                        ].map((row) => (
                          <div key={row.k} className="rounded-lg bg-black/25 py-1">
                            <div className={`text-[11px] font-mono font-bold tabular-nums ${row.c}`}>{row.v}</div>
                            <div className="text-[6px] font-mono text-slate-600 uppercase">{row.k}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-1 text-[7px] font-mono text-slate-500">
                        <span>{stats.games} games</span>
                        <span>🔥 {stats.streak} · best {stats.bestStreak}</span>
                        {nextStreakBonus > 0 && (
                          <span className="text-amber-400/80">+{nextStreakBonus}% next win</span>
                        )}
                        {inQueue && <span className="text-cyan-400">in queue</span>}
                      </div>
                      {!compact && badges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {badges.map((b) => (
                            <span
                              key={b.id}
                              title={b.label}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[7px] font-mono ${
                                b.earned
                                  ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                                  : 'border-slate-800/60 text-slate-600 opacity-50'
                              }`}
                            >
                              <span>{b.icon}</span>
                              <span>{b.shortLabel}</span>
                            </span>
                          ))}
                          {badgeCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[7px] font-mono text-slate-600">
                              <Award size={8} /> {badgeCount}/{badges.length}
                            </span>
                          )}
                        </div>
                      )}
                      {!compact && rpsMoves && <RpsMovesBar moves={rpsMoves} />}
                    </>
                  ) : (
                    <p className="text-[8px] font-mono text-slate-600">Not played yet</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}