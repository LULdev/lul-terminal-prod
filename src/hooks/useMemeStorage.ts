/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';

const FAV_KEY = 'lul_meme_favorites';
const RECENT_KEY = 'lul_meme_recent';

function loadIds(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

export function useMemeStorage() {
  const [favorites, setFavorites] = useState<string[]>(() => loadIds(FAV_KEY));
  const [recent, setRecent] = useState<string[]>(() => loadIds(RECENT_KEY));

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 200);
      saveIds(FAV_KEY, next);
      return next;
    });
  }, []);

  const recordRecent = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 24);
      saveIds(RECENT_KEY, next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, recent, toggleFavorite, recordRecent, isFavorite };
}