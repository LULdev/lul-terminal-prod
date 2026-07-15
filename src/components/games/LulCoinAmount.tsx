/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Coins } from 'lucide-react';

export type LulCoinVariant = 'balance' | 'earn' | 'jackpot' | 'streak' | 'bet' | 'loss' | 'refund';
export type LulCoinSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const ICON_SIZE: Record<LulCoinSize, number> = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
};

const AUTO_PREFIX: Partial<Record<LulCoinVariant, string>> = {
  earn: '+',
  jackpot: '+',
  streak: '+',
};

export function LulCoinAmount({
  amount,
  variant = 'balance',
  size = 'md',
  prefix,
  suffix = 'LUL',
  showIcon = false,
  className = '',
}: {
  amount: number;
  variant?: LulCoinVariant;
  size?: LulCoinSize;
  prefix?: string;
  suffix?: string | false;
  showIcon?: boolean;
  className?: string;
}) {
  const formatted = amount.toLocaleString('en-US');
  const prefixText = prefix ?? AUTO_PREFIX[variant] ?? '';
  const suffixText = suffix === false ? '' : suffix ? ` ${suffix}` : '';

  return (
    <span
      className={`lul-coin-amount lul-coin-amount--${variant} lul-coin-amount--${size} ${className}`}
      title={`${prefixText}${formatted}${suffixText}`.trim()}
    >
      {showIcon && <Coins size={ICON_SIZE[size]} className="lul-coin-amount-icon" />}
      {prefixText}
      {formatted}
      {suffixText}
    </span>
  );
}

/** Compact inline chip for bets, streaks, and small coin labels */
export function LulCoinChip({
  amount,
  variant = 'bet',
  label,
  icon,
  className = '',
}: {
  amount?: number;
  variant?: 'bet' | 'earn' | 'streak' | 'jackpot';
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const text = label ?? (amount != null
    ? variant === 'bet'
      ? `${amount.toLocaleString('en-US')} LUL`
      : amount.toLocaleString('en-US')
    : '');
  return (
    <span className={`lul-coin-chip lul-coin-chip--${variant} ${className}`}>
      {icon ?? (variant !== 'bet' ? <Coins size={9} /> : null)}
      {text}
    </span>
  );
}