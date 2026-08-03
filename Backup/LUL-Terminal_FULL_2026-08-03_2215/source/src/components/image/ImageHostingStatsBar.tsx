/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useImageHostingStats } from '../../hooks/useImageHostingStats';

export function ImageHostingStatsBar() {
  const { imagesHosted, imageViewsTotal } = useImageHostingStats();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <StatCard icon="☁️" label="Uploaded" value={imagesHosted} accent="sky" />
      <StatCard icon="👁️" label="Total views" value={imageViewsTotal} accent="violet" />
      <div className="hidden sm:flex col-span-1 items-center justify-center rounded-xl border border-slate-800/80 bg-[#12151c]/60 px-3 py-2">
        <p className="text-[8px] font-mono text-slate-600 text-center leading-relaxed">
          Local storage · private gallery for members
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: number;
  accent: 'sky' | 'violet';
}) {
  const colors = accent === 'sky'
    ? 'border-sky-500/25 bg-sky-500/5 text-sky-300'
    : 'border-violet-500/25 bg-violet-500/5 text-violet-300';

  return (
    <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 ${colors}`}>
      <span className="text-lg">{icon}</span>
      <div className="min-w-0">
        <p className="text-[8px] font-mono uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-[15px] font-mono font-bold tabular-nums leading-tight">
          {value.toLocaleString('en-US')}
        </p>
      </div>
    </div>
  );
}