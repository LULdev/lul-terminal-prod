/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { MemeCatalog } from '../../types/meme';

type Props = {
  catalog: MemeCatalog | null;
  loading?: boolean;
  memesCreated: number;
};

function formatCount(n: number) {
  return n.toLocaleString('en-US');
}

type StatCardProps = {
  label: string;
  value: string | number;
  icon: string;
  accent: string;
  glow: string;
  sub?: string;
  live?: boolean;
};

function StatCard({ label, value, icon, accent, glow, sub, live }: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-[#12151e]/90 p-3.5 backdrop-blur-sm transition hover:scale-[1.02] ${accent}`}
      style={{ boxShadow: glow }}
    >
      <div className="absolute -right-3 -top-3 text-4xl opacity-[0.07] select-none pointer-events-none">{icon}</div>
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-slate-500 mb-1 flex items-center gap-1.5">
            {live && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            )}
            {label}
          </div>
          <div className="text-xl sm:text-2xl font-bold font-sans text-slate-100 tabular-nums tracking-tight">
            {value}
          </div>
          {sub && <div className="text-[8px] font-mono text-slate-600 mt-1 truncate">{sub}</div>}
        </div>
        <span className="text-lg shrink-0 opacity-80">{icon}</span>
      </div>
    </div>
  );
}

export function MemeDatabaseStats({ catalog, loading, memesCreated }: Props) {
  const scrapedLabel = catalog
    ? `Sync ${new Date(catalog.scrapedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Loading catalog…';

  return (
    <div
      id="meme-db-stats"
      className="shrink-0 rounded-xl border border-rose-500/15 bg-gradient-to-br from-[#161a28]/95 via-[#11131b]/90 to-[#0d0f14]/95 p-3 shadow-[0_0_24px_rgba(244,63,94,0.06)]"
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 border border-rose-500/25 text-sm">
            📊
          </span>
          <div>
            <h3 className="text-[11px] font-bold text-rose-200 font-sans tracking-wide">Meme database live</h3>
            <p className="text-[8px] font-mono text-slate-500">{loading ? 'Loading catalog…' : scrapedLabel}</p>
          </div>
        </div>
        <span className="text-[8px] font-mono text-slate-600 border border-slate-800/80 px-2 py-1 rounded-full hidden sm:inline">
          {catalog?.duplicatesRemoved
            ? `${catalog.duplicatesRemoved} dupes removed`
            : 'imgflip · unique paths'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard
          label="Total templates"
          value={loading ? '—' : formatCount(catalog?.total ?? 0)}
          icon="🗂️"
          accent="border-rose-500/25"
          glow="0 0 18px rgba(244,63,94,0.12)"
          sub="All memes in DB"
        />
        <StatCard
          label="Image memes"
          value={loading ? '—' : formatCount(catalog?.staticCount ?? 0)}
          icon="🖼️"
          accent="border-cyan-500/25"
          glow="0 0 18px rgba(34,211,238,0.1)"
          sub={catalog?.staticPages ? `Static · pages ${catalog.staticPages}` : 'Static Templates'}
        />
        <StatCard
          label="GIF-Memes"
          value={loading ? '—' : formatCount(catalog?.gifCount ?? 0)}
          icon="🎬"
          accent="border-violet-500/25"
          glow="0 0 18px rgba(167,139,250,0.1)"
          sub={catalog?.gifPages ? `Animated · pages ${catalog.gifPages}` : 'GIF Templates'}
        />
        <StatCard
          label="Created"
          value={formatCount(memesCreated)}
          icon="✨"
          accent="border-emerald-500/25"
          glow="0 0 18px rgba(52,211,153,0.12)"
          sub="Exported via generator"
          live
        />
      </div>
    </div>
  );
}