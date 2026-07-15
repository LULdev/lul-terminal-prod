/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { fetchAdminChangelog, type ChangelogConsoleData } from '../../lib/adminModules';
import { ToolCard } from '../pages/PageShell';

export function AdminChangelogPanel() {
  const [data, setData] = useState<ChangelogConsoleData | null>(null);
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
      const next = await fetchAdminChangelog();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(next);
    } catch {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between"><p className="text-[9px] font-mono text-slate-500">Changelog Console — release history from changelog.ts.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button></div>
      {data && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
              <div className="text-[7px] font-mono uppercase text-slate-600">Total releases</div>
              <div className="text-2xl font-mono font-bold text-violet-300">{data.totalReleases}</div>
            </div>
            {data.latest && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="text-[7px] font-mono uppercase text-slate-600">Latest</div>
                <div className="text-lg font-mono font-bold text-amber-300">v{data.latest.version}</div>
                <div className="text-[8px] font-mono text-slate-500 truncate">{data.latest.title}</div>
              </div>
            )}
          </div>
          <ToolCard title="Releases" icon="📜" accent="violet">
            <div className="space-y-1 max-h-[420px] overflow-y-auto">
              {data.releases.map((r) => (
                <div key={r.version} className={`flex items-start gap-2 px-2 py-2 rounded-lg border ${r.highlight ? 'border-amber-500/25 bg-amber-500/5' : 'border-slate-800/50 bg-black/20'}`}>
                  <span className="text-[10px] font-mono font-bold text-violet-300 shrink-0">v{r.version}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-mono text-slate-300 truncate">{r.title}</div>
                    <div className="text-[7px] font-mono text-slate-600">{r.date} · {r.itemCount} items</div>
                  </div>
                  {r.highlight && <Sparkles size={12} className="text-amber-400 shrink-0" />}
                </div>
              ))}
            </div>
          </ToolCard>
        </>
      )}
    </div>
  );
}