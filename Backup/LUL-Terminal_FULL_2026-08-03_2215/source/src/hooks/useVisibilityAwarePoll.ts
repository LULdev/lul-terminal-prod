/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

/**
 * Poll callback on an interval; pauses while the document tab is hidden.
 * Uses a ref for `load` so callers can pass inline functions without
 * restarting the poll (and re-firing immediately) on every render.
 */
export function useVisibilityAwarePoll(
  load: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      void loadRef.current();
    };

    const start = () => {
      if (!timer) timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    // Initial fetch once when polling is enabled / interval changes — not on every load identity change.
    run();
    if (!document.hidden) start();

    const onVis = () => {
      if (document.hidden) {
        stop();
      } else {
        run();
        start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs, enabled]);
}
