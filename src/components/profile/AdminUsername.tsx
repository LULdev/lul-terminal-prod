/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export function AdminUsername({ username, className = '' }: { username: string; className?: string }) {
  return (
    <span className={`admin-username-style font-mono ${className}`} title="Administrator">
      @{username}
    </span>
  );
}