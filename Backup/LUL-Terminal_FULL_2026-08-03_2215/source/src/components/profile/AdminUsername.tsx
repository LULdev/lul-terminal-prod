/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

type AdminUsernameProps = {
  username: string;
  className?: string;
  /** Larger profile-hero presentation */
  size?: 'sm' | 'md' | 'lg';
};

export function AdminUsername({ username, className = '', size = 'md' }: AdminUsernameProps) {
  const sizeClass =
    size === 'lg' ? 'admin-username-style--lg' : size === 'sm' ? 'admin-username-style--sm' : 'admin-username-style--md';

  return (
    <span
      className={`admin-username-style ${sizeClass} ${className}`.trim()}
      title="Administrator"
    >
      @{username}
    </span>
  );
}
