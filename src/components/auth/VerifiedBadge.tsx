/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type VerifiedBadgeProps = {
  verified?: boolean;
  size?: number;
  showLabel?: boolean;
  className?: string;
  /** Emphasized animated style (profile hero) */
  animated?: boolean;
};

export function VerifiedBadge({
  verified,
  size = 12,
  showLabel = false,
  className = '',
  animated = false,
}: VerifiedBadgeProps) {
  const { user } = useAuth();
  const isVerified = verified ?? user?.verified;
  if (!isVerified) return null;

  return (
    <span
      className={`verified-badge inline-flex items-center gap-0.5 shrink-0 ${
        animated ? 'verified-badge--glow' : 'text-sky-400'
      } ${className}`.trim()}
      title="Verified user"
    >
      <BadgeCheck size={size} strokeWidth={2.25} aria-hidden className="verified-badge__icon" />
      {showLabel && (
        <span className="text-[8px] font-mono uppercase tracking-wider text-sky-300/90">Verified</span>
      )}
    </span>
  );
}
