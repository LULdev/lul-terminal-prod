/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BarChart3, Crown, Home, LogIn, LogOut, Settings, Shield, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LOGOUT_ARCADE_BLOCKED } from '../../lib/authMessages';
import { TabId } from '../../config/menuItems';
import { VipBadge } from './VipGate';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { VerifiedBadge } from './VerifiedBadge';

type UserBarProps = {
  onNavigate: (tab: TabId, opts?: { profileUsername?: string }) => void;
};

type NavKey = 'dashboard' | 'activity' | 'profile' | 'admin';

function NavChip({
  label,
  icon,
  onClick,
  variant = 'default',
  title,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'home' | 'admin' | 'danger';
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      className={`userbar-nav-chip userbar-nav-chip--${variant}`}
    >
      <span className="userbar-nav-chip__glow" aria-hidden />
      <span className="userbar-nav-chip__icon">{icon}</span>
      <span className="userbar-nav-chip__label">{label}</span>
    </button>
  );
}

export function UserBar({ onNavigate }: UserBarProps) {
  const { user, isLoggedIn, isAdmin, openAuth, logout, loading } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const [busyLogout, setBusyLogout] = useState(false);

  if (loading) {
    return (
      <div className="userbar-shell userbar-shell--loading shrink-0">
        <div className="userbar-skeleton" />
        <p className="text-[9px] font-mono text-slate-600 text-center pt-1">Loading session…</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="userbar-shell userbar-shell--guest shrink-0 relative z-30 pointer-events-auto">
        <div className="userbar-guest-card">
          <div className="userbar-guest-card__icon" aria-hidden>
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-100 tracking-tight">Join the terminal</div>
            <div className="text-[8px] font-mono text-slate-500 mt-0.5 leading-snug">
              Sign in for shoutbox, arcade, pastes & more
            </div>
          </div>
        </div>
        <div className="userbar-guest-actions">
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="userbar-cta userbar-cta--primary relative z-10"
          >
            <LogIn size={13} strokeWidth={2.25} />
            <span>Sign in</span>
          </button>
          <button
            type="button"
            onClick={() => openAuth('register')}
            className="userbar-cta userbar-cta--secondary relative z-10"
          >
            <UserPlus size={13} strokeWidth={2.25} />
            <span>Register</span>
          </button>
        </div>
      </div>
    );
  }

  const go = (key: NavKey) => {
    if (key === 'profile') {
      onNavigate('profile', { profileUsername: user!.username });
      return;
    }
    onNavigate(key);
  };

  const handleLogout = async () => {
    setLogoutError('');
    setBusyLogout(true);
    try {
      const ok = await logout();
      if (!ok) setLogoutError(LOGOUT_ARCADE_BLOCKED);
    } finally {
      setBusyLogout(false);
    }
  };

  return (
    <div className="userbar-shell userbar-shell--authed shrink-0">
      <button
        type="button"
        onClick={() => go('profile')}
        className="userbar-profile"
        title="Open your profile"
      >
        <span className="userbar-profile__ring" aria-hidden />
        <img
          src={safeAvatarUrl(user!.avatarUrl, user!.username)}
          alt={user!.displayName}
          className="userbar-profile__avatar"
        />
        <div className="userbar-profile__meta min-w-0 flex-1 text-left">
          <div className="userbar-profile__name truncate">{user!.displayName}</div>
          <div className="userbar-profile__handle truncate">@{user!.username}</div>
        </div>
        <div className="userbar-profile__badges flex items-center gap-1 shrink-0">
          <VerifiedBadge verified={user!.verified} />
          <VipBadge />
        </div>
      </button>

      <div className="userbar-nav" role="navigation" aria-label="Account shortcuts">
        <NavChip
          label="Home"
          icon={<Home size={12} strokeWidth={2.25} />}
          onClick={() => go('dashboard')}
          variant="home"
        />
        <NavChip
          label="Activity"
          icon={<BarChart3 size={12} strokeWidth={2.25} />}
          onClick={() => go('activity')}
        />
        <NavChip
          label="Profile"
          icon={<Settings size={12} strokeWidth={2.25} />}
          onClick={() => go('profile')}
        />
        {isAdmin && (
          <NavChip
            label="Admin"
            icon={<Shield size={12} strokeWidth={2.25} />}
            onClick={() => go('admin')}
            variant="admin"
          />
        )}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={busyLogout}
          className="userbar-nav-chip userbar-nav-chip--danger userbar-nav-chip--icon-only"
          title="Sign out"
          aria-label="Sign out"
        >
          <span className="userbar-nav-chip__glow" aria-hidden />
          <span className="userbar-nav-chip__icon">
            <LogOut size={12} strokeWidth={2.25} />
          </span>
        </button>
      </div>

      {logoutError && (
        <p className="userbar-error" role="alert">
          {logoutError}
        </p>
      )}
    </div>
  );
}
