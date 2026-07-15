/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BarChart3, Crown, Home, LogIn, LogOut, Settings, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LOGOUT_ARCADE_BLOCKED } from '../../lib/authMessages';
import { TabId } from '../../config/menuItems';
import { VipBadge } from './VipGate';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { VerifiedBadge } from './VerifiedBadge';

type UserBarProps = {
  onNavigate: (tab: TabId, opts?: { profileUsername?: string }) => void;
};

export function UserBar({ onNavigate }: UserBarProps) {
  const { user, isLoggedIn, isAdmin, openAuth, logout, loading } = useAuth();
  const [logoutError, setLogoutError] = useState('');

  if (loading) {
    return (
      <div className="mt-auto pt-3 border-t border-slate-800/60 px-1 text-[9px] font-mono text-slate-600">
        Auth…
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="relative z-30 mt-auto shrink-0 pt-3 border-t border-slate-800/60 space-y-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={() => openAuth('login')}
          className="relative z-10 w-full flex cursor-pointer items-center gap-2 px-3 py-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-[10px] font-mono hover:bg-indigo-500/20"
        >
          <LogIn size={12} /> Sign In
        </button>
        <button
          type="button"
          onClick={() => openAuth('register')}
          className="relative z-10 w-full flex cursor-pointer items-center gap-2 px-3 py-2 rounded-md border border-slate-800 text-slate-500 text-[10px] font-mono hover:text-slate-300"
        >
          <Crown size={12} /> Register
        </button>
      </div>
    );
  }

  return (
    <div className="mt-auto pt-3 border-t border-slate-800/60 space-y-1.5">
      <button
        type="button"
        onClick={() => onNavigate('profile', { profileUsername: user!.username })}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-800/40 text-left"
      >
        <img src={safeAvatarUrl(user!.avatarUrl, user!.username)} alt={user!.displayName} className="w-8 h-8 rounded-lg border border-slate-700/60 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-slate-200 truncate">{user!.displayName}</div>
          <div className="text-[8px] font-mono text-slate-500 truncate">@{user!.username}</div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <VerifiedBadge verified={user!.verified} />
          <VipBadge />
        </div>
      </button>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-violet-500/30 bg-violet-500/10 text-[9px] font-mono text-violet-300 hover:bg-violet-500/20"
        >
          <Home size={10} /> Home
        </button>
        <button
          type="button"
          onClick={() => onNavigate('activity')}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-slate-800 text-[9px] font-mono text-slate-500 hover:text-indigo-300"
        >
          <BarChart3 size={10} /> Activity
        </button>
        <button
          type="button"
          onClick={() => onNavigate('profile', { profileUsername: user!.username })}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-slate-800 text-[9px] font-mono text-slate-500 hover:text-slate-300"
        >
          <Settings size={10} /> Profile
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-violet-800/50 text-[9px] font-mono text-violet-400 hover:bg-violet-500/10"
          >
            <Shield size={10} /> Admin
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            setLogoutError('');
            const ok = await logout();
            if (!ok) setLogoutError(LOGOUT_ARCADE_BLOCKED);
          }}
          className="px-2 py-1.5 rounded border border-slate-800 text-slate-600 hover:text-rose-300"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={10} />
        </button>
      </div>
      {logoutError && (
        <p className="text-[8px] font-mono text-rose-400 px-1">{logoutError}</p>
      )}
    </div>
  );
}