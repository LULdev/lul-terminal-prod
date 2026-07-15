/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from 'react';
import { CHANGELOG_PRIORITY_META } from '../../data/changelogPriority';
import { PriorityPulseDot } from '../ui/PriorityPulseDot';

export const ChangelogLegend = memo(function ChangelogLegend() {
  return (
    <section
      className="mb-6 max-w-5xl rounded-lg border border-indigo-500/20 bg-[#1e293b]/60 p-4 font-mono shadow-[0_0_20px_rgba(99,102,241,0.06)]"
      aria-label="Changelog priority legend"
    >
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-3">
        Priority legend — pulsar dots
      </h2>

      <ul className="grid gap-2 sm:grid-cols-2">
        {CHANGELOG_PRIORITY_META.map((row) => (
          <li key={row.priority} className="flex gap-2 items-start text-[10px] leading-snug">
            <PriorityPulseDot priority={row.priority} />
            <span className="text-slate-300">
              <span className="font-bold text-indigo-300/90">{row.priority}</span>
              {' '}
              <span className="text-slate-200 font-semibold">{row.title}</span>
              <span className="text-slate-500"> · {row.color}</span>
              {' — '}
              <span className="text-slate-400">{row.desc}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 pt-2 border-t border-slate-700/40 text-[9px] text-slate-500 leading-relaxed">
        Each bug fix gets one pulsar dot and one line. Feature releases may use emoji icons instead of priority dots.
      </p>
    </section>
  );
});