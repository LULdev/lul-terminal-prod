/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_SIZE = 200;

/** Evict finished jobs older than maxAge and cap map size. */
export function pruneJobMap(map, { maxAgeMs = DEFAULT_MAX_AGE_MS, maxSize = DEFAULT_MAX_SIZE } = {}) {
  const now = Date.now();
  for (const [id, job] of map) {
    const finishedAt = job.finishedAt ?? (job.status === 'done' || job.status === 'error' ? job.updatedAt : null);
    if (finishedAt && now - finishedAt > maxAgeMs) map.delete(id);
    else if ((job.status === 'done' || job.status === 'error') && !job.finishedAt) {
      job.finishedAt = now;
    }
  }
  if (map.size <= maxSize) return;
  const finished = [...map.entries()]
    .filter(([, j]) => j.status === 'done' || j.status === 'error')
    .sort((a, b) => (a[1].finishedAt ?? 0) - (b[1].finishedAt ?? 0));
  while (map.size > maxSize && finished.length) {
    map.delete(finished.shift()[0]);
  }
}