/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from 'react';
import type { ChangelogEntry as ChangelogEntryType } from '../../data/changelog';
import { priorityFromChangelogText } from '../../data/changelogPriority';
import { PostViewTracker } from '../feeds/PostViewTracker';
import { GreenPulseDot } from '../ui/GreenPulseDot';
import { PriorityPulseDot } from '../ui/PriorityPulseDot';

type Props = {
  entry: ChangelogEntryType;
  idx: number;
  views: number;
  onView: (id: string) => void;
  trackViews?: boolean;
};

export const ChangelogEntry = memo(function ChangelogEntry({
  entry,
  idx,
  views,
  onView,
  trackViews = true,
}: Props) {
  return (
    <div className="relative">
      <div
        className={`absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full ${
          entry.highlight
            ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1] animate-pulse'
            : idx < 3
              ? 'bg-slate-600'
              : 'bg-slate-700'
        }`}
      />
      <PostViewTracker postId={entry.version} views={views} onView={onView} enabled={trackViews}>
        <div
          className={`rounded-lg p-4 font-mono border ${
            entry.highlight
              ? 'bg-[#1e293b]/80 border-indigo-500/25 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
              : idx < 3
                ? 'bg-[#1e293b]/50 border-slate-700/30'
                : 'bg-[#1e293b]/25 border-slate-700/15'
          }`}
        >
          <div className="flex justify-between items-center mb-2.5 pb-1.5 border-b border-slate-700/50 gap-2 flex-wrap">
            <span className={`font-bold text-[11px] ${entry.highlight ? 'text-indigo-300' : 'text-slate-300 opacity-90'}`}>
              {entry.highlight ? '✨' : '📦'} v{entry.version} — {entry.title}
            </span>
            <span className="text-[9px] text-slate-500 shrink-0 flex items-center gap-1.5">
              <GreenPulseDot />
              {entry.date}
            </span>
          </div>
          <ul className={`text-[10px] space-y-1.5 leading-relaxed ${entry.highlight ? 'text-slate-300' : 'text-slate-400'}`}>
            {entry.items.map((item) => {
              const priority = priorityFromChangelogText(item.text) ?? item.priority;
              return (
                <li key={item.text} className="flex gap-2 items-start">
                  {priority ? (
                    <PriorityPulseDot priority={priority} />
                  ) : (
                    <span className="shrink-0">{item.icon}</span>
                  )}
                  <span>{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </PostViewTracker>
    </div>
  );
});