/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { Radio, Users } from 'lucide-react';
import { fetchActiveTodayUsers, formatRelativeTime, type ActiveTodayUser } from '../../lib/analytics';
import { TabId } from '../../config/menuItems';
import { ROLE_LABELS, type UserRole } from '../../types/auth';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { VerifiedBadge } from '../auth/VerifiedBadge';

type TodayActiveUsersProps = {
  onNavigate?: (tab: TabId, opts?: { profileUsername?: string }) => void;
  currentUsername?: string;
};

const ROLE_RING: Record<UserRole, string> = {
  user: 'ring-slate-600/50',
  vip: 'ring-amber-500/50',
  admin: 'ring-violet-500/60',
  bot: 'ring-sky-500/40',
};

export function TodayActiveUsers({ onNavigate, currentUsername }: TodayActiveUsersProps) {
  const { isLoggedIn } = useAuth();
  const [data, setData] = useState<{
    date: string;
    count: number;
    onlineNow: number;
    users: ActiveTodayUser[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    if (!isLoggedIn) return;
    const gen = ++loadGenRef.current;
    fetchActiveTodayUsers()
      .then((d) => {
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        setData(d);
        setError('');
      })
      .catch(() => {
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        setData(null);
        setError('Could not load active users.');
      })
      .finally(() => {
        if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
      });
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setData(null);
      setLoading(false);
      return;
    }
    load();
  }, [load, isLoggedIn]);

  useVisibilityAwarePoll(load, 60_000, isLoggedIn);

  const users = data?.users ?? [];
  const onlineNow = data?.onlineNow ?? 0;
  const totalToday = data?.count ?? 0;

  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-r from-[#0a0f0d] via-[#0c0d12] to-[#0b0c10] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-emerald-500/10 bg-emerald-500/[0.03]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </span>
          <Radio size={12} className="text-emerald-400 shrink-0" />
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-300/90 truncate">
            Active in terminal today
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[8px] font-mono">
          <span className="text-emerald-400">
            <span className="font-bold tabular-nums">{onlineNow}</span>
            <span className="text-emerald-500/70 ml-1">live</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 flex items-center gap-1">
            <Users size={9} />
            <span className="font-bold tabular-nums text-slate-300">{totalToday}</span>
            <span className="text-slate-600">today</span>
          </span>
        </div>
      </div>

      <div className="px-3 py-3">
        {loading && !data ? (
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-28 rounded-full bg-slate-800/60 animate-pulse shrink-0" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-2 space-y-1.5">
            <p className="text-[9px] font-mono text-rose-400/90">{error}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); void load(); }}
              className="text-[9px] font-mono text-emerald-400 hover:text-emerald-300"
            >
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <p className="text-[9px] font-mono text-slate-600 text-center py-2">
            No one active today yet — be the pioneer.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-slate-800">
            {users.map((u) => (
              <React.Fragment key={u.id}>
                <UserChip
                  user={u}
                  isSelf={u.username === currentUsername}
                  onClick={() => onNavigate?.('profile', { profileUsername: u.username })}
                />
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserChip({
  user,
  isSelf,
  onClick,
}: {
  user: ActiveTodayUser;
  isSelf: boolean;
  onClick: () => void;
}) {
  const role = (user.role as UserRole) || 'user';
  const ring = ROLE_RING[role] ?? ROLE_RING.user;
  const title = `${user.displayName} (@${user.username})${user.isOnline ? ' · online now' : user.lastSeenAt ? ` · ${formatRelativeTime(user.lastSeenAt)}` : ''}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`group flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border shrink-0 transition-all hover:scale-[1.02] ${
        user.isOnline
          ? 'border-emerald-500/35 bg-emerald-500/[0.07] hover:bg-emerald-500/12 hover:border-emerald-400/50'
          : 'border-slate-800/80 bg-black/30 hover:border-slate-700 hover:bg-slate-800/40'
      } ${isSelf ? 'ring-1 ring-violet-500/40' : ''}`}
    >
      <span className="relative shrink-0">
        <img
          src={safeAvatarUrl(user.avatarUrl, user.username)}
          alt={user.displayName}
          className={`w-7 h-7 rounded-full object-cover ring-2 ${ring} ${user.isOnline ? 'shadow-[0_0_10px_rgba(52,211,153,0.35)]' : ''}`}
        />
        {user.isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0c0d12] shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
        )}
      </span>
      <span className="flex flex-col items-start min-w-0 max-w-[88px]">
        <span className="flex items-center gap-0.5 w-full">
          <span className={`text-[9px] font-semibold truncate ${user.isOnline ? 'text-emerald-100' : 'text-slate-300 group-hover:text-white'}`}>
            {user.displayName}
          </span>
          <VerifiedBadge verified={user.verified} size={9} />
        </span>
        <span className="text-[7px] font-mono text-slate-600 truncate w-full">
          {user.isOnline ? (
            <span className="text-emerald-400/90">● live</span>
          ) : user.lastSeenAt ? (
            formatRelativeTime(user.lastSeenAt)
          ) : (
            ROLE_LABELS[role]
          )}
        </span>
      </span>
    </button>
  );
}