/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SystemStats } from '../types';

const DEFAULT_STATS: SystemStats = {
  online: 0,
  hits: 0,
  unique: 0,
  registered: 0,
  imagesUploaded: 0,
  pastesCreated: 0,
  proxiesInDb: 0,
  premiumAccounts: 0,
  freeAccounts: 0,
};

let latest = { ...DEFAULT_STATS };

export function setLiveStats(stats: SystemStats): void {
  latest = stats;
}

export function getLiveStats(): SystemStats {
  return latest;
}