/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Coins } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg';

const SIZE_STYLES: Record<Size, { wrap: string; icon: number; label: string; value: string }> = {
  sm: {
    wrap: 'px-2.5 py-1 gap-1.5',
    icon: 11,
    label: 'lul-coin-label--sm',
    value: 'lul-coin-amount--sm',
  },
  md: {
    wrap: 'px-3.5 py-2 gap-2',
    icon: 14,
    label: 'lul-coin-label--md',
    value: 'lul-coin-amount--md',
  },
  lg: {
    wrap: 'px-4 py-2.5 gap-2.5',
    icon: 18,
    label: 'lul-coin-label--lg',
    value: 'lul-coin-amount--lg',
  },
};

export function LulCoinDisplay({
  amount,
  size = 'md',
  className = '',
}: {
  amount: number;
  size?: Size;
  className?: string;
}) {
  const s = SIZE_STYLES[size];
  return (
    <div
      className={`lul-coin-badge lul-coin-badge--${size} inline-flex items-center ${s.wrap} rounded-2xl ${className}`}
      title={`${amount.toLocaleString('en-US')} LULcoins`}
    >
      <span className="lul-coin-icon-ring">
        <Coins size={s.icon} />
      </span>
      <div className="flex flex-col leading-none relative z-[1]">
        <span className={`lul-coin-label ${s.label}`}>LULcoins</span>
        <span className={`lul-coin-amount lul-coin-amount--balance ${s.value}`}>
          {amount.toLocaleString('en-US')}
        </span>
      </div>
    </div>
  );
}