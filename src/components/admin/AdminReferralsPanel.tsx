/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { Copy, RefreshCw, Rocket, UserPlus } from 'lucide-react';
import {
  fetchAdminReferrals,
  type ReferralLeader,
  type ReferralsAdminData,
} from '../../lib/adminModules';
import { formatRelativeEn } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

function LeaderRow({ leader, rank }: { leader: ReferralLeader; rank: number }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg border border-slate-800/60 bg-black/20 hover:border-slate-700/80">
      <span className="text-sm w-6 text-center shrink-0">{medal}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-mono text-slate-200 truncate">{leader.displayName}</div>
        <div className="text-[7px] font-mono text-slate-600">@{leader.username}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] font-mono font-bold text-emerald-400 tabular-nums">{leader.referralsCount}</div>
        {leader.referralCode && (
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(leader.referralCode)}
            className="text-[7px] font-mono text-violet-400/70 hover:text-violet-300 flex items-center gap-0.5 ml-auto"
          >
            {leader.referralCode} <Copy size={8} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminReferralsPanel() {
  const [data, setData] = useState<ReferralsAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    setLoading(true);
    try {
      const result = await fetchAdminReferrals(50);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [loadGenRef, mountedRef]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500 max-w-xl">
          Referral Network — top referrers, invite codes & recently referred members.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-emerald-300"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Total referrals', value: data.stats.totalReferrals, icon: Rocket, accent: 'text-emerald-400' },
              { label: 'Top referrers', value: data.stats.topReferrers, icon: Rocket, accent: 'text-violet-300' },
              { label: 'With code', value: data.stats.usersWithCode, icon: UserPlus, accent: 'text-cyan-300' },
              { label: 'Referred members', value: data.stats.membersReferred, icon: UserPlus, accent: 'text-amber-300' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-800/80 bg-black/30 px-3 py-2.5 flex items-center gap-2">
                <s.icon size={14} className={`${s.accent} shrink-0`} />
                <div>
                  <div className="text-[7px] font-mono uppercase text-slate-600">{s.label}</div>
                  <div className={`text-base font-mono font-bold ${s.accent}`}>{s.value.toLocaleString('en-US')}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <ToolCard title="Leaderboard" icon="🚀" accent="emerald">
              <div className="space-y-1 max-h-[360px] overflow-y-auto">
                {data.leaders.map((l, i) => (
                  <div key={l.userId}><LeaderRow leader={l} rank={i + 1} /></div>
                ))}
                {!data.leaders.length && (
                  <p className="text-[9px] font-mono text-slate-600 text-center py-6">No referrals yet</p>
                )}
              </div>
            </ToolCard>

            <ToolCard title="Recent referred" icon="✨" accent="cyan">
              <div className="space-y-1 max-h-[360px] overflow-y-auto">
                {data.recentReferred.map((u) => (
                  <div key={u.userId} className="px-2 py-2 rounded-lg border border-slate-800/60 bg-black/20">
                    <div className="text-[9px] font-mono text-slate-300">{u.displayName}</div>
                    <div className="text-[7px] font-mono text-slate-600 flex gap-2 flex-wrap">
                      <span>@{u.username}</span>
                      {u.referredBy && <span className="text-violet-400/80">via @{u.referredBy}</span>}
                      {u.createdAt && <span>{formatRelativeEn(u.createdAt)}</span>}
                    </div>
                  </div>
                ))}
                {!data.recentReferred.length && (
                  <p className="text-[9px] font-mono text-slate-600 text-center py-6">No referred users</p>
                )}
              </div>
            </ToolCard>
          </div>
        </>
      )}
    </div>
  );
}