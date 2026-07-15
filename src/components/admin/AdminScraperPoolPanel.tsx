/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAdminScraperPool, type ScraperPoolData } from '../../lib/adminModules';
import { formatRelativeEn } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

export function AdminScraperPoolPanel() {
  const [data, setData] = useState<ScraperPoolData | null>(null);
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
      const result = await fetchAdminScraperPool();
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between"><p className="text-[9px] font-mono text-slate-500">Scraper Pool — proxy sources, merge pool & last scrape.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button></div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ l: 'Pool', v: data.pool.poolCount, c: 'text-cyan-300' }, { l: 'Scraped', v: data.pool.scrapedCount }, { l: 'Custom', v: data.pool.customCount, c: 'text-violet-300' }, { l: 'Sources', v: `${data.sources.enabled}/${data.sources.total}`, c: 'text-emerald-400' }].map((s) => (
              <div key={s.l} className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
                <div className="text-[7px] font-mono uppercase text-slate-600">{s.l}</div>
                <div className={`text-sm font-mono font-bold ${s.c ?? 'text-slate-200'}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ToolCard title="Pool status" icon="🕸️" accent="teal">
              <div className="text-[8px] font-mono space-y-1 text-slate-500">
                <div>Checked alive: <span className="text-emerald-400">{data.pool.checkedAlive}</span> / {data.pool.checkedTotal}</div>
                <div>Dedup removed: {data.pool.dedupRemoved}</div>
                <div>Last scrape: {data.pool.scrapedAt != null ? formatRelativeEn(typeof data.pool.scrapedAt === 'number' ? data.pool.scrapedAt : new Date(data.pool.scrapedAt).getTime()) : '—'}</div>
                <div>Sources OK: <span className="text-cyan-300">{String(data.state.sourcesOk ?? 0)}</span> · Failed: {String(data.state.sourcesFailed ?? 0)}</div>
              </div>
            </ToolCard>
            <ToolCard title="Sample proxies" icon="📋" accent="cyan">
              <div className="text-[7px] font-mono text-slate-600 space-y-0.5 max-h-32 overflow-y-auto">
                {(data.pool.sample ?? []).slice(0, 12).map((p) => (
                  <div key={p} className="truncate text-slate-400">{p}</div>
                ))}
                {!(data.pool.sample ?? []).length && <p className="text-slate-600">No samples</p>}
              </div>
            </ToolCard>
          </div>
        </>
      )}
    </div>
  );
}