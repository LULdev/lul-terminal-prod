/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Play, RefreshCw, Server } from 'lucide-react';
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
import { ToolCard } from '../pages/PageShell';

const TYPES: ProxyType[] = ['http', 'https', 'socks4', 'socks5'];

function StatTile({ label, value, accent = 'text-slate-200' }: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
      <div className="text-[7px] font-mono uppercase text-slate-600">{label}</div>
      <div className={`text-sm font-mono font-bold ${accent}`}>{value}</div>
    </div>
  );
}

export function AdminProxyDbPanel() {
  const [stats, setStats] = useState<ProxyDatabaseStats | null>(null);
  const [proxies, setProxies] = useState<DatabaseProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'working' | 'offline'>('working');
  const [typeFilter, setTypeFilter] = useState<ProxyType | 'all'>('all');
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
      const [s, lists] = await Promise.all([
        fetchProxyDatabaseStats(),
        fetchProxyDatabaseLists(statusFilter === 'all' ? 'all' : statusFilter),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setStats(s);
      let flat = TYPES.flatMap((t) => lists.lists[t] ?? []);
      if (typeFilter !== 'all') flat = flat.filter((p) => p.type === typeFilter);
      flat.sort((a, b) => (a.latency ?? 99999) - (b.latency ?? 99999));
      setProxies(flat.slice(0, 200));
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const runCheck = async () => {
    setChecking(true);
    setError('');
    try {
      const r = await runProxyDailyCheck(true);
      setSuccess(r.skipped ? `Skipped: ${r.reason}` : `Checked ${r.checked} · ${r.working} alive`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([exportDbTxt(proxies, statusFilter !== 'offline')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proxy-db-${statusFilter}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500 max-w-xl">
          Proxy DB Inspector — persisted proxies, latency ranking, Daily-Check & Export.
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={checking}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-teal-500/30 text-[9px] font-mono text-teal-300 hover:bg-teal-500/10 disabled:opacity-50"
          >
            <Play size={11} /> {checking ? 'Checking…' : 'Daily check'}
          </button>
          <button
            type="button"
            onClick={downloadTxt}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-cyan-300"
          >
            <Download size={11} /> Export
          </button>
          <button type="button" onClick={() => void load()} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-violet-300">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <StatTile label="In DB" value={stats.inDatabase} accent="text-cyan-300" />
          <StatTile label="Working" value={stats.working} accent="text-emerald-400" />
          <StatTile label="Offline" value={stats.currentlyOffline} accent="text-rose-400" />
          <StatTile label="Collected" value={stats.totalCollected} />
          <StatTile label="Purged" value={stats.totalRemovedStale} accent="text-amber-300" />
          <StatTile label="Check due" value={stats.nextDailyCheckDue ? 'Yes' : 'No'} accent={stats.nextDailyCheckDue ? 'text-amber-400' : 'text-emerald-400'} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'working', 'offline'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full border text-[8px] font-mono ${
              statusFilter === s ? 'border-teal-500/40 bg-teal-500/10 text-teal-200' : 'border-slate-800 text-slate-500'
            }`}
          >
            {s}
          </button>
        ))}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ProxyType | 'all')}
          className="px-3 py-1 rounded-lg border border-slate-800 bg-black/40 text-[9px] font-mono text-slate-300"
        >
          <option value="all">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}
      {success && <div className="text-[9px] font-mono text-emerald-400">{success}</div>}

      <ToolCard title="Proxy list" icon="🌐" accent="teal">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-[8px] font-mono">
            <thead className="sticky top-0 bg-[#161a24]">
              <tr className="text-slate-600 border-b border-slate-800/80">
                <th className="text-left py-2 pr-2">Proxy</th>
                <th className="text-left py-2 pr-2">Type</th>
                <th className="text-left py-2 pr-2">Status</th>
                <th className="text-right py-2">ms</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/30 hover:bg-white/[0.02]">
                  <td className="py-1.5 pr-2 text-slate-400 truncate max-w-[200px]" title={formatDbProxyUrl(p)}>
                    {p.host}:{p.port}
                  </td>
                  <td className="py-1.5 pr-2 text-cyan-300/80">{p.type}</td>
                  <td className={`py-1.5 pr-2 ${p.status === 'working' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {p.status}
                  </td>
                  <td className="py-1.5 text-right text-slate-500 tabular-nums">{p.latency ?? '—'}</td>
                </tr>
              ))}
              {!proxies.length && !loading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-600">
                    <Server size={20} className="mx-auto mb-2 opacity-40" />
                    No proxies
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ToolCard>
    </div>
  );
}