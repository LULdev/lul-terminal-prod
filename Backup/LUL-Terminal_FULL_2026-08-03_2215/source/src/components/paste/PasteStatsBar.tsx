/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePasteStats } from '../../hooks/usePasteStats';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { useAuth } from '../../context/AuthContext';
import { fetchMyPasteStats, formatPasteBytes, type MyPasteStats } from '../../lib/paste';
import { languageLabel, visibilityLabel } from '../../data/pasteLanguages';

export function PasteStatsBar() {
  const { pastesCreated, pasteViewsTotal, activePastes } = usePasteStats();
  const { user } = useAuth();
  const [mine, setMine] = useState<MyPasteStats | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadMine = useCallback(() => {
    if (!user) return;
    fetchMyPasteStats()
      .then((s) => { if (mountedRef.current) setMine(s); })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMine(null);
      return;
    }
    loadMine();
  }, [user, loadMine]);

  useVisibilityAwarePoll(loadMine, 12_000, Boolean(user));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard icon="📋" label="Total pastes" value={pastesCreated} accent="emerald" />
        <StatCard icon="👁️" label="Global views" value={pasteViewsTotal} accent="indigo" />
        <StatCard icon="🟢" label="Active" value={activePastes} accent="cyan" />
        <StatCard
          icon="📊"
          label="Avg views / paste"
          value={pastesCreated ? Math.round(pasteViewsTotal / pastesCreated) : 0}
          accent="violet"
          raw
        />
      </div>

      {user && mine && mine.count > 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#12151c]/90 to-black/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
              Your paste dashboard · @{user.username}
            </p>
            <span className="text-[8px] font-mono text-emerald-400/70 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {mine.count} snippets
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            <MiniStat icon="📋" label="Yours" value={String(mine.count)} accent="text-emerald-300" />
            <MiniStat icon="👁️" label="Your views" value={mine.totalViews.toLocaleString('en-US')} accent="text-indigo-300" />
            <MiniStat icon="📊" label="Ø Views" value={String(mine.avgViews)} accent="text-cyan-300" />
            <MiniStat icon="📌" label="Pinned" value={String(mine.pinned)} accent="text-amber-300" />
            <MiniStat icon="💾" label="Storage" value={formatPasteBytes(mine.totalBytes)} accent="text-sky-300" raw />
            <MiniStat icon="📏" label="Lines" value={mine.totalLines.toLocaleString('en-US')} accent="text-violet-300" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <BreakdownPanel
              title="By visibility"
              items={Object.entries(mine.byVisibility).map(([k, v]) => ({
                label: visibilityLabel(k),
                value: Number(v) || 0,
                color: k === 'public' ? 'bg-emerald-500' : k === 'protected' ? 'bg-amber-500' : 'bg-indigo-500',
              }))}
              total={mine.count}
            />
            <BreakdownPanel
              title="Top languages"
              items={Object.entries(mine.byLanguage)
                .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
                .slice(0, 5)
                .map(([k, v]) => ({
                  label: languageLabel(k),
                  value: Number(v) || 0,
                  color: 'bg-cyan-500',
                }))}
              total={mine.count}
            />
          </div>

          {mine.topViewedId && (
            <p className="text-[8px] font-mono text-slate-500">
              🔥 Top hit: <span className="text-emerald-400/90">{mine.topViewedTitle}</span>
              {' · '}{mine.topViewedViews.toLocaleString('en-US')} views
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  raw = false,
}: {
  icon: string;
  label: string;
  value: number | string;
  accent: 'emerald' | 'indigo' | 'cyan' | 'violet';
  raw?: boolean;
}) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300',
    indigo: 'border-indigo-500/25 bg-indigo-500/5 text-indigo-300',
    cyan: 'border-cyan-500/25 bg-cyan-500/5 text-cyan-300',
    violet: 'border-violet-500/25 bg-violet-500/5 text-violet-300',
  };

  const display = raw ? String(value) : typeof value === 'number' ? value.toLocaleString('en-US') : value;

  return (
    <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 ${colors[accent]}`}>
      <span className="text-lg">{icon}</span>
      <div className="min-w-0">
        <p className="text-[8px] font-mono uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-[15px] font-mono font-bold tabular-nums leading-tight truncate">{display}</p>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  accent,
  raw = false,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
  raw?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-black/30 px-2.5 py-2">
      <p className="text-[7px] font-mono uppercase tracking-wider text-slate-600">{icon} {label}</p>
      <p className={`text-[12px] font-mono font-bold tabular-nums ${accent} ${raw ? 'text-[10px]' : ''}`}>{value}</p>
    </div>
  );
}

function BreakdownPanel({
  title,
  items,
  total,
}: {
  title: string;
  items: { label: string; value: number; color: string }[];
  total: number;
}) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-black/25 p-3">
      <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-2">{title}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-slate-400 w-24 truncate shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color} opacity-80`}
                style={{ width: `${Math.round((item.value / max) * 100)}%` }}
              />
            </div>
            <span className="text-[8px] font-mono text-slate-500 tabular-nums w-6 text-right">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[7px] font-mono text-slate-600 mt-2">{total} total pastes</p>
    </div>
  );
}