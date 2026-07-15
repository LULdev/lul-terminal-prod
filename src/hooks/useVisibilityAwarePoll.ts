/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

/** Poll callback on an interval; pauses while the document tab is hidden. */
export function useVisibilityAwarePoll(
  load: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      void load();
      if (!timer) timer = setInterval(() => { void load(); }, intervalMs);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVis = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, intervalMs, enabled]);
}