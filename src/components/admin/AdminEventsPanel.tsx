/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { adminExportEvents, adminPurgeEvents, fetchAdminEvents, type EventsOpsData } from '../../lib/adminModules';
import { formatRelativeEn } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

export function AdminEventsPanel() {
  const [data, setData] = useState<EventsOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const result = await fetchAdminEvents();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [loadGenRef, mountedRef]);

  useEffect(() => { void load(); }, [load]);

  const purge = async () => {
    if (!confirm('Trim old events (keep 2000)?')) return;
    try {
      const r = await adminPurgeEvents(2000);
      setSuccess(`Removed ${r.removed} events`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Purge failed'); }
  };

  const exportJson = async () => {
    try {
      const bundle = await adminExportEvents();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `analytics-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500">Event Ops — event log, type stats, purge & export.</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => void exportJson()} className="px-2 py-1 rounded border border-slate-700 text-[8px] font-mono text-slate-400 hover:text-cyan-300"><Download size={10} /></button>
          <button type="button" onClick={() => void purge()} className="px-2 py-1 rounded border border-rose-500/30 text-[8px] font-mono text-rose-400 hover:bg-rose-500/10"><Trash2 size={10} /></button>
          <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}
      {success && <div className="text-[9px] font-mono text-emerald-400">{success}</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ l: 'Stored', v: data.stats.stored }, { l: 'Capacity', v: data.stats.maxCapacity }, { l: 'Types', v: data.stats.types }, { l: 'Newest', v: data.stats.newestTs ? formatRelativeEn(data.stats.newestTs) : '—' }].map((s) => (
              <div key={s.l} className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
                <div className="text-[7px] font-mono uppercase text-slate-600">{s.l}</div>
                <div className="text-sm font-mono font-bold text-slate-200">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ToolCard title="Event types" icon="📊" accent="indigo">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {data.typeCounts.map((t) => (
                  <div key={t.type} className="flex justify-between text-[8px] font-mono">
                    <span className="text-violet-300">{t.type}</span><span className="text-slate-400">{t.count}</span>
                  </div>
                ))}
              </div>
            </ToolCard>
            <ToolCard title="Recent events" icon="⚡" accent="cyan">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {data.recentEvents.slice(0, 30).map((e) => (
                  <div key={e.id} className="text-[8px] font-mono text-slate-500 flex gap-2">
                    <span className="text-cyan-400/80 shrink-0">{e.type}</span>
                    <span className="truncate">{e.username ?? 'guest'}{e.tab ? ` · ${e.tab}` : ''}</span>
                    <span className="shrink-0 text-slate-700">{formatRelativeEn(e.ts)}</span>
                  </div>
                ))}
              </div>
            </ToolCard>
          </div>
        </>
      )}
    </div>
  );
}