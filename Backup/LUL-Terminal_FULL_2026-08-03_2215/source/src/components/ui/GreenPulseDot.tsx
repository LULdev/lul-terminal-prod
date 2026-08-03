/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

type Props = {
  size?: 'sm' | 'md';
};

export function GreenPulseDot({ size = 'sm' }: Props) {
  const dim = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <span className={`relative flex ${dim} shrink-0`} aria-hidden>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
      <span className={`relative inline-flex rounded-full ${dim} bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]`} />
    </span>
  );
}