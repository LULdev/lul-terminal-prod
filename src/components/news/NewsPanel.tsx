/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  LayoutGrid,
  List,
  Newspaper,
  Radio,
  RefreshCw,
  Rss,
  Search,
} from 'lucide-react';
import { fetchNewsFeed } from '../../lib/news';
import type { NewsArticle } from '../../types/news';
import { PostViewTracker } from '../feeds/PostViewTracker';
import { usePostViews } from '../../hooks/usePostViews';
import { useAuth } from '../../context/AuthContext';
import { markNewsVisited } from '../../hooks/useFeedUnread';
import type { TabId } from '../../config/menuItems';
import { NewsArticleCard } from './NewsArticleCard';
import { NewsPagination } from './NewsPagination';

const PAGE_SIZE = 6;

type LayoutMode = 'list' | 'grid';
type FilterMode = 'all' | 'breaking';

function NewsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-44 rounded-2xl bg-slate-800/30 border border-slate-800/50" />
      <div className="h-28 rounded-xl bg-slate-800/25 border border-slate-800/40" />
      <div className="h-28 rounded-xl bg-slate-800/25 border border-slate-800/40" />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-black/30 px-3 py-2">
      <div className="text-[8px] font-mono text-slate-600 uppercase tracking-wider">{label}</div>
      <div className="text-[11px] font-mono text-slate-300 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

type NewsPanelProps = {
  isActive?: boolean;
  /** Global feed version from useFeedUnread — triggers soft refresh while tab is open. */
  liveFeedVersion?: string;
  onNavigateTab?: (tab: TabId, opts?: { profileUsername?: string }) => void;
};

export const NewsPanel = memo(function NewsPanel({ isActive = true, liveFeedVersion, onNavigateTab }: NewsPanelProps) {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [feedVersion, setFeedVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [softError, setSoftError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [layout, setLayout] = useState<LayoutMode>('list');
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);
  const visitMarkedOnEntryRef = useRef(false);
  const lastActiveRef = useRef(false);
  const { views, registerView } = usePostViews('news', { enabled: isActive && isLoggedIn });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const gen = ++loadGenRef.current;
    if (!opts?.soft) setError('');
    else setSoftError('');
    if (opts?.soft) setRefreshing(true);
    try {
      const data = await fetchNewsFeed();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setArticles(data.articles);
      setFeedVersion(data.feedVersion);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      const msg = e instanceof Error ? e.message : 'Failed to load news';
      if (!opts?.soft) {
        setArticles([]);
        setError(msg);
      } else {
        setSoftError(msg);
      }
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      lastActiveRef.current = false;
      visitMarkedOnEntryRef.current = false;
      return;
    }
    const revisiting = lastActiveRef.current;
    lastActiveRef.current = true;
    if (revisiting) {
      load({ soft: true });
      return;
    }
    load();
  }, [isActive, load]);

  useEffect(() => {
    if (!isActive) {
      visitMarkedOnEntryRef.current = false;
      return;
    }
    if (authLoading || !feedVersion) return;
    if (!isLoggedIn) {
      markNewsVisited(false, feedVersion);
      return;
    }
    if (visitMarkedOnEntryRef.current) return;
    visitMarkedOnEntryRef.current = true;
    markNewsVisited(isLoggedIn, feedVersion);
  }, [isActive, isLoggedIn, authLoading, feedVersion]);

  const lastLiveVersionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActive || !liveFeedVersion || liveFeedVersion === '0.0.0') return;
    if (lastLiveVersionRef.current && lastLiveVersionRef.current !== liveFeedVersion) {
      load({ soft: true });
      if (!isLoggedIn) markNewsVisited(false, liveFeedVersion);
    }
    lastLiveVersionRef.current = liveFeedVersion;
  }, [isActive, isLoggedIn, liveFeedVersion, load]);

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category));
    return [...set];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (filter === 'breaking' && !a.highlight) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.authorName.toLowerCase().includes(q)
      );
    });
  }, [articles, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filtered, safePage],
  );

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, next));
      setPage(clamped);
      requestAnimationFrame(() => {
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [pageCount],
  );

  useEffect(() => {
    setPage(0);
  }, [query, filter]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  useEffect(() => {
    if (!isActive || pageCount <= 1) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(safePage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(safePage + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToPage, isActive, pageCount, safePage]);

  const paginationProps = {
    page: safePage,
    pageCount,
    pageSize: PAGE_SIZE,
    total: filtered.length,
    rangeFrom: paged[0]?.title,
    rangeTo: paged[paged.length - 1]?.title,
    onPageChange: goToPage,
  };

  const totalViews = useMemo(
    () => articles.reduce((sum, a) => sum + (views[a.id] ?? 0), 0),
    [articles, views],
  );

  const refresh = () => {
    load({ soft: true });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full" id="news-module">
      <div className="shrink-0 mb-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-[#0c0d12] to-slate-950/30 p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 relative">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10">
              <Newspaper className="text-indigo-300" size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-lg sm:text-xl font-semibold text-white font-sans">LUL Wire</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-widest text-emerald-300 border border-emerald-500/30 bg-emerald-500/10">
                  <Rss size={9} />
                  Live Feed
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed max-w-xl">
                Official terminal bulletins, system alerts, and community updates.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700/80 bg-black/30 text-[10px] font-mono text-slate-400 hover:text-indigo-300 hover:border-indigo-500/35 transition-all shrink-0"
          >
            <RefreshCw size={12} className={loading || refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <StatPill label="Articles" value={String(articles.length)} />
          <StatPill label="Shown" value={String(filtered.length)} />
          <StatPill label="Total views" value={totalViews.toLocaleString('en-US')} />
          <StatPill label="Feed" value={feedVersion ? `v${feedVersion.slice(0, 10)}` : '—'} />
        </div>
      </div>

      <div className="shrink-0 flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={13} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bulletins…"
            className="w-full pl-9 pr-3 py-2.5 bg-[#0b0c10] border border-slate-800 rounded-xl text-[11px] font-mono text-slate-200 focus:border-indigo-500/40 focus:outline-none"
          />
        </div>
        <div className="flex rounded-xl border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-2 text-[9px] font-mono transition-colors ${
              filter === 'all' ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('breaking')}
            className={`px-3 py-2 text-[9px] font-mono flex items-center gap-1 transition-colors ${
              filter === 'breaking' ? 'bg-rose-500/15 text-rose-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Radio size={10} />
            Breaking
          </button>
        </div>
        <div className="flex rounded-xl border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setLayout('list')}
            title="List"
            className={`p-2 transition-colors ${
              layout === 'list' ? 'bg-slate-800/60 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => setLayout('grid')}
            title="Grid"
            className={`p-2 transition-colors ${
              layout === 'grid' ? 'bg-slate-800/60 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 mb-3 flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-950/20 px-3 py-2">
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <p className="text-[10px] font-mono text-rose-300">{error}</p>
        </div>
      )}

      {softError && !error && (
        <div className="shrink-0 mb-3 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-[10px] font-mono text-amber-300">{softError}</p>
        </div>
      )}

      {categories.length > 0 && (
        <div className="shrink-0 mb-3 flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const count = articles.filter((a) => a.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setQuery(cat)}
                className="px-2 py-1 rounded-lg border border-slate-800 bg-black/25 text-[8px] font-mono text-slate-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors"
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto pr-1" id="news-list" ref={listRef}>
        {loading && articles.length === 0 && <NewsSkeleton />}

        {!loading && filtered.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-center mb-3">
              <Newspaper size={24} className="text-slate-600" />
            </div>
            <p className="text-[11px] font-mono text-slate-500">
              {query || filter === 'breaking' ? 'No matches for your filters' : 'No bulletins published yet'}
            </p>
          </div>
        )}

        {pageCount > 1 && filtered.length > 0 && (
          <div className="mb-4">
            <NewsPagination {...paginationProps} />
          </div>
        )}

        <div className="space-y-4 pb-2">
          {paged.length > 0 && (
            <div className={layout === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
              {paged.map((item, idx) => {
                const useFeatured = safePage === 0 && idx === 0 && item.highlight;
                const variant = useFeatured ? 'featured' : layout === 'grid' ? 'compact' : 'standard';
                return (
                  <React.Fragment key={item.id}>
                    <PostViewTracker
                      postId={item.id}
                      views={views[item.id] ?? 0}
                      onView={registerView}
                      enabled={isActive}
                      hideFooter
                    >
                      <NewsArticleCard article={item} variant={variant} views={views[item.id] ?? 0} onNavigateTab={onNavigateTab} />
                    </PostViewTracker>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {pageCount > 1 && filtered.length > 0 && (
          <div className="mt-4 pb-2">
            <NewsPagination {...paginationProps} />
          </div>
        )}
      </div>
    </div>
  );
});