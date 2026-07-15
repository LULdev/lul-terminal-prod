/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Globe, Play, Plus, Trash2 } from 'lucide-react';
import {
  addProxySource,
  deleteProxySource,
  fetchProxyResults,
  fetchProxySources,
  fetchProxyStats,
  pollJob,
  startScrapeJob,
  type ProxySource,
  type ProxyStats,
  type SourceScrapeResult,
} from '../../lib/proxyScraper';
import { AdminCustomProxiesPanel } from './AdminCustomProxiesPanel';
import { ActionButton, ToolCard } from '../pages/PageShell';

type AdminProxyScraperPanelProps = {
  onScrapeSuccess?: () => void;
  onGoToChecker?: () => void;
  scrapeReady?: boolean;
};

export function AdminProxyScraperPanel({ onScrapeSuccess, onGoToChecker, scrapeReady }: AdminProxyScraperPanelProps = {}) {
  const [sources, setSources] = useState<ProxySource[]>([]);
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [poolCount, setPoolCount] = useState(0);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [customCount, setCustomCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [oneOffUrls, setOneOffUrls] = useState('');
  const [topSources, setTopSources] = useState<SourceScrapeResult[]>([]);
  const jobAbortRef = useRef<AbortController | null>(null);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      jobAbortRef.current?.abort();
    };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const [src, s, res] = await Promise.all([
      fetchProxySources(),
      fetchProxyStats().catch(() => null),
      fetchProxyResults(),
    ]);
    if (gen !== loadGenRef.current || !mountedRef.current) return;
    setSources(src);
    if (s) setStats(s);
    setPoolCount(res.poolCount ?? res.proxies?.length ?? 0);
    setScrapedCount(res.scrapedCount ?? res.proxies?.length ?? 0);
    setCustomCount(res.customCount ?? 0);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runScrape = async () => {
    setBusy(true);
    setMsg('Scrape starting…');
    setLogs([]);
    try {
      const customUrls = oneOffUrls
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('http'));
      jobAbortRef.current?.abort();
      const abort = new AbortController();
      jobAbortRef.current = abort;
      const jobId = await startScrapeJob({ customUrls: customUrls.length ? customUrls : undefined });
      const finalJob = await pollJob(jobId, (job) => {
        if (!mountedRef.current) return;
        setMsg(job.message);
        if (job.logs?.length) setLogs(job.logs.slice(-20));
      }, 800, { signal: abort.signal });
      const results = finalJob.result?.sourceResults ?? [];
      setTopSources(
        [...results]
          .filter((s) => s.ok && s.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
      );
      await load();
      setMsg('Scrape complete — pool ready for checker');
      onScrapeSuccess?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setMsg(e instanceof Error ? e.message : 'Scrape failed');
    } finally {
      setBusy(false);
    }
  };

  const addSource = async () => {
    if (!customUrl.trim()) return;
    setMsg('');
    try {
      await addProxySource({ name: customName || 'Custom Source', url: customUrl.trim(), type: 'http', repo: 'custom' });
      setCustomUrl('');
      setCustomName('');
      await load();
      setMsg('Source saved');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const removeSource = async (id: string) => {
    if (!confirm('Really delete source?')) return;
    try {
      await deleteProxySource(id);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <ToolCard title="Proxy Scraper (Admin)" icon="🕸️" accent="teal">
        <p className="text-[9px] font-mono text-slate-500 mb-3 leading-relaxed">
          Deep-scrape: site adapters · link discovery · GitHub raw · API pagination · script JSON · HTML tables — parallel from{' '}
          <strong className="text-teal-300">{sources.length}+</strong> sources. Pool → <strong className="text-indigo-300">Proxy Checker</strong>.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          <MiniStat label="Sources" value={String(sources.length)} />
          <MiniStat label="Total pool" value={poolCount.toLocaleString('en-US')} accent="text-teal-300" />
          <MiniStat label="Scraped" value={scrapedCount.toLocaleString('en-US')} />
          <MiniStat label="Custom" value={customCount.toLocaleString('en-US')} accent="text-emerald-300" />
          <MiniStat label="OK / Fail" value={`${stats?.sourcesOk ?? 0} / ${stats?.sourcesFailed ?? 0}`} />
        </div>

        {msg && <p className="text-[10px] font-mono text-teal-300 mb-2">{msg}</p>}

        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <ActionButton onClick={runScrape} variant="indigo" disabled={busy}>
            <Play size={12} className="inline mr-1" />
            {busy ? 'Scraping…' : 'Scrape all sources'}
          </ActionButton>
          {onGoToChecker && (
            <button
              type="button"
              onClick={onGoToChecker}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono transition-all ${
                scrapeReady
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                  : 'border-slate-800 text-slate-500 hover:text-teal-300 hover:border-teal-500/30'
              }`}
            >
              Go to checker
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        <label className="block mb-3">
          <span className="text-[8px] font-mono text-slate-500 uppercase">One-off custom URLs (one per line, optional)</span>
          <textarea
            value={oneOffUrls}
            onChange={(e) => setOneOffUrls(e.target.value)}
            rows={3}
            placeholder="https://example.com/proxies.txt"
            className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-300"
          />
        </label>

        {logs.length > 0 && (
          <div className="rounded-lg border border-slate-800 bg-black/30 p-2 max-h-28 overflow-y-auto mb-3">
            {logs.map((l, i) => (
              <div key={`${l}-${i}`} className="text-[8px] font-mono text-slate-500">{l}</div>
            ))}
          </div>
        )}

        {topSources.length > 0 && (
          <div className="rounded-xl border border-teal-500/15 bg-teal-500/5 p-3 mb-1">
            <div className="text-[8px] font-mono text-teal-300/80 uppercase mb-2">Top sources (last scrape)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {topSources.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-black/25 border border-slate-800/60">
                  <span className="text-[8px] font-mono text-slate-400 truncate">{s.name}</span>
                  <span className="text-[8px] font-mono text-teal-300 shrink-0">
                    {s.count.toLocaleString('en-US')}
                    {s.format ? ` · ${s.format}` : ''}
                    {s.discovered ? ` · +${s.discovered}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ToolCard>

      <AdminCustomProxiesPanel
        onAdded={() => {
          load();
          onScrapeSuccess?.();
        }}
        onGoToChecker={onGoToChecker}
      />

      <ToolCard title="Manage sources" icon="🔗" accent="cyan">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name"
            className="bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
          />
          <input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://…"
            className="sm:col-span-2 bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
          />
        </div>
        <button
          type="button"
          onClick={addSource}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 text-cyan-200 text-[10px] font-mono mb-3"
        >
          <Plus size={12} /> Add source permanently
        </button>

        <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-800/80 bg-black/20">
              <Globe size={12} className="text-slate-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-slate-300 truncate">{s.name}</div>
                <div className="text-[8px] font-mono text-slate-600 truncate">{s.url}</div>
              </div>
              {s.repo === 'custom' && (
                <button type="button" onClick={() => removeSource(s.id)} className="p-1 text-slate-600 hover:text-rose-400">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </ToolCard>
    </div>
  );
}

function MiniStat({ label, value, accent = 'text-slate-300' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-black/25 px-2 py-2">
      <div className="text-[7px] font-mono text-slate-600 uppercase">{label}</div>
      <div className={`text-[11px] font-mono tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}