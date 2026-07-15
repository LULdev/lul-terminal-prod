/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { Globe, MapPin, RefreshCw, Search } from 'lucide-react';
import {
  fetchPersonaEntries,
  fetchPersonaStats,
  type PersonaEntry,
  type PersonaStats,
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

export function AdminPersonaPanel() {
  const [stats, setStats] = useState<PersonaStats | null>(null);
  const [entries, setEntries] = useState<PersonaEntry[]>([]);
  const [entryTotal, setEntryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [selected, setSelected] = useState<PersonaEntry | null>(null);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const [s, e] = await Promise.all([
        fetchPersonaStats(),
        fetchPersonaEntries({ limit: 150, country: country || undefined, q: search || undefined }),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setStats(s);
      setEntries(e.entries);
      setEntryTotal(e.total);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, country, loadGenRef, mountedRef]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const countries = useMemo(() => {
    if (!stats?.byCountry) return [];
    return Object.entries(stats.byCountry)
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
      .map(([name]) => name);
  }, [stats]);

  return (
    <div className="space-y-4">
      <p className="text-[9px] font-mono text-slate-500">
        Persona database — fake identities with real addresses for Identity Lab & demos.
      </p>

      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <StatTile label="Entries" value={stats.total.toLocaleString('en-US')} />
          <StatTile label="Countries" value={stats.countries.length} />
          <StatTile label="Filtered" value={entryTotal} />
          <StatTile label="Updated" value={stats.updatedAt ? new Date(stats.updatedAt).toLocaleDateString('en-US') : '—'} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="City, street, venue…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c} ({stats?.byCountry[c]})</option>
          ))}
        </select>
        <button type="button" onClick={() => void load()} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-violet-300">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <ToolCard title="Addresses" icon="🎭" accent="indigo">
          <div className="space-y-1 max-h-[380px] overflow-y-auto">
            {entries.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelected(e)}
                className={`w-full text-left px-2 py-1.5 rounded-lg border transition-all ${
                  selected?.id === e.id
                    ? 'border-indigo-500/40 bg-indigo-500/10'
                    : 'border-transparent hover:border-slate-700/80 hover:bg-white/[0.02]'
                }`}
              >
                <div className="text-[9px] font-mono text-slate-300 truncate">{e.venue ?? e.street}</div>
                <div className="text-[7px] font-mono text-slate-600">{e.city}, {e.country}</div>
              </button>
            ))}
            {!entries.length && !loading && (
              <p className="text-[9px] font-mono text-slate-600 text-center py-6">No entries</p>
            )}
          </div>
        </ToolCard>

        {selected ? (
          <div className="lg:col-span-2 rounded-2xl border border-indigo-500/20 bg-black/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-indigo-400" />
              <h4 className="text-[11px] font-mono font-bold text-slate-200">{selected.venue ?? 'Persona'}</h4>
            </div>
            <div className="flex items-start gap-2 text-[9px] font-mono text-slate-400">
              <MapPin size={12} className="text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div>{selected.street}</div>
                <div>{selected.zip} {selected.city}</div>
                <div className="text-indigo-300">{selected.country}</div>
                {selected.address && <div className="text-slate-600 mt-1">{selected.address}</div>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[8px] font-mono text-slate-600">
              <div>ID: <span className="text-slate-400">{selected.id}</span></div>
              <div>TZ: <span className="text-slate-400">{selected.timezone ?? '—'}</span></div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-black/20 p-8 flex items-center justify-center text-[9px] font-mono text-slate-600">
            Select an entry for details
          </div>
        )}
      </div>
    </div>
  );
}