/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

/** Sync countdown to server expiresAt — avoids drift from naive decrement. */
export function useMatchTimer(match: { id?: string; status?: string; expiresAt?: number } | null | undefined) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (match?.status !== 'playing' || !match.expiresAt) {
      setTimeLeft(0);
      return undefined;
    }
    const tick = () => setTimeLeft(Math.max(0, match.expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match?.id, match?.status, match?.expiresAt]);

  return timeLeft;
}