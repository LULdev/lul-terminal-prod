/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { TabId } from '../config/menuItems';
import { DEFAULT_PUBLIC_TABS } from '../config/accessControl';
import { ALL_TAB_IDS } from '../config/menuItems';
import {
  fetchPageVisibility,
  type PageVisibilityConfig,
  type PublicAccessControl,
} from '../lib/pageVisibility';

type PageVisibilityContextValue = {
  loading: boolean;
  config: PageVisibilityConfig;
  updatedAt: number | null;
  isPublicTab: (tab: TabId) => boolean;
  requiresLogin: (tab: TabId) => boolean;
  refresh: () => Promise<void>;
  applyConfig: (data: PublicAccessControl) => void;
};

const PageVisibilityContext = createContext<PageVisibilityContextValue | null>(null);

function fallbackIsPublic(tab: TabId): boolean {
  return DEFAULT_PUBLIC_TABS.has(tab);
}

export function PageVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PageVisibilityConfig>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const configRef = useRef(config);
  configRef.current = config;

  const applyConfig = useCallback((data: PublicAccessControl) => {
    if (data.pages) {
      setConfig(data.pages);
    } else {
      const publicSet = new Set(data.publicTabs ?? []);
      const derived: PageVisibilityConfig = {};
      for (const tab of ALL_TAB_IDS) {
        derived[tab] = publicSet.has(tab) ? 'public' : 'members';
      }
      setConfig(derived);
    }
    setUpdatedAt(data.updatedAt ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPageVisibility();
      applyConfig(data);
      setFetchFailed(false);
    } catch {
      setFetchFailed((prev) => prev || Object.keys(configRef.current).length === 0);
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    refresh();
    const tick = () => {
      if (document.hidden) return;
      refresh().catch(() => {});
    };
    const t = setInterval(tick, 60_000);
    const onVisible = () => {
      if (!document.hidden) refresh().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const isPublicTab = useCallback((tab: TabId) => {
    const vis = config[tab];
    if (vis === 'public') return true;
    if (vis === 'members') return false;
    if (fetchFailed && Object.keys(config).length === 0) {
      return DEFAULT_PUBLIC_TABS.has(tab);
    }
    return fallbackIsPublic(tab);
  }, [config, fetchFailed]);

  const requiresLogin = useCallback((tab: TabId) => !isPublicTab(tab), [isPublicTab]);

  const value = useMemo(() => ({
    loading,
    config,
    updatedAt,
    isPublicTab,
    requiresLogin,
    refresh,
    applyConfig,
  }), [loading, config, updatedAt, isPublicTab, requiresLogin, refresh, applyConfig]);

  return (
    <PageVisibilityContext.Provider value={value}>
      {children}
    </PageVisibilityContext.Provider>
  );
}

export function usePageVisibility() {
  const ctx = useContext(PageVisibilityContext);
  if (!ctx) throw new Error('usePageVisibility requires PageVisibilityProvider');
  return ctx;
}