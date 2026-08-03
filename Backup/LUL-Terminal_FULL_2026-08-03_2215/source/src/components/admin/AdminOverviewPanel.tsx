/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, Zap } from 'lucide-react';
import { fetchAdminOverview, type AdminOverview } from '../../lib/analytics';
import { ADMIN_TABS, type AdminTabId } from './AdminShell';

type Props = {
  onNavigate: (tab: AdminTabId) => void;
};

function QuickStat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/30 px-3 py-2.5 text-center">
      <div className="text-[7px] font-mono uppercase text-slate-600 tracking-wider">{label}</div>
      <div className={`text-lg font-mono font-bold tabular-nums ${accent}`}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
    </div>
  );
}

export function AdminOverviewPanel({ onNavigate }: Props) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const next = await fetchAdminOverview();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setOverview(next);
    } catch {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setOverview(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modules = ADMIN_TABS.filter((t) => t.id !== 'overview');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500 max-w-xl leading-relaxed">
          Welcome to the Admin Command Center — one tab, one focus. No more endless scrolling.
          Use the sidebar, keys <span className="text-violet-400">1–9</span>, or <span className="text-violet-400">/</span> to search.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-violet-300"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Live data
        </button>
      </div>

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <QuickStat label="Users" value={overview.totals.users} accent="text-slate-200" />
          <QuickStat label="Online" value={overview.totals.onlineNow} accent="text-emerald-400" />
          <QuickStat label="Active today" value={overview.totals.activeToday} accent="text-cyan-300" />
          <QuickStat label="Visitors" value={overview.visitorIntelligence?.totalProfiles ?? 0} accent="text-violet-300" />
          <QuickStat label="Events" value={overview.totals.eventsStored} accent="text-indigo-300" />
          <QuickStat label="Proxy alive" value={overview.system.proxyAlive} accent="text-teal-300" />
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-amber-400" />
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Module</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className="group text-left p-4 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-black/40 to-black/20 hover:border-violet-500/35 hover:from-violet-500/5 hover:to-black/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{tab.icon}</span>
                <span className="text-[7px] font-mono text-slate-700 group-hover:text-violet-500/80 uppercase">{tab.group}</span>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-200 group-hover:text-violet-100">{tab.label}</div>
              <p className="text-[8px] font-mono text-slate-600 mt-1 leading-relaxed">{tab.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-[8px] font-mono text-violet-400/0 group-hover:text-violet-400/90 transition-colors">
                Open <ArrowRight size={10} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {overview && overview.recentEvents.length > 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-black/25 p-4">
          <h4 className="text-[9px] font-mono font-bold uppercase text-slate-500 mb-2">Recent activity</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {overview.recentEvents.slice(0, 8).map((e) => (
              <div key={e.id} className="text-[8px] font-mono text-slate-600 flex gap-2">
                <span className="text-violet-400/70 shrink-0">{e.type}</span>
                <span className="truncate">{e.username ?? 'guest'}{e.tab ? ` · ${e.tab}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}