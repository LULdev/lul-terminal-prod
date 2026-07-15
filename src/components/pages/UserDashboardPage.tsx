/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Crown,
  Eye,
  Gift,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Mail,
  MessageSquare,
  Shield,
  Sparkles,
  Terminal,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as authApi from '../../lib/auth';
import { LOGOUT_ARCADE_BLOCKED } from '../../lib/authMessages';
import { fetchMyActivity } from '../../lib/analytics';
import { fetchReferralInfo } from '../../lib/auth';
import {
  ACHIEVEMENT_BY_ID,
  ACHIEVEMENT_CATALOG,
  TIER_STYLES,
} from '../../data/achievements';
import { ROLE_LABELS, type UserRole } from '../../types/auth';
import { TabId } from '../../config/menuItems';
import { ActionButton, PageShell, ToolCard } from './PageShell';
import { VerifiedBadge } from '../auth/VerifiedBadge';
import { VipBadge } from '../auth/VipGate';
import { TodayActiveUsers } from '../dashboard/TodayActiveUsers';

type UserDashboardPageProps = {
  onNavigate?: (tab: TabId, opts?: { profileUsername?: string }) => void;
};

const ROLE_GLOW: Record<UserRole, string> = {
  user: 'from-slate-600/30',
  vip: 'from-amber-500/35',
  admin: 'from-violet-500/40',
  bot: 'from-sky-500/35',
};

function formatDate(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 86_400_000) return 'today';
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return formatDate(ts);
}

export function UserDashboardPage({ onNavigate }: UserDashboardPageProps) {
  const { user, permissions, accountsSubmitted, isLoggedIn, openAuth, logout, refresh, handleUnlocks } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [activity, setActivity] = useState<{ pageVisits: number; commandsRun: number; shoutboxSent: number } | null>(null);
  const { mountedRef, loadGenRef } = useMountedLoad();

  useEffect(() => {
    if (user) setEmail(user.email);
  }, [user]);

  const loadExtras = useCallback(async () => {
    if (!isLoggedIn) return;
    const gen = ++loadGenRef.current;
    try {
      const [ref, act] = await Promise.all([
        fetchReferralInfo().catch(() => null),
        fetchMyActivity().catch(() => null),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      if (ref?.inviteUrl) setInviteUrl(ref.inviteUrl);
      if (act?.user?.activity) {
        setActivity({
          pageVisits: act.user.activity.pageVisits,
          commandsRun: act.user.activity.commandsRun,
          shoutboxSent: act.user.activity.shoutboxSent,
        });
      }
    } catch { /* ignore */ }
  }, [isLoggedIn, loadGenRef, mountedRef]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const earnedSorted = useMemo(() => {
    if (!user?.achievements?.length) return [];
    return [...user.achievements]
      .sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0));
  }, [user?.achievements]);

  const recentAchievements = useMemo(
    () => earnedSorted.slice(0, 8).map((e) => ({ ...e, def: ACHIEVEMENT_BY_ID[e.id] })).filter((x) => x.def),
    [earnedSorted],
  );

  const achievementProgress = useMemo(() => {
    const total = ACHIEVEMENT_CATALOG.filter((a) => a.kind === 'achievement').length;
    const earned = earnedSorted.filter((e) => ACHIEVEMENT_BY_ID[e.id]?.kind === 'achievement').length;
    return { earned, total, pct: total ? Math.round((earned / total) * 100) : 0 };
  }, [earnedSorted]);

  const saveSecurity = async () => {
    if (!email.trim() || !user) return;
    const emailChanged = email.trim().toLowerCase() !== user.email.trim().toLowerCase();
    if (emailChanged && !currentPassword) {
      setErr('Current password required to change email');
      return;
    }
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const result = await authApi.updateProfile({
        email: email.trim(),
        ...((password || emailChanged) ? { currentPassword } : {}),
        ...(password ? { password } : {}),
      });
      handleUnlocks(result.newUnlocks ?? [], result.unlockRewards);
      await refresh();
      setPassword('');
      setCurrentPassword('');
      setMsg(password ? 'Email & password updated' : 'Email updated');
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const nav = (tab: TabId, opts?: { profileUsername?: string }) => onNavigate?.(tab, opts);

  if (!isLoggedIn || !user) {
    return (
      <PageShell id="user-dashboard" pageId="dashboard" icon="🏠" title="Dashboard" subtitle="Your LUL Terminal" accentClass="text-violet-400">
        <ToolCard title="Welcome" icon="🔐" accent="violet">
          <p className="text-[10px] font-mono text-slate-500 mb-4 leading-relaxed">
            Sign in or register — then you land here with stats, achievements, and settings.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => openAuth('login')} variant="indigo">Sign in</ActionButton>
            <button type="button" onClick={() => openAuth('register')} className="px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-violet-300">
              Register
            </button>
          </div>
        </ToolCard>
      </PageShell>
    );
  }

  const ps = user.profileStats;
  const glow = ROLE_GLOW[user.role];

  return (
    <PageShell id="user-dashboard" pageId="dashboard" icon="🏠" title="Dashboard" subtitle={`Welcome, ${user.displayName}`} accentClass="text-violet-400">
      <div className="space-y-4 max-w-5xl">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-[#0c0d12]">
          <div className={`absolute inset-0 bg-gradient-to-br ${glow} via-transparent to-indigo-950/40 pointer-events-none`} />
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <img src={safeAvatarUrl(user.avatarUrl, user.username)} alt={user.displayName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-violet-500/30 shadow-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-white truncate">{user.displayName}</h2>
                <VerifiedBadge verified={user.verified} />
                <VipBadge />
                <span className="px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-[8px] font-mono uppercase text-violet-200">
                  {ROLE_LABELS[user.role]}
                </span>
                {ps?.isOnline && <span className="text-[8px] font-mono text-emerald-400">● online</span>}
              </div>
              <p className="text-[10px] font-mono text-slate-500">@{user.username} · Member since {formatDate(user.createdAt)}</p>
              <p className="text-[9px] font-mono text-slate-600 mt-1">Last login: {formatDate(user.lastLoginAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button type="button" onClick={() => nav('profile', { profileUsername: user.username })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-500/35 bg-indigo-500/10 text-[9px] font-mono text-indigo-200 hover:bg-indigo-500/20">
                <User size={11} /> Profile
              </button>
              {permissions.admin && (
                <button type="button" onClick={() => nav('admin')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-500/35 text-[9px] font-mono text-violet-300 hover:bg-violet-500/15">
                  <Shield size={11} /> Admin
                </button>
              )}
            </div>
          </div>

          {/* Achievement progress */}
          <div className="relative px-5 sm:px-6 pb-5">
            <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 mb-1.5">
              <span className="flex items-center gap-1"><Award size={10} className="text-amber-400" /> Achievements</span>
              <span>{achievementProgress.earned}/{achievementProgress.total} · {achievementProgress.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-600 to-amber-500 transition-all duration-500" style={{ width: `${achievementProgress.pct}%` }} />
            </div>
          </div>
        </div>

        {permissions.admin && (
          <TodayActiveUsers onNavigate={nav} currentUsername={user.username} />
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <DashStat icon={Eye} label="Profile views" value={user.profileViews ?? 0} accent="text-cyan-300" />
          <DashStat icon={Clock} label="Online Min" value={ps?.onlineMinutes ?? 0} accent="text-emerald-300" />
          <DashStat icon={ImageIcon} label="Uploads" value={user.imagesUploaded ?? 0} accent="text-sky-300" />
          <DashStat icon={Sparkles} label="Memes" value={user.memesCreated ?? 0} accent="text-rose-300" />
          <DashStat icon={Users} label="Referrals" value={user.referralsCount ?? 0} accent="text-violet-300" />
          <DashStat icon={Award} label="Achievements" value={earnedSorted.length} accent="text-amber-300" />
          <DashStat icon={MessageSquare} label="Shoutbox" value={ps?.shoutboxMessages ?? 0} accent="text-teal-300" />
          <DashStat icon={Crown} label="Submitted" value={accountsSubmitted} accent="text-amber-200" />
          <DashStat icon={Zap} label="Premium Vault" value={ps?.premiumAccounts ?? 0} accent="text-amber-300" />
          <DashStat icon={Gift} label="Free Vault" value={ps?.freeAccounts ?? 0} accent="text-lime-300" />
          <DashStat icon={Activity} label="Pages" value={activity?.pageVisits ?? '—'} accent="text-indigo-300" />
          <DashStat icon={Terminal} label="Commands" value={activity?.commandsRun ?? '—'} accent="text-orange-300" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Security */}
          <ToolCard title="Security" icon="🔐" accent="rose">
            <p className="text-[9px] font-mono text-slate-500 mb-3">Email and password — profile & avatar under "Profile".</p>
            {msg && <p className="text-[9px] font-mono text-emerald-400 mb-2 flex items-center gap-1"><Check size={11} /> {msg}</p>}
            {err && <p className="text-[9px] font-mono text-rose-400 mb-2">{err}</p>}
            <div className="space-y-3">
              <label className="block text-[9px] font-mono text-slate-500">
                <Mail size={10} className="inline mr-1" /> Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[10px] text-slate-200 focus:border-rose-500/40 focus:outline-none"
                />
              </label>
              {(password || (user && email.trim().toLowerCase() !== user.email.trim().toLowerCase())) ? (
                <label className="block text-[9px] font-mono text-slate-500">
                  <KeyRound size={10} className="inline mr-1" /> Current password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={password ? 'Required to set a new password' : 'Required to change email'}
                    className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[10px] text-slate-200 focus:border-rose-500/40 focus:outline-none"
                  />
                </label>
              ) : null}
              <label className="block text-[9px] font-mono text-slate-500">
                <KeyRound size={10} className="inline mr-1" /> New password (optional)
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank = unchanged"
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[10px] text-slate-200 focus:border-rose-500/40 focus:outline-none"
                />
              </label>
              <ActionButton onClick={saveSecurity} variant="indigo" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </ActionButton>
            </div>
          </ToolCard>

          {/* Quick links */}
          <ToolCard title="Quick links" icon="⚡" accent="cyan">
            <div className="grid grid-cols-2 gap-2">
              <QuickLink icon="👤" label="Edit profile" onClick={() => nav('profile', { profileUsername: user.username })} />
              <QuickLink icon="📊" label="My activity" onClick={() => nav('activity')} />
              <QuickLink icon="🎁" label="Invite friends" onClick={() => nav('invite')} />
              {permissions.premiumView && <QuickLink icon="👑" label="Premium Accounts" onClick={() => nav('premiumaccounts')} />}
              <QuickLink icon="☁️" label="Image Hosting" onClick={() => nav('imagehost')} />
              <QuickLink icon="🗄️" label="Proxy Database" onClick={() => nav('proxydatabase')} />
              <QuickLink icon="🛠️" label="Net Toolkit" onClick={() => nav('tools')} />
              <QuickLink icon="📜" label="Changelog" onClick={() => nav('changelog')} />
            </div>
            {inviteUrl && (
              <div className="mt-3 p-2 rounded-lg border border-violet-500/20 bg-violet-500/5">
                <div className="text-[8px] font-mono text-slate-500 mb-1">Your invite link</div>
                <code className="text-[8px] font-mono text-violet-300 break-all">{inviteUrl}</code>
              </div>
            )}
          </ToolCard>
        </div>

        {/* Permissions + account */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ToolCard title="Permissions" icon="✨" accent="amber">
            <div className="flex flex-wrap gap-2">
              <PermBadge label="View premium" ok={permissions.premiumView} />
              <PermBadge label="Submit accounts" ok={permissions.premiumSubmit} />
              <PermBadge label="Verified" ok={permissions.isVerified} />
              <PermBadge label="Admin" ok={permissions.admin} />
            </div>
          </ToolCard>
          <ToolCard title="Account" icon="⚙️" accent="indigo">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1"><Calendar size={10} /> Registered {formatDate(user.createdAt)}</span>
              <button
                type="button"
                onClick={async () => {
                  setErr('');
                  const ok = await logout();
                  if (!ok) setErr(LOGOUT_ARCADE_BLOCKED);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-500 hover:text-rose-300"
              >
                <LogOut size={11} /> Sign out
              </button>

            </div>
          </ToolCard>
        </div>

        {/* Recent achievements */}
        <ToolCard title="Recently unlocked" icon="🏆" accent="violet">
          {recentAchievements.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {recentAchievements.map(({ id, earnedAt, def }) => def && (
                <div
                  key={id}
                  title={def.description}
                  className={`rounded-xl border p-3 flex flex-col gap-1 ${TIER_STYLES[def.tier]} achievement-card-unlocked`}
                >
                  <span className="text-2xl">{def.icon}</span>
                  <span className="text-[9px] font-semibold text-white leading-tight">{def.name}</span>
                  <span className="text-[7px] font-mono text-slate-500">{formatRelative(earnedAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-mono text-slate-600 py-4 text-center">No achievements yet — explore tabs, terminal & tools!</p>
          )}
          <button type="button" onClick={() => nav('profile', { profileUsername: user.username })} className="mt-3 inline-flex items-center gap-1 text-[9px] font-mono text-violet-400 hover:text-violet-300">
            All achievements on profile <ArrowRight size={11} />
          </button>
        </ToolCard>
      </div>
    </PageShell>
  );
}

function DashStat({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/25 p-3 hover:border-slate-700/80 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={accent} />
        <span className="text-[7px] font-mono text-slate-600 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-mono font-bold tabular-nums ${accent}`}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
    </div>
  );
}

function QuickLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-800/80 bg-black/20 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
    >
      <span className="text-base">{icon}</span>
      <span className="text-[9px] font-mono text-slate-400 group-hover:text-cyan-200 flex-1">{label}</span>
      <ArrowRight size={10} className="text-slate-700 group-hover:text-cyan-400" />
    </button>
  );
}

function PermBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`px-2 py-1 rounded-lg border text-[8px] font-mono ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 text-slate-600'}`}>
      {ok ? '✓' : '○'} {label}
    </span>
  );
}