/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { TabId } from '../config/menuItems';
import { DEFAULT_PUBLIC_TABS } from '../config/accessControl';
import { ALL_TAB_IDS } from '../config/menuItems';
import {
  DEFAULT_SITE_UI,
  fetchPageVisibility,
  type PageVisibilityConfig,
  type PublicAccessControl,
  type SiteUiConfig,
} from '../lib/pageVisibility';

type PageVisibilityContextValue = {
  loading: boolean;
  config: PageVisibilityConfig;
  ui: SiteUiConfig;
  /** Right diagnostics / shoutbox pane visible site-wide */
  showDiagnosticsPane: boolean;
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

function normalizeUi(ui?: Partial<SiteUiConfig> | null): SiteUiConfig {
  return {
    showDiagnosticsPane: ui?.showDiagnosticsPane !== false,
  };
}

export function PageVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PageVisibilityConfig>({});
  const [ui, setUi] = useState<SiteUiConfig>({ ...DEFAULT_SITE_UI });
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
    setUi(normalizeUi(data.ui));
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

  const showDiagnosticsPane = ui.showDiagnosticsPane !== false;

  const value = useMemo(() => ({
    loading,
    config,
    ui,
    showDiagnosticsPane,
    updatedAt,
    isPublicTab,
    requiresLogin,
    refresh,
    applyConfig,
  }), [loading, config, ui, showDiagnosticsPane, updatedAt, isPublicTab, requiresLogin, refresh, applyConfig]);

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
