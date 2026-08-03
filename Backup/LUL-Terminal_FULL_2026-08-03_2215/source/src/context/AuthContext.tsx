/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authApi from '../lib/auth';
import type { SyncAchievementsOpts } from '../lib/auth';
import type { AuthPermissions, AuthUser } from '../types/auth';
import { AchievementNotification } from '../components/auth/AchievementNotification';
import { clearStoredReferralCode } from '../lib/referral';
import { clearAchievementProofs } from '../lib/achievementProof';
import { closeChatAudioContext } from '../lib/chat';
import { clearViewDedupSessionKeys } from '../lib/viewDedup';
import { bumpSessionEpoch, onSessionInvalidated, resetSessionInvalidation } from '../lib/sessionEvents';
import type { TabId } from '../config/menuItems';

type AuthMode = 'login' | 'register' | null;

export type PendingTabTarget = {
  tab: TabId;
  profileUsername?: string;
};

export type LoginGateState = PendingTabTarget | null;

type AuthContextValue = {
  user: AuthUser | null;
  permissions: AuthPermissions;
  accountsSubmitted: number;
  loading: boolean;
  authModal: AuthMode;
  loginGate: LoginGateState;
  pendingTabAfterLogin: PendingTabTarget | null;
  openAuth: (mode: 'login' | 'register') => void;
  openLoginGate: (tab: TabId, opts?: { profileUsername?: string }) => void;
  openAuthFromGate: (mode: 'login' | 'register') => void;
  closeLoginGate: () => void;
  dismissLoginGateUI: () => void;
  clearPendingTabAfterLogin: () => void;
  closeAuth: () => void;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (input: { email: string; password: string; username?: string; displayName?: string; referralCode?: string; website?: string }) => Promise<void>;
  logout: () => Promise<boolean>;
  refresh: () => Promise<void>;
  patchUser: (user: AuthUser | ((prev: AuthUser | null) => AuthUser | null)) => void;
  handleUnlocks: (ids: string[], rewards?: Record<string, number>) => void;
  syncAchievements: (opts?: SyncAchievementsOpts) => Promise<void>;
  authSuccessTick: number;
  isLoggedIn: boolean;
  isVip: boolean;
  isAdmin: boolean;
  isVerified: boolean;
};

const defaultPermissions: AuthPermissions = {
  premiumView: false,
  premiumSubmit: false,
  premiumDelete: false,
  admin: false,
  isVip: false,
  isVerified: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<AuthPermissions>(defaultPermissions);
  const [accountsSubmitted, setAccountsSubmitted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState<AuthMode>(null);
  const [loginGate, setLoginGate] = useState<LoginGateState>(null);
  const [pendingTabAfterLogin, setPendingTabAfterLogin] = useState<PendingTabTarget | null>(null);
  const [pendingUnlocks, setPendingUnlocks] = useState<string[]>([]);
  const [pendingUnlockRewards, setPendingUnlockRewards] = useState<Record<string, number>>({});
  const [authSuccessTick, setAuthSuccessTick] = useState(0);

  const openLoginGate = useCallback((tab: TabId, opts?: { profileUsername?: string }) => {
    const target: PendingTabTarget = { tab, profileUsername: opts?.profileUsername };
    setLoginGate(target);
    setPendingTabAfterLogin(target);
  }, []);

  const closeLoginGate = useCallback(() => {
    setLoginGate(null);
    setPendingTabAfterLogin(null);
  }, []);

  const dismissLoginGateUI = useCallback(() => {
    setLoginGate(null);
  }, []);

  const openAuth = useCallback((mode: 'login' | 'register') => {
    setLoginGate(null);
    setAuthModal(mode);
  }, []);

  const openAuthFromGate = useCallback((mode: 'login' | 'register') => {
    setLoginGate(null);
    setAuthModal(mode);
  }, []);

  const clearPendingTabAfterLogin = useCallback(() => {
    setPendingTabAfterLogin(null);
  }, []);

  const handleUnlocks = useCallback((
    ids: string[],
    rewards?: Record<string, number>,
  ) => {
    if (!ids?.length) return;
    setPendingUnlocks((prev) => {
      const merged = [...prev];
      for (const id of ids) {
        if (!merged.includes(id)) merged.push(id);
      }
      return merged;
    });
    if (rewards && Object.keys(rewards).length) {
      setPendingUnlockRewards((prev) => ({ ...prev, ...rewards }));
    }
  }, []);

  const patchUser = useCallback((next: AuthUser | ((prev: AuthUser | null) => AuthUser | null)) => {
    if (typeof next === 'function') {
      setUser((prev) => next(prev));
    } else {
      setUser(next);
    }
  }, []);

  const refreshGenRef = useRef(0);
  const userRef = useRef(user);
  userRef.current = user;

  const clearLocalSession = useCallback(() => {
    clearAchievementProofs();
    closeChatAudioContext();
    clearViewDedupSessionKeys();
    setUser(null);
    setPermissions(defaultPermissions);
    setAccountsSubmitted(0);
    setPendingUnlocks([]);
    setPendingUnlockRewards({});
    setLoginGate(null);
    setPendingTabAfterLogin(null);
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++refreshGenRef.current;
    try {
      const data = await authApi.fetchMe();
      if (gen !== refreshGenRef.current) return;
      if (data.user) {
        setUser(data.user);
        setPermissions(data.permissions ?? defaultPermissions);
        setAccountsSubmitted(data.stats?.accountsSubmitted ?? 0);
        resetSessionInvalidation();
      } else {
        // Soft /me with no user — clear zombie logged-in UI
        clearLocalSession();
      }
    } catch (e) {
      if (gen !== refreshGenRef.current) return;
      const status = (e as { status?: number })?.status;
      // Network blips must not wipe session; hard 401 does full local cleanup
      if (status === 401) {
        clearLocalSession();
      }
    }
  }, [clearLocalSession]);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      try {
        await Promise.race([
          refresh(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 12_000);
          }),
        ]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void boot();
    const retryAuth = () => {
      if (mounted && userRef.current) void refresh();
    };
    window.addEventListener('online', retryAuth);
    const onVisible = () => {
      if (document.visibilityState === 'visible') retryAuth();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted = false;
      window.removeEventListener('online', retryAuth);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    return onSessionInvalidated(() => {
      refreshGenRef.current += 1;
      // Leave queues BEFORE logout so the cookie is still valid (order matches explicit logout)
      void (async () => {
        try {
          const m = await import('../lib/arcadeCleanup');
          await m.leaveAllArcadeQueuesBestEffort();
        } catch { /* best-effort */ }
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch { /* best-effort */ }
      })();
      clearLocalSession();
      setAuthModal(null);
    });
  }, [clearLocalSession]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    refreshGenRef.current += 1;
    const loginGen = refreshGenRef.current;
    const data = await authApi.login(email, password, remember);
    // New session cookie is live — advance epoch so stale 401s cannot wipe this login
    bumpSessionEpoch();
    resetSessionInvalidation();
    if (loginGen !== refreshGenRef.current) {
      // Cookie set but UI gen advanced — reconcile via /me so we don't orphan cookie-only state
      void refresh();
      throw new Error('Sign-in interrupted — please try again');
    }
    setUser(data.user);
    if (data.permissions) setPermissions(data.permissions);
    if (data.stats?.accountsSubmitted != null) {
      setAccountsSubmitted(data.stats.accountsSubmitted);
    }
    handleUnlocks(data.newUnlocks ?? [], data.unlockRewards);
    setAuthModal(null);
    clearViewDedupSessionKeys();
    setAuthSuccessTick((t) => t + 1);
    try {
      const me = await authApi.fetchMe();
      if (loginGen !== refreshGenRef.current) return;
      if (me.user) {
        setUser(me.user);
        setPermissions(me.permissions ?? defaultPermissions);
        setAccountsSubmitted(me.stats?.accountsSubmitted ?? 0);
      }
    } catch {
      /* keep login response user */
    }
  }, [handleUnlocks, refresh]);

  const register = useCallback(async (input: {
    email: string;
    password: string;
    username?: string;
    displayName?: string;
    referralCode?: string;
    website?: string;
  }) => {
    const {
      collectRegistrationContext,
      fetchRegistrationChallenge,
    } = await import('../lib/registrationContext');
    const [registrationContext, challenge] = await Promise.all([
      collectRegistrationContext(),
      fetchRegistrationChallenge(),
    ]);
    await authApi.register({
      ...input,
      website: input.website ?? '',
      registrationChallenge: challenge.challenge,
      registrationContext,
    });
    clearStoredReferralCode();
    try {
      await login(input.email, input.password, true);
    } catch (e) {
      throw new Error(
        e instanceof Error
          ? `Account created but sign-in failed: ${e.message}`
          : 'Account created but sign-in failed — please sign in manually.',
      );
    }
  }, [login]);

  const logout = useCallback(async () => {
    refreshGenRef.current += 1;
    bumpSessionEpoch();
    // Leave arcade queues while cookie is still valid
    try {
      const { leaveAllArcadeQueuesBestEffort } = await import('../lib/arcadeCleanup');
      await leaveAllArcadeQueuesBestEffort();
    } catch { /* best-effort */ }
    try {
      await authApi.logout();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Cannot sign out') || msg.includes('arcade cleanup')) {
        return false;
      }
      /* clear local session even when server logout fails for other reasons */
    }
    clearLocalSession();
    resetSessionInvalidation();
    return true;
  }, [clearLocalSession]);

  const syncAchievements = useCallback(async (opts?: SyncAchievementsOpts) => {
    const gen = refreshGenRef.current;
    try {
      const data = await authApi.syncAchievements(opts);
      // Never resurrect a logged-out session from a late 200
      if (gen !== refreshGenRef.current) return;
      if (data.user) {
        setUser((prev) => (prev ? data.user! : null));
      }
      if (userRef.current) {
        handleUnlocks(data.newUnlocks ?? [], data.unlockRewards);
      }
    } catch {
      /* non-fatal — achievements may sync on next action */
    }
  }, [handleUnlocks]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    permissions,
    accountsSubmitted,
    loading,
    authModal,
    loginGate,
    pendingTabAfterLogin,
    openAuth,
    openLoginGate,
    openAuthFromGate,
    closeLoginGate,
    dismissLoginGateUI,
    clearPendingTabAfterLogin,
    closeAuth: () => setAuthModal(null),
    login,
    register,
    logout,
    refresh,
    patchUser,
    handleUnlocks,
    syncAchievements,
    authSuccessTick,
    isLoggedIn: Boolean(user),
    isVip: permissions.isVip,
    isAdmin: permissions.admin,
    isVerified: permissions.isVerified,
  }), [user, permissions, accountsSubmitted, loading, authModal, loginGate, pendingTabAfterLogin, authSuccessTick, login, register, logout, refresh, patchUser, handleUnlocks, syncAchievements, openAuth, openLoginGate, openAuthFromGate, closeLoginGate, dismissLoginGateUI, clearPendingTabAfterLogin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {pendingUnlocks.length > 0 && (
        <AchievementNotification
          unlockIds={pendingUnlocks}
          unlockRewards={pendingUnlockRewards}
          onDismiss={() => {
            setPendingUnlocks([]);
            setPendingUnlockRewards({});
          }}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}