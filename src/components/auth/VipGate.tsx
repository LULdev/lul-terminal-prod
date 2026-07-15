/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Crown, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../types/auth';

type VipGateProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  minRole?: 'vip' | 'admin';
};

export function VipGate({
  children,
  title = 'VIP Area',
  description = 'This area is only accessible to VIP and admin users.',
  minRole = 'vip',
}: VipGateProps) {
  const { isLoggedIn, isVip, isAdmin, openAuth, loading } = useAuth();

  const allowed = minRole === 'admin' ? isAdmin : isVip;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-[10px] font-mono text-slate-500">
        Loading session…
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[280px] rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 via-[#0c0d12] to-violet-950/20 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center mb-4">
        {isLoggedIn ? <Lock className="text-amber-400" size={24} /> : <Crown className="text-amber-400" size={24} />}
      </div>
      <h3 className="text-sm font-semibold text-amber-200 mb-1">{title}</h3>
      <p className="text-[10px] font-mono text-slate-500 max-w-sm leading-relaxed mb-4">{description}</p>
      {!isLoggedIn ? (
        <button
          type="button"
          onClick={() => openAuth('login')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-200 text-[10px] font-mono hover:bg-indigo-500/20"
        >
          <LogIn size={12} /> Sign in
        </button>
      ) : (
        <p className="text-[9px] font-mono text-slate-600">
          Current role: <span className="text-slate-400">{ROLE_LABELS[isAdmin ? 'admin' : isVip ? 'vip' : 'user']}</span>
          {' · '}VIP access required
        </p>
      )}
    </div>
  );
}

export function VipBadge() {
  const { isVip, isAdmin, isLoggedIn } = useAuth();
  if (!isLoggedIn) return null;
  if (!isVip && !isAdmin) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/35 bg-amber-500/10 text-[8px] font-mono text-amber-300 uppercase">
      <Crown size={10} />
      {isAdmin ? 'Admin' : 'VIP'}
    </span>
  );
}