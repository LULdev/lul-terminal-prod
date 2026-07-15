/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import type { MemeCatalog } from '../types/meme';

export function useMemeCatalog() {
  const [catalog, setCatalog] = useState<MemeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/memes/catalog.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MemeCatalog;
        if (!cancelled) {
          setCatalog(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load meme catalog');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error };
}