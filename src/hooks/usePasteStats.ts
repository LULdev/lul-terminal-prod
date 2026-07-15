/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPasteStats } from '../lib/paste';
import { useVisibilityAwarePoll } from './useVisibilityAwarePoll';

export function usePasteStats() {
  const [pastesCreated, setPastesCreated] = useState(0);
  const [pasteViewsTotal, setPasteViewsTotal] = useState(0);
  const [activePastes, setActivePastes] = useState(0);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const stats = await fetchPasteStats();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setPastesCreated(stats.pastesCreated);
      setPasteViewsTotal(stats.pasteViewsTotal);
      setActivePastes(stats.activePastes);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useVisibilityAwarePoll(load, 8000);

  return { pastesCreated, pasteViewsTotal, activePastes };
}