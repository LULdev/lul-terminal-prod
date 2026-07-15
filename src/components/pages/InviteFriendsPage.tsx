/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Gift, Link2, LogIn, Share2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as authApi from '../../lib/auth';
import { buildClientInviteUrl } from '../../lib/referral';
import { PageShell } from './PageShell';

export function InviteFriendsPage() {
  const { isLoggedIn, openAuth, user } = useAuth();
  const [inviteUrl, setInviteUrl] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralsCount, setReferralsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const loadReferral = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const info = await authApi.fetchReferralInfo();
      setInviteUrl(info.inviteUrl || buildClientInviteUrl(info.referralCode));
      setReferralCode(info.referralCode);
      setReferralsCount(info.referralsCount);
    } catch (e) {
      const code = user?.referralCode ?? '';
      if (code) {
        setReferralCode(code);
        setInviteUrl(buildClientInviteUrl(code));
        setReferralsCount(user?.referralsCount ?? 0);
      } else {
        setError(e instanceof Error ? e.message : 'Invite data unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.referralCode, user?.referralsCount]);

  useEffect(() => {
    if (isLoggedIn) loadReferral();
  }, [isLoggedIn, loadReferral]);

  const copyText = async (text: string, kind: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Copy failed — select text manually');
    }
  };

  if (!isLoggedIn) {
    return (
      <PageShell
        id="invite-module"
        pageId="invite"
        icon="🎁"
        title="Invite Friends"
        subtitle="Invite friends · referral link · grow members"
        accentClass="text-fuchsia-400"
      >
        <div className="max-w-lg mx-auto rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/25 via-[#0c0d12] to-violet-950/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10">
            <Gift className="text-fuchsia-300" size={28} />
          </div>
          <h3 className="text-sm font-semibold text-white mb-2">Invites require an account</h3>
          <p className="text-[10px] font-mono text-slate-500 leading-relaxed mb-6">
            Sign in to get your personal invite link and track referred members.
          </p>
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-100 text-[11px] font-mono hover:bg-fuchsia-500/25 transition"
          >
            <LogIn size={14} /> Sign in
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      id="invite-module"
      pageId="invite"
      icon="🎁"
      title="Invite Friends"
      subtitle="Share your link — new members are credited to your profile"
      accentClass="text-fuchsia-400"
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/30 via-[#0c0d12] to-indigo-950/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10">
              <Share2 className="text-fuchsia-300" size={22} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Your invite link</h3>
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                Anyone who registers via your link counts as a referred member. The code is applied automatically at registration.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800/80 bg-[#161a24] p-4">
            <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
              <Users size={12} className="text-fuchsia-400" />
              Referred members
            </div>
            <p className="text-2xl font-semibold text-fuchsia-200 tabular-nums">
              {loading ? '…' : referralsCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-[#161a24] p-4">
            <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
              <UserPlus size={12} className="text-emerald-400" />
              Your code
            </div>
            <p className="text-lg font-mono font-semibold text-emerald-200 truncate">
              {loading ? '…' : referralCode || '—'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#12151c] p-4 space-y-3">
          <label className="block">
            <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1.5">
              <Link2 size={10} /> Invite URL
            </span>
            <div className="flex gap-2">
              <input
                readOnly
                value={loading ? 'Loading…' : inviteUrl}
                className="flex-1 min-w-0 bg-black/40 border border-slate-800 rounded-lg px-3 py-2.5 text-[10px] font-mono text-slate-300 focus:outline-none"
              />
              <button
                type="button"
                disabled={!inviteUrl || loading}
                onClick={() => copyText(inviteUrl, 'link')}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-fuchsia-500/35 bg-fuchsia-500/10 text-[10px] font-mono text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-40 transition"
              >
                {copied === 'link' ? <Check size={12} /> : <Copy size={12} />}
                {copied === 'link' ? 'OK' : 'Link'}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 block">Referral code</span>
            <div className="flex gap-2">
              <input
                readOnly
                value={loading ? '…' : referralCode}
                className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-3 py-2.5 text-[11px] font-mono text-emerald-300 focus:outline-none"
              />
              <button
                type="button"
                disabled={!referralCode || loading}
                onClick={() => copyText(referralCode, 'code')}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-[10px] font-mono text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40 transition"
              >
                {copied === 'code' ? <Check size={12} /> : <Copy size={12} />}
                {copied === 'code' ? 'OK' : 'Code'}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <p className="text-[10px] font-mono text-rose-400 text-center">{error}</p>
        )}

        <div className="rounded-xl border border-slate-800/60 bg-[#0c0d12]/80 p-4">
          <h4 className="text-[10px] font-semibold text-slate-300 mb-2">How it works</h4>
          <ol className="space-y-2 text-[10px] font-mono text-slate-500 list-decimal list-inside leading-relaxed">
            <li>Copy the link and send it to friends (Discord, WhatsApp, …).</li>
            <li>Friend opens the link — the code is saved.</li>
            <li>The code is applied automatically during registration.</li>
            <li>Your profile shows the number of referred members.</li>
          </ol>
        </div>
      </div>
    </PageShell>
  );
}