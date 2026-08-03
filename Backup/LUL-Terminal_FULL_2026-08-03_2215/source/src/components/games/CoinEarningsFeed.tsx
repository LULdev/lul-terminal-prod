/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import {
  COIN_FEED_KIND_STYLES,
  fetchCoinFeed,
  formatCoinFeedTime,
  type CoinFeedEntry,
  type CoinFeedKind,
} from '../../lib/coinFeed';
import { LulCoinAmount } from './LulCoinAmount';

type FilterKind = 'all' | CoinFeedKind;

const FILTER_TABS: { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'game_win', label: 'Wins' },
  { id: 'achievement', label: 'Badges' },
  { id: 'jackpot', label: 'Jackpot' },
  { id: 'daily_bonus', label: 'Daily' },
];

function resolveLabel(entry: CoinFeedEntry): string {
  if (entry.kind === 'achievement' && entry.meta?.achievementId) {
    const def = ACHIEVEMENT_BY_ID[entry.meta.achievementId];
    if (def) return def.name;
  }
  return entry.label;
}

function kindLabel(kind: string): string {
  if (kind === 'game_win') return 'Win';
  if (kind === 'streak_bonus') return 'Streak';
  if (kind === 'draw_refund') return 'Refund';
  if (kind === 'daily_bonus') return 'Daily';
  if (kind === 'achievement') return 'Badge';
  if (kind === 'jackpot') return 'Jackpot';
  return 'Credit';
}

type Props = {
  compact?: boolean;
  refreshKey?: number;
  className?: string;
};

export function CoinEarningsFeed({ compact = false, refreshKey = 0, className = '' }: Props) {
  const { isLoggedIn } = useAuth();
  const [feed, setFeed] = useState<Awaited<ReturnType<typeof fetchCoinFeed>> | null>(null);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!isLoggedIn) return;
    const gen = ++loadGenRef.current;
    try {
      const data = await fetchCoinFeed(compact ? 20 : 40);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setFeed(data);
      setErr('');
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [compact, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setFeed(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const tick = () => {
      if (document.hidden) return;
      void load();
    };
    tick();
    const t = setInterval(tick, 30_000);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, refreshKey, isLoggedIn]);

  const items = useMemo(() => {
    const list = feed?.items ?? [];
    if (filter === 'all') return list;
    if (filter === 'jackpot') return list.filter((e) => e.kind === 'jackpot' || e.kind === 'streak_bonus');
    return list.filter((e) => e.kind === filter);
  }, [feed?.items, filter]);

  return (
    <section className={`lul-coin-feed-panel rounded-2xl border overflow-hidden ${className}`}>
      <header className="px-4 py-3 border-b border-slate-800/60 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="lul-coin-feed-header-icon h-8 w-8 rounded-xl border flex items-center justify-center shrink-0">
            <TrendingUp size={14} className="text-amber-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[11px] font-semibold text-amber-100">Coin Earnings Feed</h3>
            <p className="text-[8px] font-mono text-slate-500 truncate">
              Recent <span className="lul-coin-label lul-coin-label--sm inline">LULcoin</span> credits · wins, badges & bonuses
            </p>
          </div>
        </div>
        {!compact && feed && (
          <div className="ml-auto text-right shrink-0">
            <div className="text-[8px] font-mono uppercase text-slate-600">Shown total</div>
            <LulCoinAmount amount={feed.recentEarned} variant="earn" size="md" suffix={false} className="lul-coin-feed-total" />
          </div>
        )}
        <button
          type="button"
          onClick={() => { if (!isLoggedIn) return; setLoading(true); void load(); }}
          className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition"
          title="Refresh feed"
          aria-label="Refresh coin earnings feed"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {!compact && (
        <div className="px-4 py-2 flex flex-wrap gap-1 border-b border-slate-800/40">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={`px-2 py-1 rounded-lg text-[8px] font-mono uppercase border transition ${
                filter === tab.id
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                  : 'border-slate-800/80 text-slate-500 hover:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className={`coin-feed-list divide-y divide-slate-800/40 ${compact ? 'max-h-52' : 'max-h-80'} overflow-y-auto`}>
        {loading && !feed?.items.length ? (
          <p className="text-[10px] font-mono text-slate-600 text-center py-10">
            <RefreshCw size={12} className="inline animate-spin mr-1" /> Loading earnings…
          </p>
        ) : err ? (
          <p className="text-[10px] font-mono text-rose-400 text-center py-8">{err}</p>
        ) : !items.length ? (
          <div className="text-center py-10 px-4">
            <Sparkles size={20} className="mx-auto text-slate-600 mb-2 opacity-60" />
            <p className="text-[10px] font-mono text-slate-500">No earnings yet</p>
            <p className="text-[8px] font-mono text-slate-600 mt-1">Win arcade matches or unlock achievements</p>
          </div>
        ) : (
          items.map((entry) => {
            const style = COIN_FEED_KIND_STYLES[entry.kind] ?? COIN_FEED_KIND_STYLES.game_win;
            const title = resolveLabel(entry);
            return (
              <article
                key={entry.id}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition coin-feed-row"
              >
                <div className="h-9 w-9 rounded-xl border border-slate-800/80 bg-black/30 flex items-center justify-center text-lg shrink-0">
                  {entry.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] font-medium text-slate-200 truncate">{title}</p>
                    <span className={style.chip}>
                      {kindLabel(entry.kind)}
                    </span>
                  </div>
                  <p className="text-[8px] font-mono text-slate-600 mt-0.5">
                    {formatCoinFeedTime(entry.at)}
                    {entry.meta?.bet ? (
                      <> · bet <LulCoinAmount amount={entry.meta.bet} variant="bet" size="xs" suffix="LUL" /></>
                    ) : null}
                  </p>
                </div>
                <span className={`lul-coin-amount lul-coin-amount--md text-right shrink-0 ${style.amount}`}>
                  +{entry.amount.toLocaleString('en-US')}
                </span>
              </article>
            );
          })
        )}
      </div>

      {feed?.balance != null && (
        <footer className="lul-coin-balance-footer px-4 py-2 border-t border-slate-800/50 flex items-center justify-between text-[8px] font-mono">
          <span className="flex items-center gap-1.5">
            <Coins size={10} />
            Balance <LulCoinAmount amount={feed.balance} variant="balance" size="xs" suffix="LUL" />
          </span>
          <span>{feed.totalShown} entries</span>
        </footer>
      )}
    </section>
  );
}