/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Clock,
  Database,
  Filter,
  Gauge,
  Globe,
  Hash,
  Layers,
  Link2,
  Radar,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { WebsiteCrawlResult, XmlScanResult } from '../../../lib/xmlLinkScraper';

const ACCENT_STYLES = {
  emerald: { border: 'border-emerald-500/25', glow: 'from-emerald-500/10', text: 'text-emerald-300', icon: 'text-emerald-400' },
  cyan: { border: 'border-cyan-500/25', glow: 'from-cyan-500/10', text: 'text-cyan-300', icon: 'text-cyan-400' },
  violet: { border: 'border-violet-500/25', glow: 'from-violet-500/10', text: 'text-violet-300', icon: 'text-violet-400' },
  amber: { border: 'border-amber-500/25', glow: 'from-amber-500/10', text: 'text-amber-300', icon: 'text-amber-400' },
  rose: { border: 'border-rose-500/25', glow: 'from-rose-500/10', text: 'text-rose-300', icon: 'text-rose-400' },
  indigo: { border: 'border-indigo-500/25', glow: 'from-indigo-500/10', text: 'text-indigo-300', icon: 'text-indigo-400' },
  slate: { border: 'border-slate-600/25', glow: 'from-slate-500/10', text: 'text-slate-300', icon: 'text-slate-400' },
} as const;

type Accent = keyof typeof ACCENT_STYLES;

export function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
  large,
  pulse,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: Accent;
  large?: boolean;
  pulse?: boolean;
}) {
  const s = ACCENT_STYLES[accent];
  const display = typeof value === 'number' ? value.toLocaleString('en-US') : value;
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${s.border} bg-black/35 p-3 transition hover:bg-black/45`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${s.glow} to-transparent pointer-events-none`} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[7px] font-mono text-slate-600 uppercase tracking-wider">{label}</div>
          <div className={`font-mono font-bold tabular-nums mt-1 ${large ? 'text-xl' : 'text-base'} ${s.text} ${pulse ? 'animate-pulse' : ''}`}>
            {display}
          </div>
          {sub && <div className="text-[7px] font-mono text-slate-600 mt-0.5 truncate">{sub}</div>}
        </div>
        {Icon && (
          <div className={`shrink-0 p-1.5 rounded-lg border ${s.border} bg-black/40`}>
            <Icon size={14} className={s.icon} />
          </div>
        )}
      </div>
    </div>
  );
}

export function RingProgress({ pct, label, accent = 'emerald' }: { pct: number; label: string; accent?: Accent }) {
  const s = ACCENT_STYLES[accent];
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, pct) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-800" />
        <circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          stroke="currentColor" className={s.text}
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className={`text-lg font-mono font-bold tabular-nums -mt-12 rotate-90 ${s.text}`}>{pct}%</span>
      <span className="text-[7px] font-mono text-slate-600 uppercase mt-6">{label}</span>
    </div>
  );
}

export function DistBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[8px] font-mono group">
      <span className="w-16 truncate text-slate-500 group-hover:text-slate-400">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-900/80 overflow-hidden border border-slate-800/50">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-slate-400 tabular-nums">{value.toLocaleString('en-US')}</span>
      <span className="w-8 text-right text-slate-600 tabular-nums">{pct}%</span>
    </div>
  );
}

export function ScraperHero({
  mode,
  status,
  siteName,
  subtitle,
}: {
  mode: 'website' | 'xml';
  status: 'idle' | 'running' | 'done' | 'error';
  siteName?: string;
  subtitle?: string;
}) {
  const isWeb = mode === 'website';
  const statusColors = {
    idle: 'bg-slate-500',
    running: 'bg-emerald-400 animate-pulse',
    done: 'bg-cyan-400',
    error: 'bg-rose-400',
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${isWeb ? 'border-emerald-500/20' : 'border-cyan-500/20'} bg-gradient-to-r from-black/60 via-black/40 to-black/60 p-4`}>
      <div className={`absolute inset-0 bg-gradient-to-r ${isWeb ? 'from-emerald-500/5' : 'from-cyan-500/5'} to-transparent`} />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border ${isWeb ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-cyan-500/30 bg-cyan-500/10'}`}>
            {isWeb ? <Globe size={22} className="text-emerald-300" /> : <Database size={22} className="text-cyan-300" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-mono font-bold ${isWeb ? 'text-emerald-200' : 'text-cyan-200'}`}>
                {isWeb ? 'Colon Discovery Monitor' : 'XML Link Monitor'}
              </h3>
              <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
              <span className="text-[8px] font-mono text-slate-600 uppercase">{status}</span>
            </div>
            <p className="text-[9px] font-mono text-slate-500 mt-0.5">
              {siteName ? <span className="text-slate-400">{siteName}</span> : 'Ready'}
              {subtitle ? ` · ${subtitle}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-[7px] font-mono text-slate-600 uppercase">Engine</div>
            <div className="text-[10px] font-mono text-slate-400">LUL-Scraper v1.1</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionStatsBar({
  totalCrawls,
  totalXmlScans,
  totalColons,
  totalPages,
  totalXmlHits,
}: {
  totalCrawls: number;
  totalXmlScans: number;
  totalColons: number;
  totalPages: number;
  totalXmlHits: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-black/25 p-3">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={12} className="text-amber-400" />
        <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500">Session lifetime stats</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <MetricTile label="Total crawls" value={totalCrawls} icon={Globe} accent="emerald" />
        <MetricTile label="XML Scans" value={totalXmlScans} icon={Database} accent="cyan" />
        <MetricTile label=": Tokens found" value={totalColons} icon={Hash} accent="violet" />
        <MetricTile label="Pages crawled" value={totalPages} icon={Layers} accent="indigo" />
        <MetricTile label="XML matches" value={totalXmlHits} icon={Link2} accent="amber" />
      </div>
    </div>
  );
}

export function LiveCrawlTelemetry({
  progress,
  progressPct,
  logs,
  maxDepth,
}: {
  progress: {
    pagesCrawled: number;
    queueSize: number;
    colonHits: number;
    maxPages: number;
    currentUrl?: string;
    linksDiscovered?: number;
    pagesFailed?: number;
    sitemapSeeded?: number;
    feedSeeded?: number;
    externalLinksFound?: number;
    scriptTokensFound?: number;
    metaTokensFound?: number;
    elapsedMs?: number;
    pagesPerSecond?: number;
    uniqueColonsEstimate?: number;
  };
  progressPct: number;
  logs: string[];
  maxDepth: number;
}) {
  const elapsed = progress.elapsedMs ?? 0;
  const eta = progress.pagesPerSecond && progress.pagesPerSecond > 0
    ? Math.round((progress.maxPages - progress.pagesCrawled) / progress.pagesPerSecond)
    : null;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-black/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-emerald-200 uppercase tracking-wider">Live Telemetry</span>
        </div>
        <span className="text-[8px] font-mono text-slate-500">
          {progress.pagesCrawled}/{progress.maxPages} pages · queue {progress.queueSize}
        </span>
      </div>

      <div className="flex flex-wrap gap-6 items-center">
        <RingProgress pct={progressPct} label="Progress" accent="emerald" />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 min-w-[200px]">
          <MetricTile label="Colon Hits" value={progress.colonHits} icon={Hash} accent="violet" pulse />
          <MetricTile label="Unique est." value={progress.uniqueColonsEstimate ?? 0} icon={Target} accent="cyan" />
          <MetricTile label="Links found" value={progress.linksDiscovered ?? 0} icon={Link2} accent="indigo" />
          <MetricTile label="Failed" value={progress.pagesFailed ?? 0} icon={Activity} accent="rose" />
          <MetricTile label="Sitemap +" value={progress.sitemapSeeded ?? 0} icon={Zap} accent="amber" />
          <MetricTile label="Pages/s" value={progress.pagesPerSecond ?? 0} sub="throughput" icon={Gauge} accent="emerald" />
          <MetricTile label="Elapsed" value={`${(elapsed / 1000).toFixed(1)}s`} icon={Clock} accent="slate" />
          <MetricTile label="ETA" value={eta != null ? `~${eta}s` : '—'} sub={`max depth ${maxDepth}`} icon={TrendingUp} accent="cyan" />
          <MetricTile label="Script :" value={progress.scriptTokensFound ?? 0} icon={Database} accent="cyan" />
          <MetricTile label="Meta :" value={progress.metaTokensFound ?? 0} icon={Hash} accent="violet" />
          <MetricTile label="Feeds +" value={progress.feedSeeded ?? 0} icon={Zap} accent="amber" />
          <MetricTile label="External" value={progress.externalLinksFound ?? 0} icon={Globe} accent="indigo" />
        </div>
      </div>

      <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800/50">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 via-cyan-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {progress.currentUrl && (
        <div className="flex items-center gap-2 text-[8px] font-mono text-slate-500 truncate">
          <span className="text-emerald-500 shrink-0">▶</span>
          <span className="truncate">{progress.currentUrl}</span>
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-xl border border-slate-800/60 bg-black/30 p-2 max-h-24 overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className="text-[7px] font-mono text-slate-600 leading-relaxed">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CrawlResultsDashboard({ result, filteredCount }: { result: WebsiteCrawlResult; filteredCount: number }) {
  const s = result.stats;
  const maxScheme = Math.max(...Object.values(s.schemes), 1);
  const maxDepth = Math.max(...Object.values(result.depthBreakdown).map(Number), 1);
  const dedupePct = s.dedupeRatio != null ? Math.round(s.dedupeRatio * 100) : 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-violet-400" />
        <span className="text-[10px] font-mono font-bold text-violet-200 uppercase tracking-wider">Crawl Analytics — {result.siteName}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <MetricTile label="Unique :" value={s.uniqueColons} icon={Hash} accent="violet" large />
        <MetricTile label="Total Hits" value={s.colonHits} icon={Target} accent="cyan" />
        <MetricTile label="Pages" value={s.pagesCrawled} icon={Globe} accent="emerald" />
        <MetricTile label="With :" value={s.pagesWithColons ?? 0} sub="pages w/ tokens" icon={Layers} accent="indigo" />
        <MetricTile label="Links" value={s.linksDiscovered} icon={Link2} accent="cyan" />
        <MetricTile label="Sitemap +" value={s.sitemapSeeded} icon={Zap} accent="amber" />
        <MetricTile label="Failed" value={s.pagesFailed} icon={Activity} accent="rose" />
        <MetricTile label="Queued" value={s.pagesQueued} icon={Database} accent="slate" />
        <MetricTile label="Duration" value={`${(s.crawlMs / 1000).toFixed(1)}s`} icon={Clock} accent="amber" />
        <MetricTile label="Pages/s" value={s.pagesPerSecond ?? 0} icon={Gauge} accent="emerald" />
        <MetricTile label="Avg :/page" value={s.avgColonsPerPage ?? 0} icon={BarChart3} accent="violet" />
        <MetricTile label="Max depth" value={s.maxDepthReached ?? 0} icon={Layers} accent="indigo" />
        <MetricTile label="Schemes" value={s.schemeCount ?? Object.keys(s.schemes).length} icon={Hash} accent="cyan" />
        <MetricTile label="Dedupe" value={`${dedupePct}%`} sub={`${s.uniqueColons}/${s.colonHits}`} icon={Target} accent="violet" />
        <MetricTile label="Success" value={`${s.successRate ?? 100}%`} icon={TrendingUp} accent="emerald" />
        <MetricTile label="Filter" value={filteredCount} sub="visible in atlas" icon={Filter} accent="amber" />
        <MetricTile label="Script :" value={s.scriptTokensFound ?? 0} icon={Database} accent="cyan" />
        <MetricTile label="Meta :" value={s.metaTokensFound ?? 0} icon={Hash} accent="violet" />
        <MetricTile label="Feed :" value={s.feedTokensFound ?? 0} icon={Zap} accent="amber" />
        <MetricTile label="Feeds +" value={s.feedSeeded ?? 0} icon={Radar} accent="emerald" />
        <MetricTile label="External" value={s.externalLinksFound ?? 0} icon={Globe} accent="indigo" />
        <MetricTile label="Ext domains" value={s.externalDomainCount ?? 0} icon={Target} accent="slate" />
        <MetricTile label="Bytes" value={s.totalBytes ? `${(s.totalBytes / 1024).toFixed(0)} KB` : '0'} icon={Database} accent="slate" />

      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-violet-500/15 bg-black/30 p-4">
          <div className="text-[8px] font-mono text-violet-300/80 uppercase mb-3 flex items-center gap-1.5">
            <Hash size={10} /> Scheme distribution
          </div>
          <div className="space-y-2">
            {Object.entries(s.schemes).sort((a, b) => b[1] - a[1]).map(([scheme, count]) => (
              <div key={scheme}>
                <DistBar label={scheme} value={count} max={maxScheme} color="bg-gradient-to-r from-violet-600 to-cyan-500" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-500/15 bg-black/30 p-4">
          <div className="text-[8px] font-mono text-indigo-300/80 uppercase mb-3 flex items-center gap-1.5">
            <Layers size={10} /> Depth layers
          </div>
          <div className="space-y-2">
            {Object.entries(result.depthBreakdown).map(([d, n]) => (
              <div key={d}>
                <DistBar label={`Depth ${d}`} value={Number(n)} max={maxDepth} color="bg-gradient-to-r from-indigo-600 to-violet-500" />
              </div>
            ))}
          </div>
        </div>

        {s.statusBreakdown && Object.keys(s.statusBreakdown).length > 0 && (
          <div className="rounded-2xl border border-emerald-500/15 bg-black/30 p-4">
            <div className="text-[8px] font-mono text-emerald-300/80 uppercase mb-3">HTTP Status</div>
            <div className="space-y-2">
              {Object.entries(s.statusBreakdown).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                <div key={code}>
                  <DistBar label={code} value={count} max={s.pagesCrawled} color={code.startsWith('2') ? 'bg-emerald-500' : 'bg-rose-500'} />
                </div>
              ))}
            </div>
          </div>
        )}

        {result.stats.sources && Object.keys(result.stats.sources).length > 0 && (
          <div className="rounded-2xl border border-cyan-500/15 bg-black/30 p-4">
            <div className="text-[8px] font-mono text-cyan-300/80 uppercase mb-3">Token sources (html / script / meta)</div>
            <div className="space-y-2">
              {Object.entries(result.stats.sources).map(([src, count]) => (
                <div key={src}>
                  <DistBar label={src} value={count} max={s.colonHits} color="bg-gradient-to-r from-cyan-600 to-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {result.topExternalDomains && result.topExternalDomains.length > 0 && (
          <div className="rounded-2xl border border-indigo-500/15 bg-black/30 p-4">
            <div className="text-[8px] font-mono text-indigo-300/80 uppercase mb-3">Top external domains</div>
            <div className="space-y-2">
              {result.topExternalDomains.map((d) => (
                <div key={d.domain}>
                  <DistBar label={d.domain} value={d.count} max={result.topExternalDomains![0]?.count ?? 1} color="bg-gradient-to-r from-indigo-600 to-violet-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {result.topPages && result.topPages.length > 0 && (
          <div className="rounded-2xl border border-cyan-500/15 bg-black/30 p-4">
            <div className="text-[8px] font-mono text-cyan-300/80 uppercase mb-3">Top pages by : count</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {result.topPages.map((p, i) => (
                <div key={p.url} className="flex items-center gap-2 text-[8px] font-mono p-1.5 rounded-lg bg-black/25 border border-slate-800/40">
                  <span className="text-slate-600 w-4 shrink-0">#{i + 1}</span>
                  <span className="text-violet-300 tabular-nums shrink-0 w-8">{p.colonCount}</span>
                  <span className="text-slate-400 truncate flex-1">{p.title || p.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function XmlScanDashboard({ result, filteredCount }: { result: XmlScanResult; filteredCount: number }) {
  const s = result.stats;
  const maxProto = Math.max(...Object.values(s.protocols), 1);
  const dedupePct = s.totalMatches ? Math.round((s.uniqueMatches / s.totalMatches) * 100) : 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-cyan-400" />
        <span className="text-[10px] font-mono font-bold text-cyan-200 uppercase tracking-wider">XML Scan Analytics</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <MetricTile label="Matches" value={s.totalMatches} icon={Target} accent="cyan" large />
        <MetricTile label="Unique" value={s.uniqueMatches} icon={Hash} accent="violet" />
        <MetricTile label="Domains" value={s.domains} icon={Globe} accent="emerald" />
        <MetricTile label="Strings" value={s.stringsScanned} icon={Database} accent="indigo" />
        <MetricTile label="Attributes" value={s.attributeHits} icon={Link2} accent="cyan" />
        <MetricTile label="Text" value={s.textHits} icon={Layers} accent="amber" />
        <MetricTile label="CDATA" value={s.cdataHits} icon={Activity} accent="rose" />
        <MetricTile label="Scanzeit" value={`${result.scanMs}ms`} icon={Clock} accent="amber" />
        <MetricTile label="Dedupe" value={`${dedupePct}%`} sub={`${s.uniqueMatches}/${s.totalMatches}`} icon={Target} accent="violet" />
        <MetricTile label="Pattern" value={result.pattern} icon={Hash} accent="slate" />
        <MetricTile label="Mode" value={result.mode} icon={Gauge} accent="indigo" />
        <MetricTile label="Filtered" value={filteredCount} icon={Filter} accent="emerald" />
      </div>

      {Object.keys(s.protocols).length > 0 && (
        <div className="rounded-2xl border border-cyan-500/15 bg-black/30 p-4">
          <div className="text-[8px] font-mono text-cyan-300/80 uppercase mb-3">Protocol breakdown</div>
          <div className="space-y-2">
            {Object.entries(s.protocols).sort((a, b) => b[1] - a[1]).map(([proto, count]) => (
              <div key={proto}>
                <DistBar label={proto} value={count} max={maxProto} color="bg-gradient-to-r from-cyan-600 to-indigo-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {result.domains.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/15 bg-black/30 p-4">
          <div className="text-[8px] font-mono text-emerald-300/80 uppercase mb-3">Top domains</div>
          <div className="space-y-2">
            {result.domains.slice(0, 10).map((d) => (
              <div key={d.domain}>
                <DistBar label={d.domain} value={d.count} max={result.domains[0]?.count ?? 1} color="bg-gradient-to-r from-emerald-600 to-cyan-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

