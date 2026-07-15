/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, RefreshCw } from 'lucide-react';
import { fetchAdminOnline, type OnlineRadarData } from '../../lib/adminModules';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { formatRelativeEn } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

export function AdminOnlinePanel() {
  const [data, setData] = useState<OnlineRadarData | null>(null);
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
      const next = await fetchAdminOnline();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(next);
    } catch {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useVisibilityAwarePoll(load, 20_000);

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500">Online Radar — Live-Members & Active-Today · Refresh 20s.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-center">
              <div className="text-[7px] font-mono uppercase text-slate-600">Online now</div>
              <div className="text-xl font-mono font-bold text-emerald-400">{data.stats.onlineCount}</div>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-black/25 px-3 py-2 text-center">
              <div className="text-[7px] font-mono uppercase text-slate-600">Active today</div>
              <div className="text-xl font-mono font-bold text-cyan-300">{data.stats.activeTodayCount}</div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
              <div className="text-[7px] font-mono uppercase text-slate-600">Registered</div>
              <div className="text-xl font-mono font-bold text-slate-200">{data.stats.registered}</div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ToolCard title="Online now" icon="🟢" accent="emerald">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.onlineNow.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20 text-[9px] font-mono">
                    <Circle size={8} className="text-emerald-400 fill-emerald-400/30" />
                    <span className="text-slate-200 truncate flex-1">{u.displayName}</span>
                    <span className="text-slate-600">@{u.username}</span>
                    <span className="text-violet-400/70">{u.role}</span>
                  </div>
                ))}
                {!data.onlineNow.length && <p className="text-[9px] text-slate-600 text-center py-4">Niemand online</p>}
              </div>
            </ToolCard>
            <ToolCard title="Active today" icon="📡" accent="cyan">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.activeToday.users.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] text-[8px] font-mono">
                    <span className={u.isOnline ? 'text-emerald-400' : 'text-slate-600'}>{u.isOnline ? '●' : '○'}</span>
                    <span className="text-slate-300 truncate flex-1">@{u.username}</span>
                    <span className="text-slate-600">{u.lastSeenAt ? formatRelativeEn(u.lastSeenAt) : '—'}</span>
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