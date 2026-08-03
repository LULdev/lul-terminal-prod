/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { fetchAdminReports, type ReportsDeskData } from '../../lib/adminModules';
import { formatRelativeEn } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-amber-400',
  accepted: 'text-emerald-400',
  rejected: 'text-rose-400',
};

export function AdminReportsPanel() {
  const [data, setData] = useState<ReportsDeskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const result = await fetchAdminReports();
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

  const reports = (data?.reports ?? []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500">Reports Desk — vault report history (pending/accepted/rejected).</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      {data && (
        <>
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'accepted', 'rejected'].map((s) => (
              <button key={s} type="button" onClick={() => setFilter(s)} className={`px-3 py-1 rounded-full border text-[8px] font-mono capitalize ${filter === s ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-slate-800 text-slate-500'}`}>
                {s} {s !== 'all' ? `(${data.stats[s] ?? 0})` : `(${data.total})`}
              </button>
            ))}
          </div>
          <ToolCard title="Reports" icon="🚩" accent="rose">
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {reports.map((r) => (
                <div key={r.id} className="px-2 py-2 rounded-lg border border-slate-800/60 bg-black/20 text-[8px] font-mono">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={STATUS_STYLE[r.status] ?? 'text-slate-400'}>{r.status}</span>
                    <span className="text-slate-300">{r.account?.service ?? 'deleted'}</span>
                    <span className="text-slate-600">by @{r.reportedByUsername}</span>
                    <span className="text-slate-700 ml-auto">{formatRelativeEn(r.createdAt)}</span>
                  </div>
                  {r.note && <p className="text-slate-600 mt-1">{r.note}</p>}
                </div>
              ))}
              {!reports.length && <p className="text-center text-slate-600 py-6">No reports</p>}
            </div>
          </ToolCard>
        </>
      )}
    </div>
  );
}