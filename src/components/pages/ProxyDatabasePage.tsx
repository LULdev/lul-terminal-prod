/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  exportDbTxt,
  fetchProxyDatabaseLists,
  fetchProxyDatabaseStats,
  formatDbProxyUrl,
  runProxyDailyCheck,
  type DatabaseProxy,
  type ProxyDatabaseStats,
} from '../../lib/proxyDatabase';
import type { ProxyType } from '../../lib/proxyScraper';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { PageShell } from './PageShell';

const TYPE_COLORS: Record<ProxyType, string> = {
  http: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  https: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  socks4: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
  socks5: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
};

const TYPES: ProxyType[] = ['http', 'https', 'socks4', 'socks5'];

function StatCard({
  label,
  value,
  sub,
  accent,
  pulse,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3 py-3 flex flex-col gap-0.5 ${accent}`}>
      <span className="text-[8px] font-mono uppercase tracking-widest opacity-70">{label}</span>
      <span className={`text-xl font-mono font-bold tabular-nums leading-none ${pulse ? 'animate-pulse' : ''}`}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </span>
      {sub && <span className="text-[8px] font-mono opacity-60">{sub}</span>}
    </div>
  );
}

function formatWhen(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
}

export function ProxyDatabasePage() {
  const [stats, setStats] = useState<ProxyDatabaseStats | null>(null);
  const [lists, setLists] = useState<Record<ProxyType, DatabaseProxy[]>>({
    http: [], https: [], socks4: [], socks5: [],
  });
  const [activeType, setActiveType] = useState<ProxyType | 'all'>('all');
  const [showOffline, setShowOffline] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const [s, data] = await Promise.all([
      fetchProxyDatabaseStats().catch(() => null),
      fetchProxyDatabaseLists('all').catch(() => null),
    ]);
    if (gen !== loadGenRef.current || !mountedRef.current) return;
    if (s) setStats(s);
    if (data) {
      setLists(data.lists);
      if (!s && data.stats) setStats(data.stats);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useVisibilityAwarePoll(() => { void refresh(); }, 15_000);

  const runDaily = async (force = false) => {
    setBusy(true);
    setMsg('Daily check running…');
    try {
      const result = await runProxyDailyCheck(force);
      if (result.skipped) {
        setMsg(result.reason === 'already_checked_today' ? 'Already checked today' : 'Check skipped');
      } else {
        setMsg(
          `${result.checked ?? 0} checked · ${result.working ?? 0} working · ${result.offline ?? 0} offline · ${result.removed ?? 0} removed`,
        );
      }
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const flatList = useMemo(() => {
    const source = activeType === 'all'
      ? TYPES.flatMap((t) => lists[t] ?? [])
      : lists[activeType] ?? [];
    const q = search.trim();
    return source.filter((p) => {
      if (!showOffline && p.status !== 'working') return false;
      if (q && !p.raw.includes(q) && !p.host.includes(q)) return false;
      return true;
    });
  }, [lists, activeType, showOffline, search]);

  const copyWorking = async () => {
    const all = TYPES.flatMap((t) => lists[t] ?? []);
    await navigator.clipboard.writeText(exportDbTxt(all, true));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    const blob = new Blob([exportDbTxt(flatList, !showOffline)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = showOffline ? 'proxy-db-all.txt' : 'proxy-db-working.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <PageShell
      id="proxydatabase-module"
      pageId="proxydatabase"
      icon="🗄️"
      title="Proxy Database"
      subtitle="Persisted working proxies · daily health check · auto-purge after 3+ offline days"
      accentClass="text-indigo-400"
    >
      <div className="flex flex-col gap-4 min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatCard
            label="Collected"
            value={stats?.totalCollected ?? 0}
            sub="total ever stored"
            accent="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
          />
          <StatCard
            label="Working"
            value={stats?.working ?? 0}
            sub={`in DB: ${stats?.inDatabase ?? 0}`}
            accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            pulse={(stats?.working ?? 0) > 0}
          />
          <StatCard
            label="Offline"
            value={stats?.currentlyOffline ?? 0}
            sub="currently unreachable"
            accent="border-rose-500/25 bg-rose-500/5 text-rose-300"
          />
          <StatCard
            label="Removed"
            value={stats?.totalRemovedStale ?? 0}
            sub=">3 Offline-Tage"
            accent="border-slate-700/60 bg-[#12151c]/80 text-slate-300"
          />
          <StatCard
            label="Last check"
            value={stats?.lastDailyCheckDay ?? '—'}
            sub={formatWhen(stats?.lastDailyCheckAt)}
            accent="border-violet-500/25 bg-violet-500/5 text-violet-300"
          />
          <StatCard
            label="Next check"
            value={stats?.nextDailyCheckDue ? 'due' : 'OK'}
            sub={stats?.lastUpsertAt ? `Upsert ${formatWhen(stats.lastUpsertAt)}` : 'no upsert yet'}
            accent="border-cyan-500/25 bg-cyan-500/5 text-cyan-300"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => runDaily(false)}
            className="text-[10px] font-mono px-4 py-2.5 rounded-lg border border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 disabled:opacity-40 min-h-[38px]"
          >
            🔄 Daily Check
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runDaily(true)}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-violet-300"
          >
            Force
          </button>
          <button
            type="button"
            disabled={(stats?.working ?? 0) === 0}
            onClick={copyWorking}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white ml-auto"
          >
            {copied ? '✓ Copied' : '📋 Copy Working'}
          </button>
          <button
            type="button"
            disabled={flatList.length === 0}
            onClick={downloadTxt}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white"
          >
            ⬇ TXT
          </button>
        </div>

        {msg && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-[10px] font-mono text-indigo-200">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveType(t)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${activeType === t ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-800 bg-[#0b0c10]/60 hover:border-slate-700'}`}
            >
              <div className={`text-[9px] font-mono uppercase mb-1 ${TYPE_COLORS[t].split(' ')[0]}`}>{t}</div>
              <div className="text-lg font-mono font-bold text-white tabular-nums">
                {(stats?.byType?.[t] ?? 0).toLocaleString('en-US')}
                <span className="text-[10px] text-slate-500 font-normal ml-1">
                  +{(stats?.offlineByType?.[t] ?? 0).toLocaleString('en-US')} off
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IP…"
            className="flex-1 min-w-[140px] bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-200 focus:border-indigo-500/50 focus:outline-none"
          />
          <div className="flex gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveType('all')}
              className={`px-2 py-1 rounded border text-[9px] font-mono ${activeType === 'all' ? 'border-indigo-500/50 text-indigo-300 bg-indigo-500/10' : 'border-slate-800 text-slate-500'}`}
            >
              all
            </button>
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveType(t)}
                className={`px-2 py-1 rounded border text-[9px] font-mono ${activeType === t ? 'border-indigo-500/50 text-indigo-300 bg-indigo-500/10' : 'border-slate-800 text-slate-500'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOffline((v) => !v)}
            className={`px-2 py-1 rounded border text-[9px] font-mono ${showOffline ? 'border-rose-500/50 text-rose-300' : 'border-slate-800 text-slate-500'}`}
          >
            {showOffline ? 'incl. offline' : 'Working only'}
          </button>
          <span className="text-[9px] font-mono text-slate-600">{flatList.length} shown</span>
        </div>

        <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-[9px] font-mono">
            <thead className="sticky top-0 bg-[#12151c] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Proxy</th>
                <th className="text-left p-2">Type</th>
                <th className="text-right p-2">Latency</th>
                <th className="text-right p-2">Offline days</th>
                <th className="text-right p-2">Last OK</th>
              </tr>
            </thead>
            <tbody>
              {flatList.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-600">
                    No proxies in the database yet — admin: run scraper + checker in dashboard
                  </td>
                </tr>
              )}
              {flatList.slice(0, 500).map((p) => (
                <tr key={p.id} className="border-t border-slate-800/50 hover:bg-slate-800/20">
                  <td className="p-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        p.status === 'working'
                          ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                          : 'bg-rose-500/70 animate-pulse'
                      }`}
                    />
                  </td>
                  <td className="p-2 text-slate-300">{formatDbProxyUrl(p)}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded border text-[8px] ${TYPE_COLORS[p.type]}`}>{p.type}</span>
                  </td>
                  <td className="p-2 text-right text-slate-400">
                    {p.status === 'working' && p.latency != null ? `${p.latency}ms` : '—'}
                  </td>
                  <td className="p-2 text-right text-rose-300/80">
                    {p.status === 'offline' ? p.consecutiveOfflineDays : '—'}
                  </td>
                  <td className="p-2 text-right text-slate-500">{formatWhen(p.lastAliveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}