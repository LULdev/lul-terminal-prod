/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAdminAvatars, type AvatarsAdminData } from '../../lib/adminModules';
import { formatBytes, formatRelativeEn } from '../../lib/terminalStats';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { ToolCard } from '../pages/PageShell';

export function AdminAvatarsPanel() {
  const [data, setData] = useState<AvatarsAdminData | null>(null);
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
      const result = await fetchAdminAvatars();
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
      <div className="flex justify-between"><p className="text-[9px] font-mono text-slate-500">Avatar CDN — hosted profile images on disk.</p>
        <button type="button" onClick={() => void load()} className="px-2 py-1 rounded border border-slate-700 text-slate-400"><RefreshCw size={10} className={loading ? 'animate-spin' : ''} /></button></div>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center"><div className="text-[7px] font-mono uppercase text-slate-600">On disk</div><div className="text-sm font-mono font-bold text-slate-200">{data.stats.onDisk}</div></div>
            <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center"><div className="text-[7px] font-mono uppercase text-slate-600">Storage</div><div className="text-sm font-mono font-bold text-orange-300">{formatBytes(data.stats.totalBytes)}</div></div>
            <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center"><div className="text-[7px] font-mono uppercase text-slate-600">Members</div><div className="text-sm font-mono font-bold text-cyan-300">{data.stats.membersWithAvatar}</div></div>
          </div>
          <ToolCard title="Avatars" icon="🎨" accent="rose">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[400px] overflow-y-auto">
              {data.avatars.map((a) => (
                <div key={a.userId} className="text-center group">
                  <img src={safeAvatarUrl(a.url, a.username ?? a.userId)} alt={a.username ?? a.userId} className="w-12 h-12 rounded-full border border-slate-800 object-cover mx-auto group-hover:border-violet-500/40" loading="lazy" />
                  <div className="text-[6px] font-mono text-slate-600 truncate mt-0.5">@{a.username ?? '?'}</div>
                  <div className="text-[6px] font-mono text-slate-700">{formatRelativeEn(a.updatedAt)}</div>
                </div>
              ))}
              {!data.avatars.length && <p className="col-span-full text-[9px] text-slate-600 text-center py-6">No avatars</p>}
            </div>
          </ToolCard>
        </>
      )}
    </div>
  );
}