/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Eye } from 'lucide-react';
import { formatPasteViews } from '../../lib/paste';

type Props = {
  views: number;
  size?: 'sm' | 'md';
  className?: string;
};

export function PasteViewCount({ views, size = 'sm', className = '' }: Props) {
  const compact = size === 'sm';
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tabular-nums border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 ${
        compact ? 'text-[8px] px-1.5 py-0.5 rounded' : 'text-[9px] px-2 py-1 rounded-lg'
      } ${className}`}
      title={`${formatPasteViews(views)} views`}
    >
      <Eye size={compact ? 9 : 11} className="opacity-80" />
      {formatPasteViews(views)}
    </span>
  );
}