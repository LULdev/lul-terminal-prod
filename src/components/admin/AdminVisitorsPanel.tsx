/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { Globe, RefreshCw, Search, User } from 'lucide-react';
import {
  fetchAdminVisitors,
  type VisitorProfileRow,
  type VisitorsAdminData,
} from '../../lib/adminModules';
import { formatRelativeEn } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

export function AdminVisitorsPanel() {
  const [data, setData] = useState<VisitorsAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<VisitorProfileRow | null>(null);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const result = await fetchAdminVisitors({ limit: 100, q: search || undefined });
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, loadGenRef, mountedRef]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div className="space-y-4">
      <p className="text-[9px] font-mono text-slate-500">
        Visitor Directory — session profiles, referrer, return visits & device intel.
      </p>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Profiles', value: data.overview.totalProfiles },
            { label: 'Active 24h', value: data.overview.activeLast24h, accent: 'text-emerald-400' },
            { label: 'Return visitors', value: data.overview.returnVisitorCount, accent: 'text-violet-300' },
            { label: 'Avg visits', value: data.overview.avgVisitsPerVisitor, accent: 'text-cyan-300' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
              <div className="text-[7px] font-mono uppercase text-slate-600">{s.label}</div>
              <div className={`text-sm font-mono font-bold ${s.accent ?? 'text-slate-200'}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="User, Guest-ID, Referrer, UTM…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <button type="button" onClick={() => void load()} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-violet-300">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <ToolCard title="Visitors" icon="🛰️" accent="violet">
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {(data?.profiles ?? []).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelected(p)}
                className={`w-full text-left px-2 py-2 rounded-lg border transition-all ${
                  selected?.key === p.key
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : 'border-transparent hover:border-slate-700/80 hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[9px] font-mono">
                  <User size={10} className="text-violet-400/70 shrink-0" />
                  <span className="text-slate-300 truncate">{p.username ?? p.key}</span>
                  {p.returnVisitor && <span className="text-[7px] text-emerald-400/80">↩</span>}
                </div>
                <div className="text-[7px] font-mono text-slate-600 pl-4">
                  #{p.visitCount} · {p.lastReferrerDomain} · {formatRelativeEn(p.lastSeenAt)}
                </div>
              </button>
            ))}
            {!data?.profiles.length && !loading && (
              <p className="text-[9px] font-mono text-slate-600 text-center py-6">No profiles</p>
            )}
          </div>
        </ToolCard>

        {selected ? (
          <div className="lg:col-span-2 rounded-2xl border border-violet-500/20 bg-black/30 p-4 space-y-3">
            <h4 className="text-[11px] font-mono font-bold text-slate-200 flex items-center gap-2">
              <Globe size={14} className="text-violet-400" />
              {selected.username ?? selected.key}
            </h4>
            <div className="grid sm:grid-cols-2 gap-2 text-[8px] font-mono">
              {[
                ['Key', selected.key],
                ['Visits', String(selected.visitCount)],
                ['Sessions', String(selected.sessionCount)],
                ['Device', selected.deviceType],
                ['Language', selected.language || '—'],
                ['Timezone', selected.timezone || '—'],
                ['Referrer', selected.lastReferrerDomain],
                ['Landing', selected.lastLandingPath || '—'],
                ['UTM', selected.utmSource || '—'],
                ['Ref code', selected.refCode || '—'],
                ['First seen', formatRelativeEn(selected.firstSeenAt)],
                ['Last seen', formatRelativeEn(selected.lastSeenAt)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-800/60 bg-black/20 px-2 py-1.5">
                  <div className="text-slate-600 uppercase text-[7px]">{k}</div>
                  <div className="text-slate-300 truncate" title={v}>{v}</div>
                </div>
              ))}
            </div>
            {selected.lastReferrer && (
              <div className="text-[7px] font-mono text-slate-600 break-all">
                Full referrer: {selected.lastReferrer}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-black/20 p-8 flex items-center justify-center text-[9px] font-mono text-slate-600">
            Select a visitor for intel details
          </div>
        )}
      </div>
    </div>
  );
}