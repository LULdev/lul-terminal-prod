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
};

export function VerifiedBadge({ verified, size = 12, showLabel = false, className = '' }: VerifiedBadgeProps) {
  const { user } = useAuth();
  const isVerified = verified ?? user?.verified;
  if (!isVerified) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sky-400 ${className}`}
      title="Verified user"
    >
      <BadgeCheck size={size} strokeWidth={2.5} aria-hidden />
      {showLabel && (
        <span className="text-[8px] font-mono uppercase tracking-wider text-sky-300/90">Verified</span>
      )}
    </span>
  );
}