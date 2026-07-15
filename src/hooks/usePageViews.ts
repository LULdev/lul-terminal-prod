/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPageViews, recordPageView } from '../lib/pageViews';
import { useAuth } from '../context/AuthContext';
import { useVisibilityAwarePoll } from './useVisibilityAwarePoll';

export function usePageViews(pageId: string | undefined, enabled = true) {
  const { isLoggedIn } = useAuth();
  const [views, setViews] = useState<number | null>(null);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!pageId) return;
    const gen = ++loadGenRef.current;
    try {
      const v = await fetchPageViews(pageId);
      if (v !== null && gen === loadGenRef.current && mountedRef.current) setViews(v);
    } catch { /* ignore */ }
  }, [pageId]);

  const active = Boolean(pageId && enabled && isLoggedIn);

  useEffect(() => {
    if (!active) {
      setViews(null);
      return;
    }
    const gen = ++loadGenRef.current;
    recordPageView(pageId!)
      .then((v) => { if (gen === loadGenRef.current && mountedRef.current) setViews(v); })
      .catch(() => { if (gen === loadGenRef.current && mountedRef.current) void refresh(); });
  }, [pageId, active, refresh]);

  useVisibilityAwarePoll(refresh, 10_000, active);

  return views;
}