/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, LogIn, Shield, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getFeatureGateInfo } from '../../config/accessControl';

const ACCENT_STYLES: Record<string, { header: string; border: string; glow: string; btn: string }> = {
  violet: {
    header: 'from-violet-600/30 via-indigo-600/15 to-transparent',
    border: 'border-violet-500/25',
    glow: 'shadow-violet-950/30',
    btn: 'border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25',
  },
  cyan: {
    header: 'from-cyan-600/30 via-sky-600/15 to-transparent',
    border: 'border-cyan-500/25',
    glow: 'shadow-cyan-950/30',
    btn: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25',
  },
  rose: {
    header: 'from-rose-600/30 via-pink-600/15 to-transparent',
    border: 'border-rose-500/25',
    glow: 'shadow-rose-950/30',
    btn: 'border-rose-500/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25',
  },
  amber: {
    header: 'from-amber-600/30 via-orange-600/15 to-transparent',
    border: 'border-amber-500/25',
    glow: 'shadow-amber-950/30',
    btn: 'border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
  },
  indigo: {
    header: 'from-indigo-600/30 via-violet-600/15 to-transparent',
    border: 'border-indigo-500/25',
    glow: 'shadow-indigo-950/30',
    btn: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/25',
  },
  emerald: {
    header: 'from-emerald-600/30 via-teal-600/15 to-transparent',
    border: 'border-emerald-500/25',
    glow: 'shadow-emerald-950/30',
    btn: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
  },
  orange: {
    header: 'from-orange-600/30 via-amber-600/15 to-transparent',
    border: 'border-orange-500/25',
    glow: 'shadow-orange-950/30',
    btn: 'border-orange-500/40 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25',
  },
};

export function FeatureLoginGate() {
  const { loginGate, closeLoginGate, dismissLoginGateUI, openAuthFromGate, isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn && loginGate) dismissLoginGateUI();
  }, [isLoggedIn, loginGate, dismissLoginGateUI]);

  if (!loginGate) return null;

  const info = getFeatureGateInfo(loginGate.tab);
  const style = ACCENT_STYLES[info.accent] ?? ACCENT_STYLES.indigo;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] isolate flex items-center justify-center p-4 pointer-events-auto overflow-auto"
      role="presentation"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-default"
        onClick={closeLoginGate}
        aria-label="Close dialog"
      />
      <div
        className={`relative z-10 w-[28rem] max-w-[calc(100vw-2rem)] origin-center scale-[2.5] pointer-events-auto rounded-2xl border ${style.border} bg-gradient-to-br from-[#0c0d12] via-[#111827] to-[#0a0c10] shadow-2xl ${style.glow} overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-gate-title"
      >
        <div className={`relative px-5 py-5 bg-gradient-to-r ${style.header} border-b border-slate-800/80`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.12),transparent_55%)]" />
          <button
            type="button"
            onClick={closeLoginGate}
            className="absolute top-3 right-3 z-20 cursor-pointer p-1.5 rounded-lg border border-slate-700/60 text-slate-500 hover:text-white hover:border-slate-500 transition"
            aria-label="Close"
          >
            <X size={14} />
          </button>
          <div className="relative z-10 flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl border border-slate-700/50 bg-black/40 flex items-center justify-center text-2xl shrink-0">
              {info.icon}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-1">Members Only</p>
              <h2 id="feature-gate-title" className="text-base font-semibold text-white leading-tight">{info.title}</h2>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
            {info.description}
          </p>

          <ul className="space-y-1.5">
            {info.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <ArrowRight size={10} className="text-emerald-500/80 shrink-0" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40">
            <Shield size={12} className="text-sky-400 shrink-0 mt-0.5" />
            <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
              Public user profiles stay open — anyone with a profile link can view them without signing in.
            </p>
          </div>

          <div className="relative z-10 flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => openAuthFromGate('login')}
              className={`relative z-10 flex-1 flex cursor-pointer items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-mono transition ${style.btn}`}
            >
              <LogIn size={13} /> Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuthFromGate('register')}
              className="relative z-10 flex-1 flex cursor-pointer items-center justify-center gap-1.5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-100 text-[11px] font-mono hover:bg-emerald-500/20 transition"
            >
              <UserPlus size={13} /> Create Account
            </button>
          </div>

          <button
            type="button"
            onClick={closeLoginGate}
            className="relative z-10 w-full cursor-pointer text-[9px] font-mono text-slate-600 hover:text-slate-400 py-1 transition"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}