/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef } from 'react';
import type { MemeEditorSnapshot } from '../types/meme';

const DRAFT_KEY = 'lul_meme_drafts';
const MAX_DRAFTS = 30;

type DraftStore = Record<string, { savedAt: number; snapshot: MemeEditorSnapshot }>;

function loadStore(): DraftStore {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as DraftStore;
  } catch {
    return {};
  }
}

function saveStore(store: DraftStore) {
  const entries = Object.entries(store).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, MAX_DRAFTS);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function loadMemeDraft(templateId: string): MemeEditorSnapshot | null {
  return loadStore()[templateId]?.snapshot ?? null;
}

export function useMemeDraft(templateId: string, snapshot: MemeEditorSnapshot, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef('');

  const persist = useCallback((snap: MemeEditorSnapshot) => {
    const json = JSON.stringify(snap);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    const store = loadStore();
    store[templateId] = { savedAt: Date.now(), snapshot: snap };
    saveStore(store);
  }, [templateId]);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(snapshot), 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [snapshot, enabled, persist]);

  const clearDraft = useCallback(() => {
    const store = loadStore();
    delete store[templateId];
    saveStore(store);
    lastSaved.current = '';
  }, [templateId]);

  return { clearDraft };
}