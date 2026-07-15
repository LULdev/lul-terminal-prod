/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllPostViews, recordPostView, type PostViewType } from '../lib/postViews';

export function usePostViews(type: PostViewType, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  const [views, setViews] = useState<Record<string, number>>({});
  const viewsRef = useRef<Record<string, number>>({});
  const inflightRef = useRef(new Set<string>());
  const pendingRef = useRef<Record<string, number>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  const loadGenRef = useRef(0);
  const typeRef = useRef(type);
  typeRef.current = type;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const batch = pendingRef.current;
      pendingRef.current = {};
      const keys = Object.keys(batch);
      if (!keys.length) return;
      const merged = { ...viewsRef.current, ...batch };
      viewsRef.current = merged;
      setViews((prev) => ({ ...prev, ...batch }));
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const gen = ++loadGenRef.current;
    fetchAllPostViews().then((data) => {
      if (!aliveRef.current || gen !== loadGenRef.current) return;
      const initial = data[type] ?? {};
      viewsRef.current = { ...viewsRef.current, ...initial };
      setViews((prev) => ({ ...initial, ...prev }));
    });
  }, [type, enabled]);

  const flushPending = useCallback(() => {
    flushTimerRef.current = null;
    const batch = pendingRef.current;
    pendingRef.current = {};
    const keys = Object.keys(batch);
    if (!keys.length) return;

    let changed = false;
    const patched = { ...viewsRef.current };
    for (const id of keys) {
      if (patched[id] !== batch[id]) {
        patched[id] = batch[id];
        changed = true;
      }
    }
    if (!changed || !aliveRef.current) return;
    viewsRef.current = patched;
    setViews((prev) => {
      let prevChanged = false;
      const next = { ...prev };
      for (const id of keys) {
        if (next[id] !== batch[id]) {
          next[id] = batch[id];
          prevChanged = true;
        }
      }
      return prevChanged ? next : prev;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(flushPending, 800);
  }, [flushPending]);

  const registerViewRef = useRef<(id: string) => void>(() => {});
  registerViewRef.current = async (id: string) => {
    if (!enabled) return;
    if (inflightRef.current.has(id)) return;
    inflightRef.current.add(id);
    try {
      const current = viewsRef.current[id] ?? 0;
      const next = await recordPostView(typeRef.current, id, current);
      pendingRef.current[id] = next;
      if (aliveRef.current) {
        scheduleFlush();
      } else {
        flushPending();
      }
    } finally {
      inflightRef.current.delete(id);
    }
  };

  const registerView = useCallback((id: string) => {
    registerViewRef.current(id);
  }, []);

  return { views, registerView };
}