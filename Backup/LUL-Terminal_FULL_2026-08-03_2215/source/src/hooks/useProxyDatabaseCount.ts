/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProxyDatabaseStats } from '../lib/proxyDatabase';
import { useVisibilityAwarePoll } from './useVisibilityAwarePoll';

export function useProxyDatabaseCount(pollMs = 30000) {
  const [count, setCount] = useState(0);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const stats = await fetchProxyDatabaseStats();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setCount(Math.max(0, stats.inDatabase ?? 0));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useVisibilityAwarePoll(load, pollMs);

  return count;
}