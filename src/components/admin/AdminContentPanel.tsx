/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Eye, FileText, Newspaper, RefreshCw } from 'lucide-react';
import { fetchContentAnalytics, type ContentAnalytics } from '../../lib/adminModules';
import { ToolCard } from '../pages/PageShell';

function ViewBar({ label, views, max }: { label: string; views: number; max: number }) {
  const pct = max > 0 ? Math.round((views / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[8px] font-mono">
        <span className="text-slate-400 truncate pr-2" title={label}>{label}</span>
        <span className="text-cyan-300 tabular-nums shrink-0">{views.toLocaleString('en-US')}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-cyan-500/60 transition-all"
          style={{ width: `${Math.max(pct, views > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export function AdminContentPanel() {
  const [data, setData] = useState<ContentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    setLoading(true);
    try {
      const next = await fetchContentAnalytics();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(next);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxChangelog = data?.postViews.changelog[0]?.views ?? 1;
  const maxNews = data?.postViews.news[0]?.views ?? 1;
  const maxPage = data?.pageViews.pages[0]?.views ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500 max-w-xl">
          Content Analytics — changelog, news & page-view rankings from tracking stores.
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Changelog views', value: data.postViews.changelogTotal, icon: FileText, accent: 'text-violet-300' },
              { label: 'News views', value: data.postViews.newsTotal, icon: Newspaper, accent: 'text-cyan-300' },
              { label: 'Page views', value: data.pageViews.total, icon: Eye, accent: 'text-emerald-300' },
              { label: 'Tracked pages', value: data.pageViews.pages.length, icon: BarChart3, accent: 'text-amber-300' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-800/80 bg-black/30 px-3 py-2.5 flex items-center gap-2">
                <s.icon size={14} className={`${s.accent} shrink-0`} />
                <div>
                  <div className="text-[7px] font-mono uppercase text-slate-600">{s.label}</div>
                  <div className={`text-base font-mono font-bold ${s.accent}`}>{s.value.toLocaleString('en-US')}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <ToolCard title="Changelog" icon="📜" accent="violet">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.postViews.changelog.slice(0, 20).map((e) => (
                  <div key={e.id}><ViewBar label={`v${e.id}`} views={e.views} max={maxChangelog} /></div>
                ))}
                {!data.postViews.changelog.length && (
                  <p className="text-[9px] font-mono text-slate-600 text-center py-4">No changelog views yet — opens appear after members read releases.</p>
                )}
              </div>
            </ToolCard>

            <ToolCard title="News" icon="📰" accent="cyan">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.postViews.news.slice(0, 20).map((e) => (
                  <div key={e.id}><ViewBar label={e.id} views={e.views} max={maxNews} /></div>
                ))}
                {!data.postViews.news.length && (
                  <p className="text-[9px] font-mono text-slate-600 text-center py-4">No news views yet — wire articles need reads first.</p>
                )}
              </div>
            </ToolCard>

            <ToolCard title="Pages" icon="📄" accent="emerald">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.pageViews.pages.slice(0, 20).map((e) => (
                  <div key={e.pageId}><ViewBar label={e.pageId} views={e.views} max={maxPage} /></div>
                ))}
                {!data.pageViews.pages.length && (
                  <p className="text-[9px] font-mono text-slate-600 text-center py-4">No page views yet — traffic shows up after navigation.</p>
                )}
              </div>
            </ToolCard>
          </div>
        </>
      )}
    </div>
  );
}