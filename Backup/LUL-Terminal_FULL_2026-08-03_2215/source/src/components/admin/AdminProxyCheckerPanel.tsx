/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Database,
  Download,
  Gauge,
  Globe2,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Square,
  XCircle,
  Zap,
} from 'lucide-react';
import { detectProxyPaste } from '../../lib/proxyParse';
import { fetchProxyResults, type ProxyType } from '../../lib/proxyScraper';
import {
  cancelCheckerJob,
  exportCheckedCsv,
  exportCheckedJson,
  exportCheckedTxt,
  fetchCheckerResults,
  fetchCheckerStats,
  fetchTestUrlPresets,
  formatEta,
  pollCheckerJob,
  startCheckJob,
  type CheckerStats,
  type ExtendedCheckedProxy,
} from '../../lib/proxyChecker';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { ActionButton, ToolCard } from '../pages/PageShell';

const TYPE_COLORS: Record<ProxyType, string> = {
  http: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  https: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  socks4: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
  socks5: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
};

const ANON_COLORS: Record<string, string> = {
  elite: 'text-emerald-300',
  anonymous: 'text-amber-300',
  transparent: 'text-rose-300',
  unknown: 'text-slate-500',
  dead: 'text-slate-600',
};

const LATENCY_COLORS: Record<string, string> = {
  fast: 'text-emerald-400',
  medium: 'text-amber-300',
  slow: 'text-orange-400',
  dead: 'text-slate-600',
};

const PROFILES = {
  fast: { label: 'Fast', timeoutMs: 3500, concurrency: 120, retries: 0, detectAnonymity: false, testHttps: false },
  standard: { label: 'Standard', timeoutMs: 5000, concurrency: 80, retries: 1, detectAnonymity: true, testHttps: true },
  deep: { label: 'Thorough', timeoutMs: 8000, concurrency: 50, retries: 2, detectAnonymity: true, testHttps: true },
} as const;

type InputMode = 'scraped' | 'paste';
type ViewTab = 'all' | 'working' | 'dead';
type SortKey = 'latency' | 'type' | 'status';
type AnonFilter = 'all' | 'elite' | 'anonymous' | 'transparent';
type LatencyFilter = 'all' | 'fast' | 'medium' | 'slow';

type AdminProxyCheckerPanelProps = {
  onGoToScraper?: () => void;
};

export function AdminProxyCheckerPanel({ onGoToScraper }: AdminProxyCheckerPanelProps = {}) {
  const [stats, setStats] = useState<CheckerStats | null>(null);
  const [checked, setChecked] = useState<ExtendedCheckedProxy[]>([]);
  const [poolCount, setPoolCount] = useState(0);
  const [customCount, setCustomCount] = useState(0);
  const [presets, setPresets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [liveAlive, setLiveAlive] = useState(0);
  const [liveRecovered, setLiveRecovered] = useState(0);
  const [liveEta, setLiveEta] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobAbortRef = useRef<AbortController | null>(null);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      jobAbortRef.current?.abort();
    };
  }, []);
  const [inputMode, setInputMode] = useState<InputMode>('scraped');
  const [pasteText, setPasteText] = useState('');
  const [profile, setProfile] = useState<keyof typeof PROFILES>('standard');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(PROFILES.standard.timeoutMs);
  const [concurrency, setConcurrency] = useState(PROFILES.standard.concurrency);
  const [retries, setRetries] = useState(PROFILES.standard.retries);
  const [retryDelayMs, setRetryDelayMs] = useState(500);
  const [checkLimit, setCheckLimit] = useState(0);
  const [testUrlKey, setTestUrlKey] = useState('google');
  const [detectAnonymity, setDetectAnonymity] = useState(true);
  const [detectExitIp, setDetectExitIp] = useState(true);
  const [testHttps, setTestHttps] = useState(true);
  const [filterType, setFilterType] = useState<ProxyType | 'all'>('all');
  const [filterAnon, setFilterAnon] = useState<AnonFilter>('all');
  const [filterLatency, setFilterLatency] = useState<LatencyFilter>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('all');
  const [sortBy, setSortBy] = useState<SortKey>('latency');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState('');

  const applyProfile = (key: keyof typeof PROFILES) => {
    const p = PROFILES[key];
    setProfile(key);
    setTimeoutMs(p.timeoutMs);
    setConcurrency(p.concurrency);
    setRetries(p.retries);
    setDetectAnonymity(p.detectAnonymity);
    setTestHttps(p.testHttps);
  };

  const refresh = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const [s, res, scraped, p] = await Promise.all([
      fetchCheckerStats().catch(() => null),
      fetchCheckerResults(),
      fetchProxyResults(),
      fetchTestUrlPresets(),
    ]);
    if (gen !== loadGenRef.current || !mountedRef.current) return;
    if (s) setStats(s);
    setChecked(res.checked ?? []);
    setPoolCount(scraped.poolCount ?? scraped.proxies?.length ?? 0);
    setCustomCount(scraped.customCount ?? 0);
    setPresets(p);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useVisibilityAwarePoll(() => { void refresh(); }, 15_000);

  const runCheck = async () => {
    setBusy(true);
    setProgress(0);
    setLiveAlive(0);
    setLiveRecovered(0);
    setLiveEta(null);
    setLogs([]);
    setMsg('Checker starting…');
    try {
      const testUrl = presets[testUrlKey] ?? presets.google;
      const jobId = await startCheckJob({
        useScraped: inputMode === 'scraped',
        text: inputMode === 'paste' ? pasteText : undefined,
        timeoutMs,
        concurrency,
        retries,
        retryDelayMs,
        testUrl,
        detectAnonymity,
        detectExitIp,
        testHttps,
        limit: checkLimit > 0 ? checkLimit : 0,
      });
      setActiveJobId(jobId);
      jobAbortRef.current?.abort();
      const abort = new AbortController();
      jobAbortRef.current = abort;
      const finalJob = await pollCheckerJob(jobId, (job) => {
        if (!mountedRef.current) return;
        setMsg(job.message);
        setProgress(job.total ? Math.round((job.progress / job.total) * 100) : 0);
        if (job.alive != null) setLiveAlive(job.alive);
        if (job.recovered != null) setLiveRecovered(job.recovered);
        if (job.logs?.length) setLogs(job.logs.slice(-30));
        setLiveEta(formatEta(job.etaMs));
      }, 800, { signal: abort.signal });
      await refresh();
      setMsg(
        finalJob.status === 'cancelled'
          ? 'Check cancelled — partial results saved'
          : 'Check complete — results synced to Proxy Database',
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setMsg(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setBusy(false);
      setActiveJobId(null);
      setLiveEta(null);
    }
  };

  const stopCheck = async () => {
    if (!activeJobId) return;
    try {
      await cancelCheckerJob(activeJobId);
      setMsg('Cancel requested…');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  const typeCounts = useMemo(() => {
    const c: Record<ProxyType, { total: number; working: number }> = {
      http: { total: 0, working: 0 },
      https: { total: 0, working: 0 },
      socks4: { total: 0, working: 0 },
      socks5: { total: 0, working: 0 },
    };
    for (const p of checked) {
      c[p.type].total++;
      if (p.alive) c[p.type].working++;
    }
    return c;
  }, [checked]);

  const filtered = useMemo(() => {
    const q = search.trim();
    let list = checked.filter((p) => {
      if (viewTab === 'working' && !p.alive) return false;
      if (viewTab === 'dead' && p.alive) return false;
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (filterAnon !== 'all' && p.anonymity !== filterAnon) return false;
      if (filterLatency !== 'all' && p.latencyGrade !== filterLatency) return false;
      if (q && !p.raw.includes(q) && !p.host.includes(q) && !(p.exitIp?.includes(q))) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'latency') {
        const la = a.alive ? (a.latency ?? 99999) : 99999;
        const lb = b.alive ? (b.latency ?? 99999) : 99999;
        return la - lb;
      }
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return 0;
    });
    return list;
  }, [checked, viewTab, filterType, filterAnon, filterLatency, search, sortBy]);

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const exportTxt = () => downloadBlob(exportCheckedTxt(filtered, viewTab !== 'dead'), viewTab === 'working' ? 'proxies-working.txt' : 'proxies-all.txt', 'text/plain');
  const exportJson = () => downloadBlob(exportCheckedJson(filtered, viewTab !== 'dead'), 'proxies-checked.json', 'application/json');
  const exportCsv = () => downloadBlob(exportCheckedCsv(filtered, viewTab !== 'dead'), 'proxies-checked.csv', 'text/csv');

  const copyProxy = async (raw: string) => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(raw);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <ToolCard title="Proxy Checker Pro" icon="🔍" accent="teal">
        <p className="text-[9px] font-mono text-slate-500 mb-3 leading-relaxed">
          Auto-type · Retry on timeout · Latency grades · Anonymity · HTTPS — syncs to{' '}
          <strong className="text-indigo-300">Proxy Database</strong>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-3">
          <StatPill label="Checked" value={stats?.totalChecked ?? 0} />
          <StatPill label="Working" value={stats?.alive ?? 0} accent="text-emerald-300" />
          <StatPill label="Dead" value={stats?.dead ?? 0} accent="text-rose-300" />
          <StatPill label="Ø ms" value={stats?.avgLatency ?? 0} />
          <StatPill label="HTTPS" value={stats?.supportsHttps ?? 0} accent="text-sky-300" />
          <StatPill label="Retry✓" value={stats?.recovered ?? 0} accent="text-amber-300" />
          <StatPill label="Fast" value={stats?.latencyGrades?.fast ?? 0} accent="text-emerald-400" />
          <StatPill label="DB +/~" value={`${stats?.databaseAdded ?? 0}/${stats?.databaseUpdated ?? 0}`} accent="text-indigo-300" />
        </div>

        {stats && (stats.anonymity || stats.latencyGrades) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <BreakdownBar
              title="Anonymity"
              items={[
                { label: 'elite', value: stats.anonymity?.elite ?? 0, color: 'bg-emerald-500' },
                { label: 'anonymous', value: stats.anonymity?.anonymous ?? 0, color: 'bg-amber-500' },
                { label: 'transparent', value: stats.anonymity?.transparent ?? 0, color: 'bg-rose-500' },
              ]}
            />
            <BreakdownBar
              title="Latency"
              items={[
                { label: 'fast', value: stats.latencyGrades?.fast ?? 0, color: 'bg-emerald-500' },
                { label: 'medium', value: stats.latencyGrades?.medium ?? 0, color: 'bg-amber-500' },
                { label: 'slow', value: stats.latencyGrades?.slow ?? 0, color: 'bg-orange-500' },
              ]}
            />
          </div>
        )}

        {inputMode === 'scraped' && poolCount === 0 && onGoToScraper && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            <span className="text-[9px] font-mono text-amber-200/90">Pool empty — scrape first or add custom proxies.</span>
            <button type="button" onClick={onGoToScraper} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-500/35 text-[9px] font-mono text-amber-200 hover:bg-amber-500/20">
              <ArrowLeft size={11} /> Go to scraper
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          <ModeBtn active={inputMode === 'scraped'} onClick={() => setInputMode('scraped')}>
            <Database size={12} /> Pool ({poolCount.toLocaleString('en-US')}{customCount > 0 ? ` · ${customCount} custom` : ''})
          </ModeBtn>
          <ModeBtn active={inputMode === 'paste'} onClick={() => setInputMode('paste')}>
            <ClipboardPaste size={12} /> Paste
          </ModeBtn>
          <div className="flex-1" />
          {(Object.keys(PROFILES) as (keyof typeof PROFILES)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => applyProfile(k)}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono transition-all ${
                profile === k ? 'border-teal-400/50 bg-teal-500/20 text-teal-100' : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {PROFILES[k].label}
            </button>
          ))}
        </div>

        {inputMode === 'paste' && (
          <div className="mb-3">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              placeholder={'Bulk paste — auto-detect:\nip:port\ntype://ip:port\nuser:pass@ip:port\nip:port:user:pass'}
              className="w-full bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-300 focus:border-teal-500/40 focus:outline-none"
              spellCheck={false}
            />
            {pasteText.trim() && (() => {
              const d = detectProxyPaste(pasteText, 'http');
              return (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] font-mono">
                  <span className={`px-2 py-0.5 rounded border ${d.count ? 'border-teal-500/40 text-teal-300 bg-teal-500/10' : 'border-rose-500/40 text-rose-300'}`}>
                    {d.count.toLocaleString('en-US')} auto-detected
                  </span>
                  {(['http', 'https', 'socks4', 'socks5'] as ProxyType[]).map((t) =>
                    d.byType[t] > 0 ? (
                      <span key={t} className={`px-1.5 py-0.5 rounded border uppercase ${TYPE_COLORS[t]}`}>
                        {t} {d.byType[t]}
                      </span>
                    ) : null,
                  )}
                  {d.withAuth > 0 && (
                    <span className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300">auth {d.withAuth}</span>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="mb-3 inline-flex items-center gap-1.5 text-[9px] font-mono text-slate-500 hover:text-teal-300"
        >
          <SlidersHorizontal size={12} /> Advanced {showAdvanced ? '▲' : '▼'}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 rounded-xl border border-slate-800/80 bg-black/20">
            <label className="text-[9px] font-mono text-slate-500">
              Test-URL
              <select value={testUrlKey} onChange={(e) => setTestUrlKey(e.target.value)} className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-300">
                {Object.keys(presets).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-[9px] font-mono text-slate-500">Timeout {timeoutMs}ms
              <input type="range" min={2000} max={30000} step={500} value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} className="w-full mt-2 accent-teal-500" />
            </label>
            <label className="text-[9px] font-mono text-slate-500">Concurrency {concurrency}
              <input type="range" min={10} max={500} step={10} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} className="w-full mt-2 accent-teal-500" />
            </label>
            <label className="text-[9px] font-mono text-slate-500">Retry {retries}×
              <input type="range" min={0} max={3} step={1} value={retries} onChange={(e) => setRetries(Number(e.target.value))} className="w-full mt-2 accent-amber-500" />
            </label>
            <label className="text-[9px] font-mono text-slate-500">Retry-Delay {retryDelayMs}ms
              <input type="range" min={200} max={3000} step={100} value={retryDelayMs} onChange={(e) => setRetryDelayMs(Number(e.target.value))} className="w-full mt-2 accent-amber-500" />
            </label>
            <label className="text-[9px] font-mono text-slate-500">Limit {checkLimit || '∞'}
              <input type="range" min={0} max={5000} step={50} value={checkLimit} onChange={(e) => setCheckLimit(Number(e.target.value))} className="w-full mt-2 accent-violet-500" />
            </label>
            <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
              <input type="checkbox" checked={detectAnonymity} onChange={(e) => setDetectAnonymity(e.target.checked)} className="accent-teal-500" />
              <Shield size={11} /> Anonymity
            </label>
            <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
              <input type="checkbox" checked={detectExitIp} onChange={(e) => setDetectExitIp(e.target.checked)} className="accent-teal-500" />
              <Globe2 size={11} /> Exit-IP (httpbin)
            </label>
            <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400 sm:col-span-2">
              <input type="checkbox" checked={testHttps} onChange={(e) => setTestHttps(e.target.checked)} className="accent-teal-500" />
              <Zap size={11} /> HTTPS-CONNECT Test
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <ActionButton
            onClick={runCheck}
            variant="indigo"
            disabled={
              busy
              || (inputMode === 'paste' && detectProxyPaste(pasteText, 'http').count === 0)
              || (inputMode === 'scraped' && poolCount === 0)
            }
          >
            <Play size={12} className="inline mr-1" />
            {busy ? `Checking ${progress}%` : 'Start check'}
          </ActionButton>
          {busy && activeJobId && (
            <button type="button" onClick={stopCheck} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 text-[9px] font-mono text-rose-200 hover:bg-rose-500/20">
              <Square size={11} /> Stop
            </button>
          )}
          <button type="button" onClick={refresh} disabled={busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-500 hover:text-teal-300 disabled:opacity-40">
            <RefreshCw size={11} /> Refresh
          </button>
          <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
            <RotateCcw size={11} /> Retry · <Gauge size={11} /> Latency · DB sync
          </span>
        </div>

        {busy && (
          <div className="mb-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
            <div className="flex justify-between text-[9px] font-mono text-teal-200 mb-1.5">
              <span>{msg}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-teal-600 to-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex flex-wrap gap-4 text-[8px] font-mono text-slate-500">
              <span className="text-emerald-400"><Activity size={10} className="inline" /> {liveAlive} working</span>
              {liveRecovered > 0 && <span className="text-amber-300">{liveRecovered} retry-recovered</span>}
              {liveEta && <span className="text-violet-300">ETA {liveEta}</span>}
            </div>
          </div>
        )}

        {!busy && msg && <p className="text-[10px] font-mono text-teal-300 mb-2">{msg}</p>}

        {logs.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-black/30 p-2 max-h-24 overflow-y-auto">
            {logs.map((l, i) => (
              <div key={`${l}-${i}`} className="text-[8px] font-mono text-slate-500">{l}</div>
            ))}
          </div>
        )}
      </ToolCard>

      <ToolCard title="Results" icon="📊" accent="cyan">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(['http', 'https', 'socks4', 'socks5'] as ProxyType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(filterType === t ? 'all' : t)}
              className={`px-2 py-1 rounded-lg border text-[8px] font-mono uppercase transition-all ${TYPE_COLORS[t]} ${
                filterType === t ? 'ring-1 ring-white/20' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t} {typeCounts[t].working}/{typeCounts[t].total}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {(['all', 'working', 'dead'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setViewTab(tab)}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono capitalize ${
                viewTab === tab ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200' : 'border-slate-800 text-slate-500'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'working' ? 'Working' : 'Dead'}
            </button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="IP / Exit-IP…" className="flex-1 min-w-[100px] bg-black/40 border border-slate-800 rounded-lg px-2 py-1 text-[9px] font-mono text-slate-300" />
          <select value={filterAnon} onChange={(e) => setFilterAnon(e.target.value as AnonFilter)} className="bg-black/40 border border-slate-800 rounded-lg px-2 py-1 text-[9px] font-mono text-slate-400">
            <option value="all">Anon: all</option>
            <option value="elite">elite</option>
            <option value="anonymous">anonymous</option>
            <option value="transparent">transparent</option>
          </select>
          <select value={filterLatency} onChange={(e) => setFilterLatency(e.target.value as LatencyFilter)} className="bg-black/40 border border-slate-800 rounded-lg px-2 py-1 text-[9px] font-mono text-slate-400">
            <option value="all">Latency: all</option>
            <option value="fast">fast</option>
            <option value="medium">medium</option>
            <option value="slow">slow</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="bg-black/40 border border-slate-800 rounded-lg px-2 py-1 text-[9px] font-mono text-slate-400">
            <option value="latency">Sort: latency</option>
            <option value="type">Sort: type</option>
            <option value="status">Sort: status</option>
          </select>
          <button type="button" onClick={exportTxt} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-teal-300">
            <Download size={11} /> TXT
          </button>
          <button type="button" onClick={exportJson} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-teal-300">
            JSON
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-teal-300">
            CSV
          </button>
        </div>

        <div className="text-[9px] font-mono text-slate-600 mb-2">{filtered.length.toLocaleString('en-US')} shown</div>

        <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
          {filtered.map((p) => (
            <div key={`${p.type}:${p.raw}`} className={`flex flex-wrap items-center gap-2 p-2.5 rounded-xl border text-[9px] font-mono transition-colors ${
              p.alive ? 'border-slate-800/70 bg-black/25 hover:border-emerald-500/20' : 'border-slate-800/50 bg-black/15 opacity-75'
            }`}>
              <span className={`px-1.5 py-0.5 rounded border uppercase ${TYPE_COLORS[p.type]}`}>{p.type}</span>
              <span className="text-slate-300 min-w-[120px]">{p.raw}</span>
              {p.alive ? (
                <span className={`flex items-center gap-0.5 ${LATENCY_COLORS[p.latencyGrade ?? 'medium']}`}>
                  <CheckCircle2 size={10} /> {p.latency}ms
                  {p.latencyGrade && <span className="opacity-70">({p.latencyGrade})</span>}
                </span>
              ) : (
                <span className="text-rose-400/80 flex items-center gap-0.5">
                  <XCircle size={10} /> {p.errorCategory ?? p.error ?? 'dead'}
                </span>
              )}
              {p.exitIp && <span className="text-violet-300 flex items-center gap-0.5"><Globe2 size={9} /> {p.exitIp}</span>}
              {p.anonymity && <span className={ANON_COLORS[p.anonymity] ?? 'text-slate-500'}>{p.anonymity}</span>}
              {p.recovered && <span className="text-amber-300">retry✓</span>}
              {p.typeCorrected && <span className="text-violet-300">auto-type</span>}
              {p.supportsHttps && <span className="text-sky-400">HTTPS</span>}
              <button type="button" onClick={() => copyProxy(p.raw)} className="ml-auto p-1 text-slate-600 hover:text-teal-300" title="Copy">
                <Copy size={11} />
              </button>
            </div>
          ))}
          {!filtered.length && (
            <p className="text-center py-10 text-slate-600 text-[10px] font-mono">No results — start check or adjust filters</p>
          )}
        </div>
        {copied && <p className="text-[8px] font-mono text-teal-400 mt-2">Copied: {copied}</p>}
      </ToolCard>
    </div>
  );
}

function StatPill({ label, value, accent = 'text-slate-300' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/25 px-2 py-2 text-center">
      <div className="text-[7px] font-mono text-slate-600 uppercase tracking-wide">{label}</div>
      <div className={`text-[11px] font-mono font-semibold tabular-nums ${accent}`}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
    </div>
  );
}

function BreakdownBar({ title, items }: { title: string; items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/20 p-2.5">
      <div className="text-[8px] font-mono text-slate-500 uppercase mb-1.5">{title}</div>
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-800 mb-1.5">
        {items.filter((i) => i.value > 0).map((i) => (
          <div key={i.label} className={`${i.color} transition-all`} style={{ width: `${(i.value / total) * 100}%` }} title={`${i.label}: ${i.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[7px] font-mono text-slate-500">
        {items.map((i) => (
          <span key={i.label}>{i.label} {i.value}</span>
        ))}
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono transition-colors ${
        active ? 'border-teal-500/40 bg-teal-500/15 text-teal-200' : 'border-slate-800 text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}