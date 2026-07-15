/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BadgeCheck, Bot, Crown, Shield } from 'lucide-react';
import type { UserRole } from '../../types/auth';

export type ChatRoleBadgesProps = {
  role: UserRole;
  verified?: boolean;
  compact?: boolean;
};

export function ChatRoleBadges({ role, verified = false, compact = false }: ChatRoleBadgesProps) {
  const iconSize = compact ? 7 : 8;
  const badges: React.ReactNode[] = [];

  if (role === 'admin') {
    badges.push(
      <span key="admin" className="chat-role-badge chat-role-badge--admin" title="Administrator">
        <Shield size={iconSize} aria-hidden />
        <span>ADMIN</span>
      </span>,
    );
  } else if (role === 'vip') {
    badges.push(
      <span key="vip" className="chat-role-badge chat-role-badge--vip" title="VIP member">
        <Crown size={iconSize} aria-hidden />
        <span>VIP</span>
      </span>,
    );
  } else if (role === 'bot') {
    badges.push(
      <span key="bot" className="chat-role-badge chat-role-badge--bot" title="System bot">
        <Bot size={iconSize} aria-hidden />
        <span>BOT</span>
      </span>,
    );
  }

  if (verified && role !== 'bot') {
    badges.push(
      <span key="verified" className="chat-role-badge chat-role-badge--verified" title="Verified member">
        <BadgeCheck size={iconSize} aria-hidden />
        {!compact && <span>VERIFIED</span>}
      </span>,
    );
  }

  if (!badges.length) return null;

  return (
    <span
      className={`inline-flex items-center shrink-0 ${compact ? 'gap-0.5' : 'gap-1'}`}
      aria-label={badges.length === 1 ? 'User badge' : 'User badges'}
    >
      {badges}
    </span>
  );
}