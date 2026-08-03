/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties } from 'react';

const DEFAULT_COVER = 'linear-gradient(135deg,#0f172a,#1e293b,#020617)';

export function coverUrlToStyle(coverUrl: string): CSSProperties {
  const v = coverUrl.trim();
  if (!v) return { background: DEFAULT_COVER };

  if (v.startsWith('linear-gradient') || v.startsWith('radial-gradient')) {
    return { background: v };
  }

  if (v.startsWith('url(')) {
    return { backgroundImage: v, backgroundSize: 'cover', backgroundPosition: 'center' };
  }

  if (/^#([0-9a-f]{3,8})$/i.test(v) || v.startsWith('rgb') || v.startsWith('hsl')) {
    return { background: v };
  }

  const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return {
    backgroundImage: `url("${escaped}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}