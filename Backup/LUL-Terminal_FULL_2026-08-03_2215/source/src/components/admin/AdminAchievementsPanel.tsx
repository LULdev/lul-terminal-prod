/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { fetchAdminAchievements, type AchievementsAdminData } from '../../lib/adminModules';
import { ToolCard } from '../pages/PageShell';

export function AdminAchievementsPanel() {
  const [data, setData] = useState<AchievementsAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const result = await fetchAdminAchievements();
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between"><p className="text-[9px] font-mono text-slate-500">Achievements Hub — unlock stats & member leaderboard.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button></div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ l: 'Unlocked', v: data.stats.totalUnlocked, c: 'text-amber-300' }, { l: 'Types', v: data.stats.uniqueTypes, c: 'text-violet-300' }, { l: 'Members', v: data.stats.membersWithAny, c: 'text-emerald-400' }, { l: 'Avg/Member', v: data.stats.avgPerMember, c: 'text-cyan-300' }].map((s) => (
              <div key={s.l} className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
                <div className="text-[7px] font-mono uppercase text-slate-600">{s.l}</div>
                <div className={`text-sm font-mono font-bold ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ToolCard title="Popular badges" icon="🎖️" accent="amber">
              <div className="space-y-1 max-h-64 overflow-y-auto">{data.byAchievement.slice(0, 25).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[8px] font-mono">
                  <span>{a.icon}</span><span className="text-slate-300 truncate flex-1">{a.name}</span><span className="text-amber-300">{a.count}</span>
                </div>
              ))}</div>
            </ToolCard>
            <ToolCard title="Top collectors" icon="🏆" accent="violet">
              <div className="space-y-1 max-h-64 overflow-y-auto">{data.leaders.slice(0, 20).map((u, i) => (
                <div key={u.userId} className="flex items-center gap-2 text-[8px] font-mono px-1 py-1 rounded hover:bg-white/[0.02]">
                  <span className="text-slate-600 w-4">#{i + 1}</span>
                  <span className="text-slate-200 truncate flex-1">{u.displayName}</span>
                  <span className="text-violet-300 font-bold">{u.count}</span>
                </div>
              ))}</div>
            </ToolCard>
          </div>
        </>
      )}
    </div>
  );
}