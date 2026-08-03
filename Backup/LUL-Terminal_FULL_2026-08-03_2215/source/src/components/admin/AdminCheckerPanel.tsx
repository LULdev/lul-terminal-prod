/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAdminChecker, type CheckerDashboardData } from '../../lib/adminModules';
import { formatRelativeEn } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

export function AdminCheckerPanel() {
  const [data, setData] = useState<CheckerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const result = await fetchAdminChecker();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
    } catch {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const lastCheck = data?.state.lastCheckAt as number | null | undefined;

  return (
    <div className="space-y-4">
      <div className="flex justify-between"><p className="text-[9px] font-mono text-slate-500">Checker Dashboard — Last-Check Results & Latency.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button></div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ l: 'Alive', v: data.results.alive, c: 'text-emerald-400' }, { l: 'Dead', v: data.results.dead, c: 'text-rose-400' }, { l: 'Checked', v: data.results.total }, { l: 'Avg ms', v: Math.round(data.results.avgLatency), c: 'text-cyan-300' }].map((s) => (
              <div key={s.l} className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
                <div className="text-[7px] font-mono uppercase text-slate-600">{s.l}</div>
                <div className={`text-sm font-mono font-bold ${s.c ?? 'text-slate-200'}`}>{s.v}</div>
              </div>
            ))}
          </div>
          {lastCheck && <div className="text-[8px] font-mono text-slate-600">Last check: {formatRelativeEn(lastCheck)} · DB added: {String(data.state.databaseAdded ?? 0)}</div>}
          <ToolCard title="Sample results" icon="✅" accent="emerald">
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-[8px] font-mono">
                <thead><tr className="text-slate-600"><th className="text-left py-1">Proxy</th><th className="text-left">Status</th><th className="text-right">ms</th></tr></thead>
                <tbody>{data.results.sample.map((p, i) => (
                  <tr key={`${p.host}-${i}`} className="border-t border-slate-800/40">
                    <td className="py-1 text-slate-400 truncate max-w-[140px]">{p.raw}</td>
                    <td className={p.alive ? 'text-emerald-400' : 'text-rose-400'}>{p.alive ? 'alive' : 'dead'}</td>
                    <td className="text-right text-slate-500">{p.latency ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </ToolCard>
        </>
      )}
    </div>
  );
}