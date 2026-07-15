/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, LogIn, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStoredReferralCode } from '../../lib/referral';

export function AuthModal() {
  const { authModal, closeAuth, openAuth, login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    if (authModal) {
      setError('');
      setPassword('');
      if (authModal === 'register') setReferralCode(getStoredReferralCode());
    }
  }, [authModal]);

  if (!authModal) return null;

  const isLogin = authModal === 'login';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email or username is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await login(trimmedEmail, password, remember);
      } else {
        await register({
          email: trimmedEmail,
          password,
          username: username || undefined,
          displayName: displayName || undefined,
          referralCode: referralCode.trim() || undefined,
          website: honeypot,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 pointer-events-auto overflow-auto"
      role="presentation"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-default"
        onClick={closeAuth}
        aria-label="Close dialog"
      />
      <div
        className="relative z-10 w-[28rem] max-w-[calc(100vw-2rem)] origin-center scale-[2] pointer-events-auto rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-[#0c0d12] via-[#111827] to-[#0a0c10] shadow-2xl shadow-indigo-950/40 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="relative h-20 bg-gradient-to-r from-indigo-600/30 via-violet-600/20 to-cyan-600/20 border-b border-slate-800/80">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(99,102,241,0.25),transparent_50%)]" />
          <button
            type="button"
            onClick={closeAuth}
            className="absolute top-3 right-3 z-20 cursor-pointer p-1.5 rounded-lg border border-slate-700/60 text-slate-500 hover:text-white hover:border-slate-500"
            aria-label="Close"
          >
            <X size={14} />
          </button>
          <div className="relative z-10 px-5 pt-5 flex items-center gap-2">
            <Crown className="text-amber-400" size={18} />
            <div>
              <h2 id="auth-modal-title" className="text-sm font-semibold text-white">LUL Identity</h2>
              <p className="text-[9px] font-mono text-slate-500">Secure Terminal Access</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-5 pt-4 flex gap-2" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            onClick={() => openAuth('login')}
            className={`relative z-10 flex-1 flex cursor-pointer items-center justify-center gap-1.5 py-2 rounded-lg border text-[10px] font-mono ${
              isLogin ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200' : 'border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <LogIn size={12} /> Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            onClick={() => openAuth('register')}
            className={`relative z-10 flex-1 flex cursor-pointer items-center justify-center gap-1.5 py-2 rounded-lg border text-[10px] font-mono ${
              !isLogin ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <UserPlus size={12} /> Register
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3">
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden"
          />
          {!isLogin && (
            <>
              <Field label="Username" value={username} onChange={setUsername} placeholder="optional" />
              <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="optional" />
            </>
          )}
          {!isLogin && (
            <Field label="Invite code (optional)" value={referralCode} onChange={setReferralCode} placeholder="LUL-XXXXXXXX" />
          )}
          <Field
            label={isLogin ? 'Email or username' : 'Email'}
            value={email}
            onChange={setEmail}
            placeholder={isLogin ? 'admin or you@terminal.dev' : 'you@terminal.dev'}
            type={isLogin ? 'text' : 'email'}
            autoComplete={isLogin ? 'username' : 'email'}
          />
          <Field label="Password" value={password} onChange={setPassword} placeholder="min. 6 characters" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} />
          {isLogin && (
            <label className="flex items-center gap-2 text-[10px] font-mono text-slate-400 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-indigo-500" />
              Stay signed in (30 days)
            </label>
          )}
          {error && <p className="text-[10px] font-mono text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 text-indigo-100 text-[11px] font-mono hover:bg-indigo-500/25 disabled:opacity-40"
          >
            {loading ? (isLogin ? 'Signing in…' : 'Creating account…') : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text', autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string;
}) {
  const id = `auth-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label className="block" htmlFor={id}>
      <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 focus:border-indigo-500/50 focus:outline-none"
      />
    </label>
  );
}