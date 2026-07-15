/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Server, XCircle } from 'lucide-react';
import { formatRelativeEn } from '../../lib/terminalStats';
import {
  fetchSystemStatus,
  formatUptime,
  OVERALL_META,
  STATUS_META,
  type ServiceStatus,
  type StatusCheck,
  type SystemStatus,
} from '../../lib/status';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { PageShell } from './PageShell';
import { GreenPulseDot } from '../ui/GreenPulseDot';

function StatusDot({ status }: { status: ServiceStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {status === 'operational' && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-40`} />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${meta.dot}`} />
    </span>
  );
}

function SummaryTile({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/30 px-3 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[7px] font-mono uppercase text-slate-600 tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-mono font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function CheckRow({ check }: { check: StatusCheck }) {
  const meta = STATUS_META[check.status];
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-black/20 ${meta.border} hover:bg-white/[0.02] transition-colors`}
    >
      <span className="text-base shrink-0">{check.icon}</span>
      <StatusDot status={check.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-200">{check.label}</span>
          <span className={`text-[7px] font-mono uppercase px-1.5 py-0.5 rounded border ${meta.border} ${meta.text}`}>
            {meta.label}
          </span>
        </div>
        <div className="text-[8px] font-mono text-slate-500 truncate mt-0.5">{check.message}</div>
      </div>
      {check.metric && (
        <span className="text-[9px] font-mono text-slate-400 shrink-0 hidden sm:block">{check.metric}</span>
      )}
      <span className="text-[8px] font-mono text-slate-600 shrink-0 tabular-nums">{check.latencyMs}ms</span>
    </div>
  );
}

export function StatusPage() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setErr('');
    try {
      const next = await fetchSystemStatus();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(next);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setErr(e instanceof Error ? e.message : 'Failed to load status');
      setData(null);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useVisibilityAwarePoll(() => { void load(); }, 30_000);

  const overall = data ? OVERALL_META[data.summary.overall] : null;

  return (
    <PageShell
      id="system-status-module"
      pageId="status"
      icon="📟"
      title="System Status"
      subtitle="Live health checks · all services · auto-refresh 30s"
      accentClass="text-emerald-400"
    >
      <div className="space-y-5 max-w-5xl">
        {overall && data && (
          <div
            className={`rounded-2xl border border-slate-800/80 bg-gradient-to-r ${overall.bg} via-[#0c0d12] to-slate-950/50 p-4 relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="relative flex flex-wrap items-center gap-4">
              {data.summary.overall === 'operational' ? (
                <CheckCircle2 size={28} className={overall.accent} />
              ) : data.summary.down > 0 ? (
                <XCircle size={28} className={overall.accent} />
              ) : (
                <AlertTriangle size={28} className={overall.accent} />
              )}
              <div>
                <div className={`text-sm font-mono font-bold ${overall.accent}`}>{overall.label}</div>
                <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                  {data.summary.operational}/{data.summary.total} services healthy
                  {data.summary.degraded > 0 && ` · ${data.summary.degraded} degraded`}
                  {data.summary.down > 0 && ` · ${data.summary.down} down`}
                </div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-[8px] font-mono text-slate-600">
                <span className="flex items-center gap-1.5">
                  <GreenPulseDot />
                  v{data.version}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  Uptime {formatUptime(data.uptimeSec)}
                </span>
                <span className="flex items-center gap-1">
                  <Activity size={10} />
                  Avg {data.summary.avgLatencyMs}ms
                </span>
                <span>Updated {formatRelativeEn(data.generatedAt)}</span>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-emerald-300"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        )}

        {err && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[10px] font-mono text-rose-300">
            {err}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SummaryTile
                label="Operational"
                value={data.summary.operational}
                accent="text-emerald-400"
                icon={<CheckCircle2 size={10} className="text-emerald-500" />}
              />
              <SummaryTile
                label="Degraded"
                value={data.summary.degraded}
                accent="text-amber-300"
                icon={<AlertTriangle size={10} className="text-amber-500" />}
              />
              <SummaryTile
                label="Down"
                value={data.summary.down}
                accent="text-rose-300"
                icon={<XCircle size={10} className="text-rose-500" />}
              />
              <SummaryTile
                label="Avg latency"
                value={`${data.summary.avgLatencyMs}ms`}
                accent="text-cyan-300"
                icon={<Server size={10} className="text-cyan-500" />}
              />
            </div>

            <div className="space-y-4">
              {data.groups.map((group) => {
                const op = group.checks.filter((c) => c.status === 'operational').length;
                const groupOk = op === group.checks.length;
                return (
                  <section key={group.id} className="rounded-2xl border border-slate-800/80 bg-black/20 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/30">
                      <div className="flex items-center gap-2">
                        <StatusDot status={groupOk ? 'operational' : group.checks.some((c) => c.status === 'down') ? 'down' : 'degraded'} />
                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                          {group.label}
                        </h3>
                      </div>
                      <span className="text-[8px] font-mono text-slate-600">
                        {op}/{group.checks.length} OK
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {group.checks.map((check) => (
                        <div key={check.id}>
                          <CheckRow check={check} />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="text-[8px] font-mono text-slate-600 text-center pb-2">
              Probes run server-side against live data stores · no synthetic uptime claims
            </p>
          </>
        )}

        {loading && !data && !err && (
          <div className="flex items-center justify-center py-16 text-[10px] font-mono text-slate-500">
            <RefreshCw size={14} className="animate-spin mr-2" />
            Running health checks…
          </div>
        )}
      </div>
    </PageShell>
  );
}