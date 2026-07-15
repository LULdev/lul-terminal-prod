/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Database,
  Download,
  FileCode2,
  Filter,
  Globe,
  History,
  Layers,
  Link2,
  Play,
  Radar,
  Search,
  Sparkles,
  Square,
  Upload,
  Zap,
} from 'lucide-react';
import { ActionButton, ToolCard } from '../pages/PageShell';
import {
  CrawlResultsDashboard,
  LiveCrawlTelemetry,
  ScraperHero,
  SessionStatsBar,
  XmlScanDashboard,
} from './scraper/ScraperMonitorUi';
import {
  cancelCrawlJob,
  downloadText,
  exportColonAtlasCsv,
  exportColonAtlasTxt,
  exportColonValuesOnly,
  fetchColonDbStats,
  exportMatchesCsv,
  exportMatchesJson,
  exportMatchesTxt,
  fetchXmlScraperPresets,
  isValidStartUrl,
  normalizeStartUrl,
  pollCrawlJob,
  saveColonAtlasToDatabase,
  saveXmlMatchesToDatabase,
  scanXmlLinks,
  startWebsiteCrawl,
  type ColonDbStats,
  type ColonAtlasEntry,
  type CrawlPreset,
  type PatternPreset,
  type WebsiteCrawlResult,
  type WebsiteFeature,
  type XmlLinkMatch,
  type XmlScanResult,
} from '../../lib/xmlLinkScraper';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de"/>
  </url>
  <url>
    <loc>https://api.example.com/v1/docs</loc>
    <image:image>
      <image:loc>https://cdn.example.com/preview.png</image:loc>
    </image:image>
  </url>
  <feed>
    <link href="mailto:admin@example.com"/>
    <mirror>ftp://mirror.example.com/repo</mirror>
  </feed>
</urlset>`;

const HISTORY_KEY = 'lul_xml_scraper_history_v1';
const CRAWL_HISTORY_KEY = 'lul_website_crawl_history_v1';
const CRAWL_SETTINGS_KEY = 'lul_website_crawl_settings_v1';

type HistoryEntry = {
  at: string;
  pattern: string;
  fileName: string;
  totalMatches: number;
};

type CrawlHistoryEntry = {
  at: string;
  startUrl: string;
  siteName: string;
  uniqueColons: number;
  pagesCrawled: number;
  pattern: string;
};

const DEFAULT_CRAWL_PRESETS: CrawlPreset[] = [
  { id: 'quick', label: 'Quick', maxPages: 25, maxDepth: 2, hint: 'Fast snapshot' },
  { id: 'standard', label: 'Standard', maxPages: 80, maxDepth: 4, hint: 'Recommended' },
  { id: 'deep', label: 'Deep', maxPages: 200, maxDepth: 8, hint: 'Large sites' },
];

export function AdminXmlLinkScraperPanel() {
  const [tab, setTab] = useState<'website' | 'xml'>('website');
  const [xml, setXml] = useState('');
  const [fileName, setFileName] = useState('');
  const [pattern, setPattern] = useState('*:*');
  const [mode, setMode] = useState<'smart' | 'urls' | 'raw'>('smart');
  const [presets, setPresets] = useState<PatternPreset[]>([]);
  const [crawlPresets, setCrawlPresets] = useState<CrawlPreset[]>(DEFAULT_CRAWL_PRESETS);
  const [websiteFeatures, setWebsiteFeatures] = useState<WebsiteFeature[]>([]);
  const [result, setResult] = useState<XmlScanResult | null>(null);
  const [query, setQuery] = useState('');
  const [groupDomain, setGroupDomain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [startUrl, setStartUrl] = useState('');
  const [crawlResult, setCrawlResult] = useState<WebsiteCrawlResult | null>(null);
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [crawlMsg, setCrawlMsg] = useState('');
  const [crawlLogs, setCrawlLogs] = useState<string[]>([]);
  const [crawlProgress, setCrawlProgress] = useState({
    pagesCrawled: 0, queueSize: 0, colonHits: 0, maxPages: 80, currentUrl: '',
    linksDiscovered: 0, pagesFailed: 0, sitemapSeeded: 0, elapsedMs: 0, pagesPerSecond: 0, uniqueColonsEstimate: 0,
  });
  const [maxPages, setMaxPages] = useState(80);
  const [maxDepth, setMaxDepth] = useState(4);
  const [crawlPresetId, setCrawlPresetId] = useState('standard');
  const [useSitemap, setUseSitemap] = useState(true);
  const [respectRobots, setRespectRobots] = useState(false);
  const [sameOriginOnly, setSameOriginOnly] = useState(true);
  const [smartColon, setSmartColon] = useState(true);
  const [mineScripts, setMineScripts] = useState(true);
  const [discoverFeeds, setDiscoverFeeds] = useState(true);
  const [stripTracking, setStripTracking] = useState(true);
  const [retryFetch, setRetryFetch] = useState(true);
  const [scraperSkills, setScraperSkills] = useState<WebsiteFeature[]>([]);
  const [colonDbStats, setColonDbStats] = useState<ColonDbStats | null>(null);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbMsg, setDbMsg] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [crawlView, setCrawlView] = useState<'atlas' | 'pages' | 'depth'>('atlas');
  const [crawlQuery, setCrawlQuery] = useState('');
  const [crawlHistory, setCrawlHistory] = useState<CrawlHistoryEntry[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const activeJobRef = useRef<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const presetsGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollAbortRef.current?.abort();
    };
  }, []);

  const urlValid = useMemo(() => startUrl.trim().length > 0 && isValidStartUrl(startUrl), [startUrl]);

  useEffect(() => {
    const gen = ++presetsGenRef.current;
    fetchXmlScraperPresets().then((d) => {
      if (gen !== presetsGenRef.current || !mountedRef.current) return;
      setPresets(d.presets);
      setWebsiteFeatures(d.websiteFeatures);
      setScraperSkills(d.scraperSkills ?? d.websiteFeatures);
      if (d.crawlPresets.length) setCrawlPresets(d.crawlPresets);
    }).catch(() => {});
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
      const crawlRaw = localStorage.getItem(CRAWL_HISTORY_KEY);
      if (crawlRaw) setCrawlHistory(JSON.parse(crawlRaw));
      const settingsRaw = localStorage.getItem(CRAWL_SETTINGS_KEY);
      if (settingsRaw) {
        const s = JSON.parse(settingsRaw);
        if (s.startUrl) setStartUrl(s.startUrl);
        if (s.pattern) setPattern(s.pattern);
        if (s.maxPages) setMaxPages(s.maxPages);
        if (s.maxDepth) setMaxDepth(s.maxDepth);
        if (s.crawlPresetId) setCrawlPresetId(s.crawlPresetId);
        if (typeof s.useSitemap === 'boolean') setUseSitemap(s.useSitemap);
        if (typeof s.smartColon === 'boolean') setSmartColon(s.smartColon);
        if (typeof s.mineScripts === 'boolean') setMineScripts(s.mineScripts);
        if (typeof s.discoverFeeds === 'boolean') setDiscoverFeeds(s.discoverFeeds);
        if (typeof s.stripTracking === 'boolean') setStripTracking(s.stripTracking);
        if (typeof s.retryFetch === 'boolean') setRetryFetch(s.retryFetch);
        if (typeof s.sameOriginOnly === 'boolean') setSameOriginOnly(s.sameOriginOnly);
        if (typeof s.respectRobots === 'boolean') setRespectRobots(s.respectRobots);
      }
    } catch { /* ignore */ }
    fetchColonDbStats().then(setColonDbStats).catch(() => {});
  }, []);

  const refreshDbStats = async () => {
    try {
      setColonDbStats(await fetchColonDbStats());
    } catch { /* ignore */ }
  };

  const saveCrawlSettings = useCallback(() => {
    try {
      localStorage.setItem(CRAWL_SETTINGS_KEY, JSON.stringify({
        startUrl, pattern, maxPages, maxDepth, crawlPresetId,
        useSitemap, smartColon, mineScripts, discoverFeeds, stripTracking, retryFetch,
        sameOriginOnly, respectRobots,
      }));
    } catch { /* ignore */ }
  }, [startUrl, pattern, maxPages, maxDepth, crawlPresetId, useSitemap, smartColon, mineScripts, discoverFeeds, stripTracking, retryFetch, sameOriginOnly, respectRobots]);

  const applyCrawlPreset = (preset: CrawlPreset) => {
    setCrawlPresetId(preset.id);
    setMaxPages(preset.maxPages);
    setMaxDepth(preset.maxDepth);
  };

  const pasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setStartUrl(text.trim());
        setCrawlMsg('URL pasted from clipboard');
      }
    } catch {
      setCrawlMsg('Clipboard access denied');
    }
  };

  const normalizeUrlField = () => {
    const norm = normalizeStartUrl(startUrl);
    if (norm) setStartUrl(norm);
  };

  const loadFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml') && file.type && !file.type.includes('xml')) {
      setMsg('Please upload an .xml file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setXml(String(reader.result ?? ''));
      setFileName(file.name);
      setResult(null);
      setMsg(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.onerror = () => setMsg('Failed to read file');
    reader.readAsText(file);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const runScan = async () => {
    if (!xml.trim()) {
      setMsg('Paste XML or upload a .xml file first');
      return;
    }
    setBusy(true);
    setMsg('Scanning…');
    setResult(null);
    try {
      const data = await scanXmlLinks({ xml, pattern, mode });
      setResult(data);
      setMsg(`Done in ${data.scanMs}ms — ${data.stats.totalMatches} matches (${data.stats.uniqueMatches} unique)`);
      const entry: HistoryEntry = {
        at: new Date().toISOString(),
        pattern,
        fileName: fileName || 'pasted.xml',
        totalMatches: data.stats.totalMatches,
      };
      const next = [entry, ...history].slice(0, 8);
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    if (!result) return [] as XmlLinkMatch[];
    const q = query.trim().toLowerCase();
    let list = result.matches;
    if (q) {
      list = list.filter(
        (m) =>
          m.value.toLowerCase().includes(q) ||
          m.path.toLowerCase().includes(q) ||
          (m.attribute ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [result, query]);

  const grouped = useMemo(() => {
    if (!groupDomain) return null;
    const map = new Map<string, XmlLinkMatch[]>();
    for (const m of filtered) {
      let key = 'other';
      try {
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(m.value)) key = new URL(m.value).hostname || 'other';
      } catch { /* keep other */ }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, groupDomain]);

  const copyValue = async (value: string, id: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? '' : c)), 1500);
  };

  const copyAll = async () => {
    if (!filtered.length) return;
    await navigator.clipboard.writeText(exportMatchesTxt(filtered));
    setCopied('all');
    setTimeout(() => setCopied(''), 1500);
  };

  const stopCrawl = async () => {
    if (!activeJobRef.current) return;
    setCrawlMsg('Stopping…');
    try {
      await cancelCrawlJob(activeJobRef.current);
    } catch { /* poll will pick up cancelled state */ }
  };

  const runCrawl = async () => {
    const norm = normalizeStartUrl(startUrl);
    if (!norm) {
      setCrawlMsg('Enter a valid URL');
      return;
    }
    setStartUrl(norm);
    saveCrawlSettings();
    setCrawlBusy(true);
    setCrawlMsg('Starting crawl…');
    setCrawlResult(null);
    setCrawlLogs([]);
    setExpandedRows(new Set());
    activeJobRef.current = null;
    try {
      const jobId = await startWebsiteCrawl({
        startUrl: norm,
        pattern,
        maxPages,
        maxDepth,
        useSitemap,
        respectRobots,
        sameOriginOnly,
        smartColon,
        mineScripts,
        discoverFeeds,
        stripTracking,
        retryFetch,
      });
      activeJobRef.current = jobId;
      pollAbortRef.current?.abort();
      const abort = new AbortController();
      pollAbortRef.current = abort;
      const job = await pollCrawlJob(jobId, (j) => {
        if (!mountedRef.current) return;
        setCrawlMsg(j.message);
        setCrawlProgress({ ...j.progress, currentUrl: j.progress.currentUrl ?? '' });
        if (j.logs?.length) setCrawlLogs(j.logs.slice(-12));
      }, 700, { signal: abort.signal });
      if (job.result) {
        setCrawlResult(job.result);
        const msg = job.status === 'cancelled'
          ? `Stopped — ${job.result.stats.uniqueColons} unique : tokens`
          : `Done — ${job.result.stats.uniqueColons} unique : tokens (deduped from ${job.result.stats.colonHits})`;
        setCrawlMsg(msg);
        const entry: CrawlHistoryEntry = {
          at: new Date().toISOString(),
          startUrl: norm,
          siteName: job.result.siteName,
          uniqueColons: job.result.stats.uniqueColons,
          pagesCrawled: job.result.stats.pagesCrawled,
          pattern,
        };
        const next = [entry, ...crawlHistory].slice(0, 10);
        setCrawlHistory(next);
        localStorage.setItem(CRAWL_HISTORY_KEY, JSON.stringify(next));
      } else if (job.status === 'cancelled') {
        setCrawlMsg('Crawl stopped');
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setCrawlMsg(e instanceof Error ? e.message : 'Crawl failed');
    } finally {
      setCrawlBusy(false);
      activeJobRef.current = null;
    }
  };

  const saveCrawlToDb = async () => {
    if (!filteredAtlas.length) {
      setDbMsg('Nothing to save');
      return;
    }
    setDbSaving(true);
    setDbMsg('Saving to database…');
    try {
      const r = await saveColonAtlasToDatabase(filteredAtlas, crawlResult?.siteName);
      await refreshDbStats();
      setDbMsg(`DB: +${r.added} new · ${r.updated} updated · ${r.skipped} skipped · ${r.total} total`);
    } catch (e) {
      setDbMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setDbSaving(false);
    }
  };

  const saveXmlToDb = async () => {
    if (!filtered.length) {
      setDbMsg('No matches to save');
      return;
    }
    setDbSaving(true);
    setDbMsg('Saving XML matches…');
    try {
      const r = await saveXmlMatchesToDatabase(filtered, fileName || 'xml-scan');
      await refreshDbStats();
      setDbMsg(`DB: +${r.added} new · ${r.updated} updated · ${r.total} total`);
    } catch (e) {
      setDbMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setDbSaving(false);
    }
  };

  const copyAllColons = async () => {
    if (!filteredAtlas.length) return;
    await navigator.clipboard.writeText(exportColonValuesOnly(filteredAtlas));
    setCopied('colons-all');
    setTimeout(() => setCopied(''), 1500);
  };

  const toggleRow = (value: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const filteredAtlas = useMemo(() => {
    if (!crawlResult) return [] as ColonAtlasEntry[];
    const q = crawlQuery.trim().toLowerCase();
    return crawlResult.colonAtlas.filter((e) => {
      if (schemeFilter && e.scheme !== schemeFilter) return false;
      if (!q) return true;
      return (
        e.value.toLowerCase().includes(q) ||
        e.pages.some((p) => p.url.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
      );
    });
  }, [crawlResult, crawlQuery, schemeFilter]);

  const progressPct = crawlProgress.maxPages
    ? Math.min(100, Math.round((crawlProgress.pagesCrawled / crawlProgress.maxPages) * 100))
    : 0;

  const sessionStats = useMemo(() => ({
    totalCrawls: crawlHistory.length,
    totalXmlScans: history.length,
    totalColons: crawlHistory.reduce((s, h) => s + h.uniqueColons, 0),
    totalPages: crawlHistory.reduce((s, h) => s + h.pagesCrawled, 0),
    totalXmlHits: history.reduce((s, h) => s + h.totalMatches, 0),
  }), [crawlHistory, history]);

  const heroStatus = crawlBusy ? 'running' as const
    : crawlResult ? 'done' as const
      : crawlMsg.toLowerCase().includes('fail') || crawlMsg.toLowerCase().includes('error') ? 'error' as const
        : 'idle' as const;

  const displaySite = useMemo(() => {
    if (crawlResult?.siteName) return crawlResult.siteName;
    const norm = normalizeStartUrl(startUrl);
    if (!norm) return undefined;
    try { return new URL(norm).hostname; } catch { return undefined; }
  }, [crawlResult, startUrl]);

  return (
    <div className="space-y-4">
      <ScraperHero
        mode={tab}
        status={tab === 'website' ? heroStatus : busy ? 'running' : result ? 'done' : 'idle'}
        siteName={displaySite}
        subtitle={crawlBusy ? crawlMsg : crawlResult ? `${crawlResult.stats.uniqueColons} unique :` : result ? `${result.stats.totalMatches} matches` : undefined}
      />

      <SessionStatsBar {...sessionStats} />

      {colonDbStats && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <Database size={14} className="text-violet-400 shrink-0" />
          <span className="text-[9px] font-mono text-slate-400">
            Colon-DB: <strong className="text-violet-300">{colonDbStats.total.toLocaleString('en-US')}</strong> entries
            · <strong className="text-emerald-300/90">{colonDbStats.websites}</strong> websites
            {colonDbStats.updatedAt && (
              <span className="text-slate-600"> · updated {new Date(colonDbStats.updatedAt).toLocaleString('en-US')}</span>
            )}
          </span>
          {dbMsg && <span className="text-[8px] font-mono text-cyan-400/90">{dbMsg}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl border border-slate-800/80 bg-black/40 w-fit">
        {([
          { id: 'website' as const, icon: Globe, label: 'Website Crawler', accent: 'emerald', count: crawlHistory.length },
          { id: 'xml' as const, icon: FileCode2, label: 'XML Scanner', accent: 'cyan', count: history.length },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-mono font-bold transition-all ${
              tab === t.id
                ? t.accent === 'emerald'
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                  : 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)]'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            <t.icon size={13} />
            {t.label}
            {t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] tabular-nums ${tab === t.id ? 'bg-black/30' : 'bg-slate-800/80'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'website' && (
        <>
          <ToolCard title="Website Colon Crawler" icon="🌐" accent="emerald">
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { step: '1', label: 'Enter URL', color: 'text-emerald-300' },
                { step: '2', label: 'Start crawl', color: 'text-cyan-300' },
                { step: '3', label: 'View atlas', color: 'text-violet-300' },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2 rounded-lg border border-slate-800/70 bg-black/25 px-3 py-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-300 flex items-center justify-center">{s.step}</span>
                  <div className={`text-[8px] font-mono leading-tight ${s.color}`}>{s.label}</div>
                </div>
              ))}
            </div>

            <p className="text-[9px] font-mono text-slate-500 mb-4 leading-relaxed max-w-3xl">
              Enter a start URL — the crawler <strong className="text-emerald-300">discovers pages automatically</strong>,
              collects every <code className="text-emerald-200/80">:</code> token, shows where each was found,
              and <strong className="text-violet-300">deduplicates</strong> in the colon atlas.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-[8px] font-mono text-slate-600 self-center mr-1"><Zap size={10} className="inline" /> Depth preset:</span>
              {crawlPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.hint}
                  onClick={() => applyCrawlPreset(p)}
                  className={`px-3 py-1.5 rounded-lg border text-[9px] font-mono transition ${
                    crawlPresetId === p.id
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-800 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {p.label} <span className="text-slate-600">({p.maxPages}p · d{p.maxDepth})</span>
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-black/25 p-4 space-y-3">
                <label className="text-[8px] font-mono uppercase tracking-wider text-slate-500 block">Start URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      value={startUrl}
                      onChange={(e) => setStartUrl(e.target.value)}
                      onBlur={normalizeUrlField}
                      onKeyDown={(e) => e.key === 'Enter' && !crawlBusy && urlValid && runCrawl()}
                      placeholder="example.com or https://…"
                      className={`w-full bg-[#0b0c10] border rounded-lg px-3 py-2.5 pr-7 text-[11px] font-mono text-emerald-100 focus:outline-none ${
                        startUrl && !urlValid ? 'border-rose-500/40 focus:border-rose-500/50' : 'border-slate-800 focus:border-emerald-500/50'
                      }`}
                    />
                    {startUrl && (
                      <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${urlValid ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    )}
                  </div>
                  <button type="button" onClick={pasteUrl} title="Paste from clipboard" className="shrink-0 px-2.5 rounded-lg border border-slate-800 text-slate-500 hover:text-emerald-300 hover:border-emerald-500/30 transition">
                    <ClipboardPaste size={14} />
                  </button>
                </div>

                <label className="text-[8px] font-mono uppercase tracking-wider text-slate-500 block">Colon-Muster / pattern</label>
                <input
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="*:*"
                  className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-300 focus:border-emerald-500/40 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {(presets.length ? presets : [
                    { id: 'colon', label: '*:*', pattern: '*:*', hint: '' },
                    { id: 'https', label: 'https://*', pattern: 'https://*', hint: '' },
                    { id: 'mailto', label: 'mailto:*', pattern: 'mailto:*', hint: '' },
                  ]).slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.hint}
                      onClick={() => setPattern(p.pattern)}
                      className={`px-2 py-0.5 rounded border text-[8px] font-mono ${
                        pattern === p.pattern ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 text-slate-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[8px] font-mono text-slate-600">
                    Max pages
                    <input type="number" min={5} max={500} value={maxPages} onChange={(e) => { setMaxPages(Number(e.target.value)); setCrawlPresetId('custom'); }} className="mt-1 w-full bg-black/40 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300" />
                  </label>
                  <label className="text-[8px] font-mono text-slate-600">
                    Max depth
                    <input type="number" min={1} max={12} value={maxDepth} onChange={(e) => { setMaxDepth(Number(e.target.value)); setCrawlPresetId('custom'); }} className="mt-1 w-full bg-black/40 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300" />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-black/25 p-4 space-y-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-1">Options</p>
                {[
                  { k: 'smart', label: 'Smart filter (real links only)', val: smartColon, set: setSmartColon },
                  { k: 'scripts', label: 'Script JSON miner (__NEXT_DATA__, fetch)', val: mineScripts, set: setMineScripts },
                  { k: 'feeds', label: 'RSS/Atom feed radar', val: discoverFeeds, set: setDiscoverFeeds },
                  { k: 'tracking', label: 'Strip tracking params (utm, fbclid)', val: stripTracking, set: setStripTracking },
                  { k: 'retry', label: 'Retry + UA-Rotation (3×)', val: retryFetch, set: setRetryFetch },
                  { k: 'sitemap', label: 'Sitemap turbo-seed', val: useSitemap, set: setUseSitemap },
                  { k: 'origin', label: 'Same origin only', val: sameOriginOnly, set: setSameOriginOnly },
                  { k: 'robots', label: 'robots.txt + crawl-delay', val: respectRobots, set: setRespectRobots },
                ].map((o) => (
                  <label key={o.k} className="flex items-center gap-2 text-[9px] font-mono text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={o.val} onChange={(e) => o.set(e.target.checked)} className="rounded border-slate-700" />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/15 bg-black/25 p-4 mb-4">
              <p className="text-[8px] font-mono uppercase tracking-wider text-cyan-500/80 mb-2">Scraper Skills</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {(scraperSkills.length ? scraperSkills : websiteFeatures).map((f) => (
                  <div key={f.id} className="text-[8px] font-mono text-slate-600 p-2 rounded-lg border border-slate-800/50 bg-black/20">
                    <span className="text-cyan-400/90 font-bold">{f.title}</span>
                    <div className="text-slate-600 mt-0.5 leading-relaxed">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <ActionButton onClick={runCrawl} variant="emerald" disabled={crawlBusy || !urlValid}>
                <span className="inline-flex items-center gap-1.5">
                  <Radar size={10} /> {crawlBusy ? 'Crawling…' : 'Crawl website'}
                </span>
              </ActionButton>
              {crawlBusy && (
                <ActionButton onClick={stopCrawl} variant="rose">
                  <span className="inline-flex items-center gap-1.5"><Square size={10} /> Stop</span>
                </ActionButton>
              )}
              {crawlMsg && <span className="text-[9px] font-mono text-slate-500">{crawlMsg}</span>}
            </div>

            {crawlBusy && (
              <LiveCrawlTelemetry
                progress={crawlProgress}
                progressPct={progressPct}
                logs={crawlLogs}
                maxDepth={maxDepth}
              />
            )}
          </ToolCard>

          {crawlHistory.length > 0 && !crawlBusy && (
            <ToolCard title="Recent crawls" icon="🕐" accent="amber">
              <div className="space-y-1">
                {crawlHistory.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setStartUrl(h.startUrl); setPattern(h.pattern); setCrawlMsg(`Loaded ${h.siteName}`); }}
                    className="w-full flex items-center justify-between gap-2 text-[9px] font-mono text-slate-500 py-1.5 px-2 rounded-lg border border-transparent hover:border-slate-800/80 hover:bg-black/20 transition text-left"
                  >
                    <span className="flex items-center gap-1.5 truncate text-slate-400">
                      <History size={10} className="shrink-0 text-amber-500/70" />
                      {h.siteName}
                    </span>
                    <span className="text-violet-300/80 shrink-0">{h.uniqueColons} :</span>
                    <span className="text-emerald-400/70 shrink-0">{h.pagesCrawled}p</span>
                    <span className="text-slate-600 shrink-0">{new Date(h.at).toLocaleString('en-US')}</span>
                  </button>
                ))}
              </div>
            </ToolCard>
          )}

          {crawlResult && (
            <ToolCard title={`Colon atlas — ${crawlResult.siteName}`} icon="🗺️" accent="violet">
              <CrawlResultsDashboard result={crawlResult} filteredCount={filteredAtlas.length} />

              <div className="flex flex-wrap gap-1.5 mb-3 mt-4 pt-4 border-t border-slate-800/60">
                <button type="button" onClick={() => setSchemeFilter('')} className={`px-2 py-0.5 rounded-full border text-[8px] font-mono ${!schemeFilter ? 'border-violet-500/40 text-violet-200 bg-violet-500/10' : 'border-slate-800 text-slate-500'}`}>all</button>
                {Object.entries(crawlResult.stats.schemes).map(([s, n]) => (
                  <button key={s} type="button" onClick={() => setSchemeFilter(schemeFilter === s ? '' : s)} className={`px-2 py-0.5 rounded-full border text-[8px] font-mono ${schemeFilter === s ? 'border-cyan-500/40 text-cyan-200 bg-cyan-500/10' : 'border-slate-800 text-slate-500'}`}>
                    {s}: {n}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {(['atlas', 'pages', 'depth'] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setCrawlView(v)} className={`px-3 py-1.5 rounded-lg border text-[9px] font-mono capitalize ${crawlView === v ? 'border-indigo-500/35 bg-indigo-500/10 text-indigo-200' : 'border-slate-800 text-slate-500'}`}>
                    {v === 'atlas' ? 'Colon list' : v === 'pages' ? 'Pages' : 'Depth layers'}
                  </button>
                ))}
                <div className="flex-1 min-w-[140px] relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={11} />
                  <input value={crawlQuery} onChange={(e) => setCrawlQuery(e.target.value)} placeholder="Filter…" className="w-full pl-8 pr-2 py-1.5 bg-black/40 border border-slate-800 rounded-lg text-[9px] font-mono text-slate-200 focus:outline-none focus:border-violet-500/40" />
                </div>
                <button type="button" onClick={copyAllColons} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 hover:text-cyan-300">
                  <Copy size={10} /> {copied === 'colons-all' ? 'Copied!' : 'All :'}
                </button>
                <ActionButton onClick={saveCrawlToDb} variant="indigo" disabled={dbSaving || !filteredAtlas.length}>
                  <span className="inline-flex items-center gap-1.5">
                    <Database size={10} /> {dbSaving ? 'Saving…' : 'Save to DB'}
                  </span>
                </ActionButton>
                <button type="button" onClick={() => downloadText('colon-atlas.txt', exportColonAtlasTxt(filteredAtlas))} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 hover:text-emerald-300">
                  <Download size={10} /> TXT
                </button>
                <button type="button" onClick={() => downloadText('colon-atlas.csv', exportColonAtlasCsv(filteredAtlas), 'text/csv')} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 hover:text-violet-300">
                  <Download size={10} /> CSV
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-1 space-y-2">
                {crawlView === 'atlas' && filteredAtlas.map((entry, i) => (
                  <ColonAtlasRow
                    key={`${entry.value}-${i}`}
                    entry={entry}
                    copied={copied}
                    onCopy={copyValue}
                    expanded={expandedRows.has(entry.value)}
                    onToggle={() => toggleRow(entry.value)}
                  />
                ))}
                {crawlView === 'pages' && crawlResult.pages.map((p) => (
                  <div key={p.url} className="p-2.5 rounded-lg border border-slate-800/50 bg-black/20 text-[9px] font-mono">
                    <div className="text-slate-300 truncate">{p.title || p.url}</div>
                    <div className="text-slate-600 truncate mt-0.5">{p.url}</div>
                    <div className="text-emerald-500/70 mt-0.5">depth {p.depth} · {p.colonCount} colon hits</div>
                  </div>
                ))}
                {crawlView === 'depth' && Object.entries(crawlResult.depthBreakdown).map(([d, n]) => {
                  const count = Number(n);
                  const pct = crawlResult.stats.colonHits > 0 ? Math.min(100, (count / crawlResult.stats.colonHits) * 100) : 0;
                  return (
                  <div key={d} className="flex items-center gap-3 p-2 rounded-lg border border-slate-800/50 bg-black/20">
                    <Layers size={12} className="text-indigo-400" />
                    <span className="text-[10px] font-mono text-slate-400">Depth {d}</span>
                    <div className="flex-1 h-1 rounded-full bg-slate-900"><div className="h-full bg-indigo-500/60 rounded-full" style={{ width: `${pct}%` }} /></div>
                    <span className="text-[10px] font-mono text-indigo-300 tabular-nums">{count}</span>
                  </div>
                  );
                })}
                {crawlView === 'atlas' && !filteredAtlas.length && (
                  <p className="text-center py-8 text-[10px] font-mono text-slate-600">No colon tokens match filter</p>
                )}
              </div>
            </ToolCard>
          )}
        </>
      )}

      {tab === 'xml' && (
      <ToolCard title="XML Link Scraper" icon="🧬" accent="cyan">
        <p className="text-[9px] font-mono text-slate-500 mb-4 leading-relaxed max-w-3xl">
          Upload or paste any <strong className="text-cyan-300">.xml</strong> file, set a wildcard pattern
          (<code className="text-cyan-200/80">*</code> = anything), and extract matching links from attributes,
          text nodes &amp; CDATA — sitemaps, RSS, configs, manifests &amp; more.
        </p>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`relative rounded-2xl border-2 border-dashed p-5 transition-all ${
              dragOver
                ? 'border-cyan-400/50 bg-cyan-500/10'
                : 'border-slate-700/80 bg-black/25 hover:border-cyan-500/25'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
                e.target.value = '';
              }}
            />
            <div className="flex flex-col items-center text-center gap-2">
              <Upload className="w-8 h-8 text-cyan-400/70" />
              <p className="text-[10px] font-mono text-slate-400">Drop .xml here or</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-[10px] font-mono font-bold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
              >
                browse file
              </button>
              {fileName && (
                <span className="text-[9px] font-mono text-emerald-400/90 flex items-center gap-1">
                  <FileCode2 size={11} /> {fileName}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-black/25 p-4 space-y-3">
            <label className="text-[8px] font-mono uppercase tracking-wider text-slate-500 block">Wildcard pattern</label>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="*:*"
              className="w-full bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-2.5 text-[11px] font-mono text-cyan-100 focus:border-cyan-500/50 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {(presets.length ? presets : [
                { id: 'colon', label: '*:*', pattern: '*:*', hint: '' },
                { id: 'https', label: 'https://*', pattern: 'https://*', hint: '' },
                { id: 'all', label: '*', pattern: '*', hint: '' },
              ]).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.hint}
                  onClick={() => setPattern(p.pattern)}
                  className={`px-2 py-1 rounded-lg border text-[9px] font-mono transition ${
                    pattern === p.pattern
                      ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-800 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[8px] font-mono text-slate-600 self-center">Mode:</span>
              {(['smart', 'urls', 'raw'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-2 py-1 rounded border text-[8px] font-mono uppercase ${
                    mode === m ? 'border-violet-500/35 bg-violet-500/10 text-violet-200' : 'border-slate-800 text-slate-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          value={xml}
          onChange={(e) => { setXml(e.target.value); setResult(null); }}
          placeholder="Or paste XML content here…"
          rows={8}
          className="w-full mb-3 bg-[#0b0c10] border border-slate-800 rounded-xl px-3 py-2.5 text-[10px] font-mono text-slate-300 focus:border-cyan-500/40 focus:outline-none resize-y leading-relaxed"
        />

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <ActionButton onClick={runScan} variant="cyan" disabled={busy}>
            <span className="inline-flex items-center gap-1.5">
              <Play size={10} /> {busy ? 'Scanning…' : 'Scan XML'}
            </span>
          </ActionButton>
          <ActionButton
            onClick={() => { setXml(SAMPLE_XML); setFileName('sample-sitemap.xml'); setResult(null); setMsg('Sample loaded'); }}
            variant="indigo"
          >
            Load sample
          </ActionButton>
          <ActionButton onClick={() => { setXml(''); setFileName(''); setResult(null); setMsg(''); }} variant="rose">
            Clear
          </ActionButton>
          {msg && <span className="text-[9px] font-mono text-slate-500 ml-1">{msg}</span>}
        </div>
      </ToolCard>
      )}

      {tab === 'xml' && result && (
        <ToolCard title="Scan results" icon="📡" accent="indigo">
          <XmlScanDashboard result={result} filteredCount={filtered.length} />

          <div className="flex flex-wrap gap-2 mb-3 mt-4 pt-4 border-t border-slate-800/60">
            <div className="flex-1 min-w-[160px] relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter results…"
                className="w-full pl-8 pr-3 py-2 bg-black/40 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-200 focus:border-indigo-500/40 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setGroupDomain((g) => !g)}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-[9px] font-mono ${
                groupDomain ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 text-slate-500'
              }`}
            >
              <Filter size={11} /> Group by domain
            </button>
            <button type="button" onClick={copyAll} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 hover:text-cyan-300">
              <Copy size={11} /> {copied === 'all' ? 'Copied!' : 'Copy all'}
            </button>
            <button
              type="button"
              onClick={() => downloadText('xml-links.txt', exportMatchesTxt(filtered))}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 hover:text-indigo-300"
            >
              <Download size={11} /> TXT
            </button>
            <button
              type="button"
              onClick={() => downloadText('xml-links.csv', exportMatchesCsv(filtered), 'text/csv')}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 hover:text-indigo-300"
            >
              <Download size={11} /> CSV
            </button>
            <button
              type="button"
              onClick={() => downloadText('xml-scan.json', exportMatchesJson(result), 'application/json')}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-400 hover:text-indigo-300"
            >
              <Download size={11} /> JSON
            </button>
            <ActionButton onClick={saveXmlToDb} variant="indigo" disabled={dbSaving || !filtered.length}>
              <span className="inline-flex items-center gap-1.5">
                <Database size={10} /> {dbSaving ? 'Saving…' : 'Save to DB'}
              </span>
            </ActionButton>
          </div>

          <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2">
            {groupDomain && grouped
              ? grouped.map(([domain, items]) => (
                  <div key={domain} className="rounded-xl border border-slate-800/60 bg-black/20 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-slate-800/60 text-[8px] font-mono text-emerald-400/90 uppercase tracking-wider">
                      {domain} · {items.length}
                    </div>
                    {items.map((m, i) => (
                      <MatchRow key={`${domain}-${i}`} match={m} copied={copied} onCopy={copyValue} />
                    ))}
                  </div>
                ))
              : filtered.map((m, i) => (
                  <MatchRow key={`${m.value}-${m.line}-${i}`} match={m} copied={copied} onCopy={copyValue} />
                ))}
            {!filtered.length && (
              <p className="text-center py-10 text-[10px] font-mono text-slate-600">No matches for this pattern / filter</p>
            )}
          </div>
        </ToolCard>
      )}

      {tab === 'xml' && history.length > 0 && (
        <ToolCard title="Recent scans" icon="🕐" accent="violet">
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[9px] font-mono text-slate-500 py-1 border-b border-slate-800/40 last:border-0">
                <span className="truncate text-slate-400">{h.fileName}</span>
                <span className="text-violet-300/80 shrink-0">{h.pattern}</span>
                <span className="text-cyan-400/80 shrink-0">{h.totalMatches} hits</span>
                <span className="text-slate-600 shrink-0">{new Date(h.at).toLocaleString('en-US')}</span>
              </div>
            ))}
          </div>
        </ToolCard>
      )}

      <ToolCard title="Scraper capabilities" icon="✨" accent="amber">
        <ul className="grid sm:grid-cols-2 gap-2 text-[9px] font-mono text-slate-500 leading-relaxed">
          {[
            '3-step flow: URL → crawl → colon atlas',
            'Quick / Standard / Deep — one-click crawl presets',
            'Smart filter: real links instead of CSS noise',
            'Sitemap + canonical + og:url + JSON-LD discovery',
            'Clipboard paste · Enter-to-crawl · stop anytime',
            'Crawl history · settings persist across sessions',
            'Expandable colon atlas · copy all : · export',
            '8 scraper skills: script miner, feeds, retry, tracking strip, external radar',
            'XML wildcard scan · admin-only · up to 500 pages',
          ].map((t) => (
            <li key={t} className="flex gap-2 items-start">
              <Sparkles size={10} className="text-amber-400/70 shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </ToolCard>
    </div>
  );
}

const ColonAtlasRow: FC<{
  entry: ColonAtlasEntry;
  copied: string;
  onCopy: (value: string, id: string) => void | Promise<void>;
  expanded: boolean;
  onToggle: () => void;
}> = ({
  entry,
  copied,
  onCopy,
  expanded,
  onToggle,
}) => {
  const id = entry.value.slice(0, 32);
  const preview = entry.pages[0];
  return (
    <div className="rounded-xl border border-violet-500/15 bg-black/25 overflow-hidden">
      <div className="flex items-start gap-2 p-2.5 group">
        <button type="button" onClick={onToggle} className="shrink-0 mt-0.5 text-slate-600 hover:text-violet-300">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Link2 size={12} className="text-violet-400/70 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono text-violet-100 break-all">{entry.value}</div>
          <div className="text-[8px] font-mono text-slate-600 mt-0.5">
            <span className="text-cyan-500/80">{entry.scheme}</span> · {entry.hitCount}× · {entry.pages.length} page(s)
            {!expanded && preview && (
              <span className="text-slate-700"> · <span className="text-emerald-500/70">{preview.siteName}</span></span>
            )}
          </div>
        </div>
        <button type="button" onClick={() => onCopy(entry.value, id)} className="p-1.5 rounded border border-slate-800 text-slate-600 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition shrink-0">
          {copied === id ? '✓' : <Copy size={11} />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-slate-800/50 px-2.5 py-1.5 space-y-1 bg-black/20">
          {entry.pages.map((p) => (
            <div key={p.url} className="text-[8px] font-mono text-slate-500 truncate">
              <span className="text-emerald-500/80">{p.siteName}</span> · depth {p.depth} · {p.title || p.url}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MatchRow: FC<{
  match: XmlLinkMatch;
  copied: string;
  onCopy: (value: string, id: string) => void | Promise<void>;
}> = ({
  match,
  copied,
  onCopy,
}) => {
  const id = `${match.line}-${match.value.slice(0, 24)}`;
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-800/50 bg-black/20 hover:border-cyan-500/20 transition group">
      <Link2 size={12} className="text-cyan-500/60 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono text-cyan-100 break-all">{match.value}</div>
        <div className="text-[8px] font-mono text-slate-600 mt-0.5">
          {match.path}
          {match.attribute ? ` · @${match.attribute}` : ''} · line {match.line} · {match.source}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCopy(match.value, id)}
        className="p-1.5 rounded border border-slate-800 text-slate-600 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition shrink-0"
        title="Copy link"
      >
        {copied === id ? <span className="text-[8px]">✓</span> : <Copy size={11} />}
      </button>
    </div>
  );
};