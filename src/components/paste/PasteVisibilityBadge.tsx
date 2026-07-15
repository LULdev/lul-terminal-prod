/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { visibilityIcon, visibilityLabel } from '../../data/pasteLanguages';

type Props = {
  visibility: string;
  className?: string;
};

export function PasteVisibilityBadge({ visibility, className = '' }: Props) {
  const colors =
    visibility === 'public'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
      : visibility === 'private'
        ? 'border-violet-500/25 bg-violet-500/10 text-violet-300'
        : 'border-amber-500/25 bg-amber-500/10 text-amber-300';

  return (
    <span className={`inline-flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded border ${colors} ${className}`}>
      <span>{visibilityIcon(visibility)}</span>
      {visibilityLabel(visibility)}
    </span>
  );
}