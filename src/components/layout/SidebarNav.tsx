/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from 'react';
import { Bell, Crown, Lock } from 'lucide-react';
import { ACCENT_STYLES, DASHBOARD_MENU_ITEM, MAIN_MENU_ITEMS, TabId } from '../../config/menuItems';
import { usePageVisibility } from '../../context/PageVisibilityContext';
import { useAuth } from '../../context/AuthContext';
import { useFeedUnread } from '../../hooks/useFeedUnread';
import { UserBar } from '../auth/UserBar';

type SidebarNavProps = {
  activeTab: TabId;
  onTabClick: (tab: TabId, opts?: { profileUsername?: string }) => void;
  hudPanel?: React.ReactNode;
};

export const SidebarNav = memo(function SidebarNav({ activeTab, onTabClick, hudPanel }: SidebarNavProps) {
  const { isLoggedIn } = useAuth();
  const { requiresLogin } = usePageVisibility();
  const { changelogUnread, newsUnread } = useFeedUnread();

  return (
    <nav className="w-[220px] bg-[#0a0c10] border-r border-slate-800/50 flex flex-col p-4 shrink-0 z-10 min-h-0 h-full" id="sidebar-rail">
      {/* Account dock — top of sidebar, above menu */}
      <UserBar onNavigate={onTabClick} />

      <div className="text-[10px] text-slate-500 uppercase tracking-[2px] font-bold mb-3 mt-3 px-2 shrink-0">
        Member Menu
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1" id="sidebar-main-controls">
        {(() => {
          const item = DASHBOARD_MENU_ITEM;
          const accent = item.accent ?? 'default';
          const styles = ACCENT_STYLES[accent];
          const isActive = activeTab === item.id;
          const locked = !isLoggedIn;
          return (
            <button
              key={item.id}
              onClick={() => onTabClick(item.id)}
              title={item.tagline}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all text-xs mb-1 ${
                isActive ? styles.active : styles.idle
              }`}
            >
              <span>{item.icon}</span>
              <span className="truncate flex-1">{item.label}</span>
              {locked && <Lock className="w-3 h-3 shrink-0 text-slate-600" aria-label="Sign in required" />}
            </button>
          );
        })()}
        {MAIN_MENU_ITEMS.map((item) => {
          const accent = item.accent ?? 'default';
          const styles = ACCENT_STYLES[accent];
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabClick(item.id)}
              title={item.tagline}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all text-xs ${
                isActive ? styles.active : styles.idle
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="truncate">{item.label}</span>
                {item.vipBadge && <Crown className="w-3 h-3 shrink-0 text-amber-400/90" aria-label="VIP" />}
                {item.id === 'changelog' && changelogUnread && (
                  <Bell className="w-3 h-3 shrink-0 text-amber-400 animate-pulse" aria-label="New changelog entries" />
                )}
                {item.id === 'news' && newsUnread && (
                  <Bell className="w-3 h-3 shrink-0 text-amber-400 animate-pulse" aria-label="New news entries" />
                )}
                {!isLoggedIn && requiresLogin(item.id) && (
                  <Lock className="w-3 h-3 shrink-0 text-slate-600" aria-label="Sign in required" />
                )}
              </span>
            </button>
          );
        })}

        {/* Creative Labs section hidden from sidebar */}
      </div>

      {hudPanel}
    </nav>
  );
});
