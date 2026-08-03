/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Eye, Terminal } from 'lucide-react';
import { usePageViews } from '../../hooks/usePageViews';

type Props = {
  pageId?: string;
  icon: string;
  title: string;
  description: string;
  accentClass?: string;
  enabled?: boolean;
};

const ACCENT_STYLES: Record<string, { iconBox: string; iconColor: string; mono: string }> = {
  'text-amber-400': {
    iconBox: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
    mono: 'text-amber-400/80',
  },
  'text-violet-400': {
    iconBox: 'bg-violet-500/10 border-violet-500/20',
    iconColor: 'text-violet-400',
    mono: 'text-violet-400/80',
  },
  'text-cyan-400': {
    iconBox: 'bg-cyan-500/10 border-cyan-500/20',
    iconColor: 'text-cyan-400',
    mono: 'text-cyan-400/80',
  },
  'text-teal-400': {
    iconBox: 'bg-teal-500/10 border-teal-500/20',
    iconColor: 'text-teal-400',
    mono: 'text-teal-400/80',
  },
  'text-emerald-400': {
    iconBox: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-400',
    mono: 'text-emerald-400/80',
  },
  'text-rose-400': {
    iconBox: 'bg-rose-500/10 border-rose-500/20',
    iconColor: 'text-rose-400',
    mono: 'text-rose-400/80',
  },
  'text-orange-400': {
    iconBox: 'bg-orange-500/10 border-orange-500/20',
    iconColor: 'text-orange-400',
    mono: 'text-orange-400/80',
  },
  'text-indigo-400': {
    iconBox: 'bg-indigo-500/10 border-indigo-500/20',
    iconColor: 'text-indigo-400',
    mono: 'text-indigo-400/80',
  },
  'text-fuchsia-400': {
    iconBox: 'bg-fuchsia-500/10 border-fuchsia-500/20',
    iconColor: 'text-fuchsia-400',
    mono: 'text-fuchsia-400/80',
  },
  'text-sky-400': {
    iconBox: 'bg-sky-500/10 border-sky-500/20',
    iconColor: 'text-sky-400',
    mono: 'text-sky-400/80',
  },
  'text-slate-400': {
    iconBox: 'bg-slate-500/10 border-slate-500/20',
    iconColor: 'text-slate-300',
    mono: 'text-slate-400/80',
  },
};

const DEFAULT_ACCENT = ACCENT_STYLES['text-indigo-400'];

function PageViewCounter({ views }: { views: number | null }) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 shrink-0 shadow-[0_0_12px_rgba(52,211,153,0.08)]"
      title="Page views"
    >
      <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
        <Eye className="w-3 h-3 text-emerald-300" />
      </div>
      <div className="leading-none pr-0.5">
        <span className="text-[11px] font-mono font-bold text-emerald-200 tabular-nums">
          {views == null ? '—' : views.toLocaleString('en-US')}
        </span>
        <span className="text-[6px] font-mono text-emerald-400/70 uppercase tracking-wider block mt-0.5">
          views
        </span>
      </div>
    </div>
  );
}

export function PagePinnedBanner({
  pageId,
  icon,
  title,
  description,
  accentClass = 'text-indigo-400',
  enabled = true,
}: Props) {
  const views = usePageViews(pageId, enabled && Boolean(pageId));
  const accent = ACCENT_STYLES[accentClass] ?? DEFAULT_ACCENT;

  return (
    <div className="flex items-center justify-between gap-3 mb-4 shrink-0" id="page-greeting-header">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`${accent.iconBox} ${accent.iconColor} p-2 rounded-lg border shrink-0`}>
          <Terminal className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-100 font-sans">
            {title} {icon}
          </h1>
          <p className={`text-[11px] font-mono mt-0.5 ${accent.mono}`}>
            user@lul_terminal:~$ {description}
          </p>
        </div>
      </div>
      {pageId && <PageViewCounter views={views} />}
    </div>
  );
}