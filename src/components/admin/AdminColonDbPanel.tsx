/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { Database, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  adminDeleteColonEntry,
  fetchColonDbEntries,
  fetchColonDbStats,
  type ColonDbEntry,
  type ColonDbStats,
} from '../../lib/adminModules';
import { ToolCard } from '../pages/PageShell';

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
      <div className="text-[7px] font-mono uppercase text-slate-600">{label}</div>
      <div className="text-sm font-mono font-bold text-slate-200">{value}</div>
    </div>
  );
}

export function AdminColonDbPanel() {
  const [stats, setStats] = useState<ColonDbStats | null>(null);
  const [entries, setEntries] = useState<ColonDbEntry[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [website, setWebsite] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const [s, e] = await Promise.all([
        fetchColonDbStats(),
        fetchColonDbEntries({ limit: 200, q: search || undefined, website: website || undefined }),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setStats(s);
      setEntries(e.entries);
      setFilteredTotal(e.total);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, website, loadGenRef, mountedRef]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const websites = useMemo(() => {
    if (!stats?.byWebsite) return [];
    return Object.entries(stats.byWebsite)
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
      .slice(0, 24)
      .map(([name]) => name);
  }, [stats]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this Colon-DB entry?')) return;
    setActing(id);
    try {
      await adminDeleteColonEntry(id);
      setSuccess('Entry deleted');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[9px] font-mono text-slate-500">
        Colon database browser — search U:P tokens by website, stats & delete.
      </p>

      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <StatTile label="Total" value={stats.total.toLocaleString('en-US')} />
          <StatTile label="Websites" value={stats.websites} />
          <StatTile label="Filtered" value={filteredTotal} />
          <StatTile label="Updated" value={stats.updatedAt ? new Date(stats.updatedAt).toLocaleDateString('en-US') : '—'} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search U, P, website…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none"
          />
        </div>
        <select
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 focus:outline-none"
        >
          <option value="">All websites</option>
          {websites.map((w) => (
            <option key={w} value={w}>{w} ({stats?.byWebsite[w]})</option>
          ))}
        </select>
        <button
          type="button"
          title="Refresh"
          aria-label="Refresh"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-violet-300"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}
      {success && <div className="text-[9px] font-mono text-emerald-400">{success}</div>}

      <ToolCard title="Entries" icon="🧬" accent="teal">
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-mono">
            <thead>
              <tr className="text-slate-600 border-b border-slate-800/80">
                <th className="text-left py-2 pr-2">Website</th>
                <th className="text-left py-2 pr-2">U</th>
                <th className="text-left py-2 pr-2">P</th>
                <th className="text-left py-2 pr-2">Seen</th>
                <th className="text-right py-2">Act</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-800/40 hover:bg-white/[0.02]">
                  <td className="py-2 pr-2 text-cyan-300/90 max-w-[120px] truncate" title={e.Website}>{e.Website}</td>
                  <td className="py-2 pr-2 text-slate-300 max-w-[100px] truncate" title={e.U}>{e.U}</td>
                  <td className="py-2 pr-2 text-amber-300/80 max-w-[80px] truncate" title={e.P}>••••</td>
                  <td className="py-2 pr-2 text-slate-500">{e.seenCount ?? 1}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={acting === e.id}
                      onClick={() => void handleDelete(e.id)}
                      className="p-1 rounded border border-rose-500/20 text-rose-400/70 hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-40"
                      title="Delete"
                      aria-label="Delete entry"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
              {!entries.length && !loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-600">
                    <Database size={20} className="mx-auto mb-2 opacity-40" />
                    No entries
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