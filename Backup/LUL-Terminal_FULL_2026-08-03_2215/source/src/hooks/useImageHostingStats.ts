/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHostingStats } from '../lib/imageHosting';
import { useVisibilityAwarePoll } from './useVisibilityAwarePoll';

export function useImageHostingStats() {
  const [imagesHosted, setImagesHosted] = useState(0);
  const [imageViewsTotal, setImageViewsTotal] = useState(0);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const stats = await fetchHostingStats();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setImagesHosted(stats.imagesHosted);
      setImageViewsTotal(stats.imageViewsTotal);
    } catch { /* ignore */ }
  }, []);

  // Poll owns the initial fetch (stable load ref — no re-fire storm)
  useVisibilityAwarePoll(load, 12_000);

  return { imagesHosted, imageViewsTotal };
}