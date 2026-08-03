/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { HardDrive, RefreshCw } from 'lucide-react';
import { fetchAdminStorage, type StorageMapData } from '../../lib/adminModules';
import { formatBytes } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

export function AdminStoragePanel() {
  const [data, setData] = useState<StorageMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const result = await fetchAdminStorage();
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

  const maxBytes = data?.stores[0]?.bytes ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-between"><p className="text-[9px] font-mono text-slate-500">Storage Explorer — data directories & file sizes.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button></div>
      {data && (
        <>
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3 flex items-center gap-3">
            <HardDrive size={20} className="text-teal-400" />
            <div>
              <div className="text-[7px] font-mono uppercase text-slate-600">Total data footprint</div>
              <div className="text-xl font-mono font-bold text-teal-300">{formatBytes(data.totals.bytes)}</div>
              <div className="text-[8px] font-mono text-slate-600">{data.totals.files.toLocaleString('en-US')} files · {data.totals.stores} stores</div>
            </div>
          </div>
          <ToolCard title="Stores" icon="💾" accent="teal">
            <div className="space-y-2">
              {data.stores.map((s) => {
                const pct = maxBytes > 0 ? Math.round((s.bytes / maxBytes) * 100) : 0;
                return (
                  <div key={s.id}>
                    <div className="flex justify-between text-[8px] font-mono mb-0.5">
                      <span className="text-slate-300">{s.label}</span>
                      <span className="text-teal-300">{formatBytes(s.bytes)} · {s.files} files</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800/80"><div className="h-full rounded-full bg-gradient-to-r from-teal-600/60 to-cyan-500/50" style={{ width: `${Math.max(pct, s.bytes ? 4 : 0)}%` }} /></div>
                    <div className="text-[6px] font-mono text-slate-700 mt-0.5">{s.path}</div>
                  </div>
                );
              })}
            </div>
          </ToolCard>
        </>
      )}
    </div>
  );
}