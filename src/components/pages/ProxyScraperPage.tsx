/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from './PageShell';
import {
  exportTxt,
  fetchProxyResults,
  fetchProxySources,
  fetchProxyStats,
  formatProxyUrl,
  pollJob,
  startScrapeJob,
  type CheckedProxy,
  type ProxySource,
  type ProxyStats,
  type ProxyType,
} from '../../lib/proxyScraper';
import { fetchCheckerResults, pollCheckerJob, startCheckJob } from '../../lib/proxyChecker';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';

const TYPE_COLORS: Record<ProxyType, string> = {
  http: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  https: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  socks4: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
  socks5: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
};

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className={`rounded-xl border px-3 py-3 flex flex-col gap-0.5 ${accent}`}>
      <span className="text-[8px] font-mono uppercase tracking-widest opacity-70">{label}</span>
      <span className="text-xl font-mono font-bold tabular-nums leading-none">{typeof value === 'number' ? value.toLocaleString('en-US') : value}</span>
      {sub && <span className="text-[8px] font-mono opacity-60">{sub}</span>}
    </div>
  );
}

export function ProxyScraperPage() {
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [sources, setSources] = useState<ProxySource[]>([]);
  const [checked, setChecked] = useState<CheckedProxy[]>([]);
  const [busy, setBusy] = useState(false);
  const [jobMsg, setJobMsg] = useState('');
  const [jobProgress, setJobProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<ProxyType | 'all'>('all');
  const [aliveOnly, setAliveOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [concurrency, setConcurrency] = useState(50);
  const [checkLimit, setCheckLimit] = useState(600);
  const [copied, setCopied] = useState(false);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);
  const jobAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      jobAbortRef.current?.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const [s, src, res] = await Promise.all([
      fetchProxyStats().catch(() => null),
      fetchProxySources(),
      fetchProxyResults(),
    ]);
    if (gen !== loadGenRef.current || !mountedRef.current) return;
    if (s) setStats(s);
    setSources(src);
    setChecked(res.checked ?? []);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useVisibilityAwarePoll(() => { void refresh(); }, 12_000);

  const runJob = async (kind: 'scrape' | 'check' | 'scrape-and-check') => {
    jobAbortRef.current?.abort();
    const abort = new AbortController();
    jobAbortRef.current = abort;
    setBusy(true);
    setJobProgress(0);
    setLogs([]);
    setJobMsg('Starting…');
    try {
      if (kind === 'scrape' || kind === 'scrape-and-check') {
        const scrapeId = await startScrapeJob();
        await pollJob(scrapeId, (job) => {
          if (!mountedRef.current) return;
          setJobMsg(job.message);
          setJobProgress(job.total ? Math.round((job.progress / Math.max(job.total, 1)) * 100) : job.progress);
          if (job.logs?.length) setLogs(job.logs.slice(-12));
        }, 800, { signal: abort.signal });
        await refresh();
      }
      if (kind === 'check' || kind === 'scrape-and-check') {
        const checkId = await startCheckJob({
          useScraped: true,
          timeoutMs,
          concurrency,
          limit: checkLimit > 0 ? checkLimit : undefined,
        });
        await pollCheckerJob(checkId, (job) => {
          if (!mountedRef.current) return;
          setJobMsg(job.message);
          setJobProgress(job.total ? Math.round((job.progress / Math.max(job.total, 1)) * 100) : job.progress);
          if (job.logs?.length) setLogs(job.logs.slice(-12));
        }, 800, { signal: abort.signal });
        const checkerRes = await fetchCheckerResults();
        if (mountedRef.current) setChecked(checkerRes.checked ?? []);
        await refresh();
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (mountedRef.current) setJobMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim();
    return checked.filter((p) => {
      if (aliveOnly && !p.alive) return false;
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (q && !p.raw.includes(q) && !p.host.includes(q)) return false;
      return true;
    });
  }, [checked, aliveOnly, filterType, search]);

  const copyAlive = async () => {
    const txt = exportTxt(checked, true);
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = (alive: boolean) => {
    const blob = new Blob([exportTxt(checked, alive)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = alive ? 'proxies-working.txt' : 'proxies-all.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const aliveCount = checked.filter((p) => p.alive).length;

  return (
    <PageShell
      id="proxyscraper-module"
      pageId="proxyscraper"
      icon="🕸️"
      title="Proxy Scraper"
      subtitle={`${sources.length || 140} persisted sources · Scrape · Dedup · Live check`}
      accentClass="text-teal-400"
    >
      <div className="flex flex-col gap-4 min-h-0">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatCard label="Sources" value={stats?.sourceCount ?? sources.length} accent="border-slate-700/60 bg-[#12151c]/80 text-slate-300" />
          <StatCard label="Scraped" value={stats?.uniqueProxies ?? 0} sub="unique" accent="border-teal-500/25 bg-teal-500/5 text-teal-300" />
          <StatCard label="Working" value={stats?.alive ?? aliveCount} accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" />
          <StatCard label="Dead" value={stats?.dead ?? 0} accent="border-rose-500/25 bg-rose-500/5 text-rose-300" />
          <StatCard label="Avg latency" value={stats?.avgLatency ? `${stats.avgLatency}ms` : '—'} accent="border-violet-500/25 bg-violet-500/5 text-violet-300" />
          <StatCard label="Sources OK" value={stats?.sourcesOk ?? '—'} sub={stats?.sourcesFailed ? `${stats.sourcesFailed} fail` : undefined} accent="border-cyan-500/25 bg-cyan-500/5 text-cyan-300" />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" disabled={busy} onClick={() => runJob('scrape')}
            className="text-[10px] font-mono px-4 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/15 text-teal-200 hover:bg-teal-500/25 disabled:opacity-40 min-h-[38px]">
            📥 Scrape All
          </button>
          <button type="button" disabled={busy || checked.length === 0} onClick={() => runJob('check')}
            className="text-[10px] font-mono px-4 py-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40 min-h-[38px]">
            ✓ Check Proxies
          </button>
          <button type="button" disabled={busy} onClick={() => runJob('scrape-and-check')}
            className="text-[10px] font-mono px-4 py-2.5 rounded-lg border border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 disabled:opacity-40 min-h-[38px]">
            ⚡ Scrape + Check
          </button>
          <button type="button" disabled={aliveCount === 0} onClick={copyAlive}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white ml-auto">
            {copied ? '✓ Copied' : '📋 Copy Working'}
          </button>
          <button type="button" disabled={checked.length === 0} onClick={() => downloadTxt(true)}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white">
            ⬇ TXT
          </button>
          <button type="button" onClick={() => setShowSources((v) => !v)}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-500 hover:text-teal-300">
            {showSources ? '▾' : '▸'} {sources.length} Sources
          </button>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-slate-800/80 bg-[#0b0c10]/60 text-[9px] font-mono">
          <label className="flex flex-col gap-1 text-slate-500">
            Timeout · {timeoutMs}ms
            <input type="range" min={2000} max={12000} step={500} value={timeoutMs} onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))} className="accent-teal-400" />
          </label>
          <label className="flex flex-col gap-1 text-slate-500">
            Concurrency · {concurrency}
            <input type="range" min={10} max={100} value={concurrency} onChange={(e) => setConcurrency(parseInt(e.target.value, 10))} className="accent-teal-400" />
          </label>
          <label className="flex flex-col gap-1 text-slate-500">
            Check Limit · {checkLimit}
            <input type="range" min={100} max={2000} step={100} value={checkLimit} onChange={(e) => setCheckLimit(parseInt(e.target.value, 10))} className="accent-teal-400" />
          </label>
        </div>

        {/* Progress */}
        {(busy || jobMsg) && (
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
            <div className="flex justify-between text-[10px] font-mono text-teal-200 mb-2">
              <span>{jobMsg}</span>
              {busy && <span className="animate-pulse">Running…</span>}
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300" style={{ width: `${jobProgress}%` }} />
            </div>
            {logs.length > 0 && (
              <div className="mt-2 max-h-[72px] overflow-y-auto text-[8px] font-mono text-slate-500 space-y-0.5">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Sources panel */}
        {showSources && (
          <div className="max-h-[140px] overflow-y-auto rounded-xl border border-slate-800 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[8px] font-mono text-slate-500">
            {sources.map((s) => (
              <div key={s.id} className="flex gap-2 items-center truncate px-1 py-0.5 hover:bg-slate-800/40 rounded">
                <span className={`shrink-0 px-1 rounded border text-[7px] ${TYPE_COLORS[s.type]}`}>{s.type}</span>
                <span className="truncate text-slate-400">{s.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search IP…"
            className="flex-1 min-w-[140px] bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-200 focus:border-teal-500/50 focus:outline-none" />
          <div className="flex gap-1 flex-wrap">
            {(['all', 'http', 'https', 'socks4', 'socks5'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setFilterType(t)}
                className={`px-2 py-1 rounded border text-[9px] font-mono ${filterType === t ? 'border-teal-500/50 text-teal-300 bg-teal-500/10' : 'border-slate-800 text-slate-500'}`}>
                {t}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAliveOnly((v) => !v)}
            className={`px-2 py-1 rounded border text-[9px] font-mono ${aliveOnly ? 'border-emerald-500/50 text-emerald-300' : 'border-slate-800 text-slate-500'}`}>
            {aliveOnly ? '✓ Working only' : 'All statuses'}
          </button>
          <span className="text-[9px] font-mono text-slate-600">{filtered.length} shown</span>
        </div>

        {/* Results table */}
        <div className="flex-1 min-h-[200px] max-h-[320px] overflow-y-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-[9px] font-mono">
            <thead className="sticky top-0 bg-[#12151c] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Proxy</th>
                <th className="text-left p-2">Type</th>
                <th className="text-right p-2">Latency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-600">No results yet — run Scrape + Check</td></tr>
              )}
              {filtered.slice(0, 500).map((p) => (
                <tr key={`${p.type}-${p.raw}`} className="border-t border-slate-800/50 hover:bg-slate-800/20">
                  <td className="p-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.alive ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500/60'}`} />
                  </td>
                  <td className="p-2 text-slate-300">{formatProxyUrl(p)}</td>
                  <td className="p-2"><span className={`px-1.5 py-0.5 rounded border text-[8px] ${TYPE_COLORS[p.type]}`}>{p.type}</span></td>
                  <td className="p-2 text-right text-slate-400">{p.alive && p.latency != null ? `${p.latency}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}