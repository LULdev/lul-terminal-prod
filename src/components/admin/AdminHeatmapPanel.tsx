/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { RefreshCw } from 'lucide-react';
import { fetchAdminHeatmap, type HeatmapData } from '../../lib/adminModules';
import { ToolCard } from '../pages/PageShell';

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[8px] font-mono">
        <span className="text-slate-400 truncate pr-2">{label}</span>
        <span className="text-violet-300 tabular-nums">{value.toLocaleString('en-US')}</span>
      </div>
      <div className="h-1 rounded-full bg-slate-800/80"><div className="h-full rounded-full bg-violet-500/50" style={{ width: `${Math.max(pct, value ? 3 : 0)}%` }} /></div>
    </div>
  );
}

export function AdminHeatmapPanel() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const result = await fetchAdminHeatmap();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
    } catch {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [loadGenRef, mountedRef]);

  useEffect(() => { void load(); }, [load]);

  const maxTab = data?.tabHits[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-between"><p className="text-[9px] font-mono text-slate-500">Tab Heatmap — tab hits, dwell time & visitor aggregates.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button></div>
      {data && (
        <div className="grid lg:grid-cols-3 gap-4">
          <ToolCard title="Tab hits" icon="🗺️" accent="violet">
            <div className="space-y-1.5 max-h-72 overflow-y-auto">{data.tabHits.slice(0, 20).map((t) => <div key={t.tab}><Bar label={t.tab} value={t.count} max={maxTab} /></div>)}</div>
          </ToolCard>
          <ToolCard title="Dwell time" icon="⏱️" accent="cyan">
            <div className="space-y-1.5 max-h-72 overflow-y-auto">{data.dwellByTab.slice(0, 15).map((t) => (
              <div key={t.tab} className="text-[8px] font-mono flex justify-between"><span className="text-slate-400">{t.tab}</span><span className="text-cyan-300">{t.totalSec}s · ø{t.avgSec}s</span></div>
            ))}</div>
          </ToolCard>
          <ToolCard title="Visitor agg" icon="🛰️" accent="emerald">
            <div className="text-[8px] font-mono space-y-2">
              <div className="flex gap-4"><span className="text-slate-600">Return</span><span className="text-emerald-400">{data.visitorAggregates.returnVisits}</span><span className="text-slate-600">New</span><span className="text-cyan-300">{data.visitorAggregates.newVisits}</span></div>
              <div className="text-[7px] uppercase text-slate-600">Referrers</div>
              {data.visitorAggregates.topReferrerDomains.slice(0, 8).map((r) => <div key={r.key} className="flex justify-between"><span className="text-slate-500 truncate">{r.key}</span><span>{r.count}</span></div>)}
            </div>
          </ToolCard>
        </div>
      )}
    </div>
  );
}