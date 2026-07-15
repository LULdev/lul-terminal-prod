/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { ChangelogPriority } from '../../data/changelogPriority';
import { changelogPriorityMeta } from '../../data/changelogPriority';

type Props = {
  priority: ChangelogPriority;
  size?: 'sm' | 'md';
};

/** Pulsar priority dot — unique color per P0–P9 (see ChangelogLegend). */
export function PriorityPulseDot({ priority, size = 'sm' }: Props) {
  const dim = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const { core, ping, glow } = changelogPriorityMeta(priority);

  return (
    <span className={`relative flex ${dim} shrink-0 mt-1`} aria-hidden title={priority}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ping} opacity-40`} />
      <span className={`relative inline-flex rounded-full ${dim} ${core} ${glow}`} />
    </span>
  );
}