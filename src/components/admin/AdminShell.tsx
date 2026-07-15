/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Search, Shield } from 'lucide-react';
import { APP_VERSION } from '../../config/version';

export type AdminTabId =
  | 'overview'
  | 'analytics'
  | 'visibility'
  | 'proxy'
  | 'scraper'
  | 'pastes'
  | 'news'
  | 'moderation'
  | 'users'
  | 'pulse'
  | 'colon-db'
  | 'shoutbox'
  | 'emotes'
  | 'images'
  | 'content'
  | 'leaderboards'
  | 'persona'
  | 'vault'
  | 'proxy-db'
  | 'visitors'
  | 'referrals'
  | 'events'
  | 'online'
  | 'heatmap'
  | 'achievements'
  | 'scraper-pool'
  | 'checker'
  | 'reports'
  | 'changelog'
  | 'avatars'
  | 'storage'
  | 'setup-notes';

export type AdminTabDef = {
  id: AdminTabId;
  label: string;
  shortLabel: string;
  icon: string;
  group: string;
  desc: string;
  shortcut?: string;
};

export const ADMIN_TABS: AdminTabDef[] = [
  { id: 'overview', label: 'Command Center', shortLabel: 'Home', icon: '🏠', group: 'Start', desc: 'Overview & quick access', shortcut: '1' },
  { id: 'analytics', label: 'Analytics & Tracking', shortLabel: 'Analytics', icon: '📊', group: 'Monitor', desc: 'User-Tracking · Visitor Intelligence', shortcut: '2' },
  { id: 'visibility', label: 'Page Visibility', shortLabel: 'Visibility', icon: '👁️', group: 'Platform', desc: 'Public · Members · Login-Gates', shortcut: '3' },
  { id: 'proxy', label: 'Proxy Pipeline', shortLabel: 'Proxy', icon: '🔄', group: 'Platform', desc: 'Scrape · Check · Database', shortcut: '4' },
  { id: 'scraper', label: 'Link Scraper', shortLabel: 'Scraper', icon: '🧬', group: 'Platform', desc: 'Crawl · Colon · XML', shortcut: '5' },
  { id: 'pastes', label: 'Paste Manager', shortLabel: 'Pastes', icon: '📋', group: 'Content', desc: 'All pastes · edit · delete', shortcut: '6' },
  { id: 'news', label: 'News & Bulletin', shortLabel: 'News', icon: '📰', group: 'Content', desc: 'Manage articles', shortcut: '7' },
  { id: 'moderation', label: 'Moderation', shortLabel: 'Mod', icon: '👑', group: 'Community', desc: 'Premium · Reports', shortcut: '8' },
  { id: 'users', label: 'User Management', shortLabel: 'Users', icon: '👥', group: 'Community', desc: 'Roles · verification', shortcut: '9' },
  { id: 'pulse', label: 'System Pulse', shortLabel: 'Pulse', icon: '💓', group: 'Ops', desc: 'Live terminal stats · community · network' },
  { id: 'shoutbox', label: 'Shoutbox Monitor', shortLabel: 'Shoutbox', icon: '💬', group: 'Community', desc: 'Lobby messages · moderation · delete' },
  { id: 'emotes', label: 'Chat Emotes', shortLabel: 'Emotes', icon: '😀', group: 'Community', desc: 'Upload GIFs · codes · shoutbox picker' },
  { id: 'leaderboards', label: 'Leaderboards', shortLabel: 'Boards', icon: '🏆', group: 'Community', desc: 'Top-3 Boards · Award-Sync' },
  { id: 'colon-db', label: 'Colon DB Browser', shortLabel: 'Colon DB', icon: '🗄️', group: 'Data', desc: 'U:P tokens · websites · search & delete' },
  { id: 'images', label: 'Image Gallery', shortLabel: 'Images', icon: '🖼️', group: 'Content', desc: 'Hosted images · views · storage' },
  { id: 'content', label: 'Content Analytics', shortLabel: 'Content', icon: '📈', group: 'Monitor', desc: 'Changelog · News · Page Views' },
  { id: 'persona', label: 'Persona Database', shortLabel: 'Persona', icon: '🎭', group: 'Data', desc: 'Fake identities · addresses · countries' },
  { id: 'vault', label: 'Account Vault', shortLabel: 'Vault', icon: '👑', group: 'Data', desc: 'CRUD · bulk import · credentials manager' },
  { id: 'proxy-db', label: 'Proxy DB Inspector', shortLabel: 'Proxy DB', icon: '🌐', group: 'Ops', desc: 'Persisted proxies · check · export' },
  { id: 'visitors', label: 'Visitor Directory', shortLabel: 'Visitors', icon: '🛰️', group: 'Monitor', desc: 'Session profiles · referrer · return visits' },
  { id: 'referrals', label: 'Referral Network', shortLabel: 'Referrals', icon: '🚀', group: 'Community', desc: 'Top referrers · codes · new members' },
  { id: 'events', label: 'Event Ops', shortLabel: 'Events', icon: '⚡', group: 'Monitor', desc: 'Event log · purge · export' },
  { id: 'online', label: 'Online Radar', shortLabel: 'Online', icon: '🟢', group: 'Community', desc: 'Live Online · Active Today' },
  { id: 'heatmap', label: 'Tab Heatmap', shortLabel: 'Heatmap', icon: '🗺️', group: 'Monitor', desc: 'Tab hits · dwell · referrer aggregates' },
  { id: 'achievements', label: 'Achievements Hub', shortLabel: 'Badges', icon: '🎖️', group: 'Community', desc: 'Unlock stats · collector ranking' },
  { id: 'scraper-pool', label: 'Scraper Pool', shortLabel: 'Pool', icon: '🕸️', group: 'Ops', desc: 'Proxy sources · merge pool' },
  { id: 'checker', label: 'Checker Dashboard', shortLabel: 'Checker', icon: '✅', group: 'Ops', desc: 'Last-Check · Alive/Dead · Latency' },
  { id: 'reports', label: 'Reports Desk', shortLabel: 'Reports', icon: '🚩', group: 'Data', desc: 'Vault report history' },
  { id: 'changelog', label: 'Changelog Console', shortLabel: 'Changelog', icon: '📜', group: 'Content', desc: 'Release history · highlights' },
  { id: 'avatars', label: 'Avatar CDN', shortLabel: 'Avatars', icon: '🎨', group: 'Content', desc: 'Profile images · disk storage' },
  { id: 'storage', label: 'Storage Explorer', shortLabel: 'Storage', icon: '💾', group: 'Ops', desc: 'Data stores · footprint' },
  { id: 'setup-notes', label: 'Setup Notes', shortLabel: 'Setup', icon: '📝', group: 'Ops', desc: 'Deployment · env vars · operator reminders' },
];

export function AdminPanelSkeleton({ label = 'Panel' }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-violet-500/10 bg-[#0a0b10]/80 p-8 animate-pulse">
      <div className="h-3 w-32 rounded bg-violet-500/20 mb-4" />
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-slate-800/80" />
        <div className="h-2 w-4/5 rounded bg-slate-800/60" />
        <div className="h-2 w-3/5 rounded bg-slate-800/40" />
      </div>
      <p className="text-[10px] font-mono text-violet-300/50 mt-6 text-center">{label} Loading…</p>
    </div>
  );
}

type AdminShellProps = {
  active: AdminTabId;
  onChange: (id: AdminTabId) => void;
  search: string;
  onSearch: (q: string) => void;
  children: React.ReactNode;
};

export function AdminShell({ active, onChange, search, onSearch, children }: AdminShellProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const activeTab = ADMIN_TABS.find((t) => t.id === active) ?? ADMIN_TABS[0];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ADMIN_TABS;
    return ADMIN_TABS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.group.toLowerCase().includes(q),
    );
  }, [search]);

  const groups = useMemo(() => {
    const map = new Map<string, AdminTabDef[]>();
    for (const tab of filtered) {
      if (!map.has(tab.group)) map.set(tab.group, []);
      map.get(tab.group)!.push(tab);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const hit = ADMIN_TABS.find((t) => t.shortcut === e.key);
      if (hit) onChange(hit.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChange]);

  return (
    <div className="flex flex-col min-h-0 gap-3">
      {/* Hero bar */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-[#0c0d14] to-cyan-950/20 px-4 py-3 shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.12),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-lg shadow-[0_0_24px_rgba(139,92,246,0.15)]">
              <Shield className="text-violet-300" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-violet-100 tracking-tight">Admin Command Center</h2>
              <p className="text-[9px] font-mono text-slate-500">v{APP_VERSION} · Tab-Navigation · Lazy Panels</p>
            </div>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={13} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) onChange(filtered[0].id);
              }}
              placeholder="Search modules… Enter · / · Ctrl+K"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-800/80 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
            />
          </div>
        </div>
      </div>

      {/* Mobile tab strip */}
      <div className="flex md:hidden gap-1 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-[9px] font-mono transition-all ${
              active === tab.id
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                : 'border-slate-800 bg-black/30 text-slate-500'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.shortLabel}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Sidebar */}
        <aside className="hidden md:flex w-52 shrink-0 flex-col rounded-2xl border border-slate-800/80 bg-[#0a0b10]/90 overflow-hidden">
          <nav className="flex-1 overflow-y-auto p-2 space-y-3" aria-label="Admin modules">
            {groups.map(([group, tabs]) => (
              <div key={group}>
                <div className="px-2 py-1 text-[7px] font-mono font-bold uppercase tracking-widest text-slate-600">{group}</div>
                <div className="space-y-0.5">
                  {tabs.map((tab) => {
                    const isActive = active === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl border transition-all group ${
                          isActive
                            ? 'border-violet-500/40 bg-violet-500/12 shadow-[inset_0_0_20px_rgba(139,92,246,0.08)]'
                            : 'border-transparent hover:border-slate-700/80 hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{tab.icon}</span>
                          <span className={`text-[10px] font-mono font-medium truncate ${isActive ? 'text-violet-200' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            {tab.shortLabel}
                          </span>
                          {tab.shortcut && (
                            <span className="ml-auto text-[7px] font-mono text-slate-700 group-hover:text-slate-600">{tab.shortcut}</span>
                          )}
                        </div>
                        {isActive && (
                          <p className="text-[7px] font-mono text-slate-600 mt-1 pl-6 leading-snug">{tab.desc}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-2 border-t border-slate-800/80 text-[7px] font-mono text-slate-700 text-center">
            1–9 shortcuts · / search
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col rounded-2xl border border-slate-800/80 bg-[#0a0b10]/60 overflow-hidden">
          <header className="shrink-0 px-4 py-3 border-b border-slate-800/60 bg-black/20 flex items-center gap-3">
            <span className="text-xl" aria-hidden>{activeTab.icon}</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">{activeTab.label}</h3>
              <p className="text-[8px] font-mono text-slate-600 truncate">{activeTab.desc}</p>
            </div>
            <span className="hidden sm:inline-flex px-2 py-1 rounded-lg border border-violet-500/20 bg-violet-500/5 text-[8px] font-mono text-violet-400/90">
              {activeTab.group}
            </span>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 admin-panel-scroll">
            <div key={active} className="animate-fade-in">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}