/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Crown, Eye, User } from 'lucide-react';
import {
  approvePremiumAccount,
  createPremiumAccount,
  exportVaultAccountsText,
  fetchPremiumAccounts,
  fetchPremiumAccountStats,
  recordAccountView,
  isRegistrationRequiredError,
  rejectPremiumAccount,
  reportAccountNotWorking,
  type PremiumAccount,
  type PremiumAccountCategory,
  type PremiumAccountStats,
  type PremiumAccountStatus,
} from '../../lib/premiumAccounts';
import { PLAN_LABELS, PREMIUM_CATEGORY_LABELS, STATUS_LABELS, type PremiumAccountPlan } from '../../data/premiumAccounts';
import { useAuth } from '../../context/AuthContext';
import { VipGate } from '../auth/VipGate';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { PageShell } from './PageShell';
import { VaultPasswordReveal } from '../premium/VaultPasswordReveal';

const CATEGORIES: (PremiumAccountCategory | 'all')[] = [
  'all', 'streaming', 'vpn', 'software', 'gaming', 'porn', 'other',
];

const STATUS_STYLES: Record<PremiumAccountStatus, string> = {
  working: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10',
  working_free: 'text-lime-300 border-lime-600/40 bg-lime-950/25',
  offline: 'text-rose-300 border-rose-500/35 bg-rose-500/10',
  expired: 'text-amber-300 border-amber-500/35 bg-amber-500/10',
  unchecked: 'text-slate-400 border-slate-600/40 bg-slate-800/30',
};

function VipIcon({ className, size = 14 }: { className?: string; size?: number }) {
  return <Crown className={className} size={size} strokeWidth={2} aria-hidden />;
}

const CATEGORY_ACCENTS: Record<PremiumAccountCategory, string> = {
  streaming: 'from-rose-500/20 to-orange-500/10 border-rose-500/25',
  vpn: 'from-cyan-500/20 to-teal-500/10 border-cyan-500/25',
  software: 'from-indigo-500/20 to-violet-500/10 border-indigo-500/25',
  gaming: 'from-violet-500/20 to-fuchsia-500/10 border-violet-500/25',
  porn: 'from-pink-500/20 to-rose-500/10 border-pink-500/30',
  other: 'from-slate-500/20 to-slate-600/10 border-slate-600/30',
};

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border px-3 py-3 flex flex-col gap-0.5 ${accent}`}>
      <span className="text-[8px] font-mono uppercase tracking-widest opacity-70">{label}</span>
      <span className="text-xl font-mono font-bold tabular-nums leading-none">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </span>
      {sub && <span className="text-[8px] font-mono opacity-60">{sub}</span>}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wide">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 hover:text-amber-300 transition"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
      <div className="text-[10px] font-mono text-slate-300 bg-black/35 border border-slate-800/80 rounded-lg px-2.5 py-1.5 truncate">
        {value}
      </div>
    </div>
  );
}

function ReportConfirmPanel({
  service,
  reporting,
  onCancel,
  onConfirm,
}: {
  service: string;
  reporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-2.5 space-y-2">
      <p className="text-[9px] font-semibold text-amber-200">Really not working?</p>
      <p className="text-[8px] font-mono text-slate-400 leading-relaxed">
        Please confirm you <span className="text-slate-300">tested the login</span> for{' '}
        <span className="text-white">{service}</span> and the credentials genuinely failed
        (wrong password, expired, locked, or service down).
      </p>
      <p className="text-[8px] font-mono text-rose-300/90 leading-relaxed border border-rose-500/20 bg-rose-950/20 rounded-md px-2 py-1.5">
        <span className="font-semibold text-rose-200">Abuse warning:</span> False or repeated reports
        may be treated as misuse. Your account can be <span className="text-rose-200">suspended or banned</span>{' '}
        if admins find you misusing this button.
      </p>
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={reporting}
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-50 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={reporting}
          onClick={onConfirm}
          className="flex-1 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 text-[9px] font-mono text-rose-100 hover:bg-rose-500/25 disabled:opacity-50 transition"
        >
          {reporting ? 'Reporting…' : 'Yes, report it'}
        </button>
      </div>
    </div>
  );
}

function ReportRegistrationPrompt({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="rounded-lg border border-indigo-500/25 bg-indigo-950/20 p-2.5 space-y-2">
      <p className="text-[9px] font-semibold text-indigo-200">Registration required to report</p>
      <p className="text-[8px] font-mono text-slate-400 leading-relaxed">
        To flag an account as <span className="text-rose-300">not working</span>, you need:
      </p>
      <ul className="text-[8px] font-mono text-slate-500 space-y-1 list-disc list-inside leading-relaxed">
        <li>A free LUL Terminal account (signed in)</li>
        <li>The entry must be from another member (not your own submission)</li>
      </ul>
      <button
        type="button"
        onClick={onRegister}
        className="w-full py-2 rounded-lg border border-indigo-500/40 bg-indigo-500/15 text-[9px] font-mono text-indigo-100 hover:bg-indigo-500/25 transition"
      >
        Create free account →
      </button>
      <p className="text-[8px] font-mono text-slate-500 pt-0.5">Why register?</p>
      <ul className="text-[8px] font-mono text-slate-600 space-y-0.5 list-disc list-inside leading-relaxed">
        <li>Report broken premium accounts for admin review</li>
        <li>Public profile with achievements &amp; stats</li>
        <li>Personal referral link — invite friends</li>
        <li>Image upload counter on your profile</li>
        <li>Submit accounts to the vault (when verified)</li>
        <li>VIP vault access (with VIP role)</li>
      </ul>
    </div>
  );
}

function AdminReviewButtons({
  accountId,
  onDone,
}: {
  accountId: string;
  onDone: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState('');

  const act = async (action: 'approve' | 'approve_free' | 'reject') => {
    if (acting) return;
    if (action === 'reject' && !confirm('Reject and delete account?')) return;
    setActing(true);
    setErr('');
    try {
      if (action === 'approve') await approvePremiumAccount(accountId, 'working');
      else if (action === 'approve_free') await approvePremiumAccount(accountId, 'working_free');
      else await rejectPremiumAccount(accountId);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-mono text-amber-300/90 uppercase tracking-wide">Admin Review</span>
        <button
          type="button"
          disabled={acting}
          onClick={() => act('approve')}
          title="Confirm premium / working"
          className="px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/15 text-base leading-none hover:bg-emerald-500/25 disabled:opacity-40 transition"
        >
          ✅
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={() => act('approve_free')}
          title="FREE 💩 — Login ok, no premium"
          className="px-2 py-1 rounded border border-lime-600/40 bg-lime-950/30 text-base leading-none hover:bg-lime-900/40 disabled:opacity-40 transition"
        >
          💩
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={() => act('reject')}
          title="Reject — account will be deleted"
          className="px-2 py-1 rounded border border-rose-500/40 bg-rose-500/15 text-base leading-none hover:bg-rose-500/25 disabled:opacity-40 transition"
        >
          ❌
        </button>
      </div>
      {err && <p className="text-[8px] font-mono text-rose-400">{err}</p>}
    </div>
  );
}

const PremiumAccountCard: React.FC<{
  account: PremiumAccount;
  canReport: boolean;
  isOwnSubmission: boolean;
  isAdmin?: boolean;
  onRegister: () => void;
  onReviewed?: () => void;
}> = ({ account, canReport, isOwnSubmission, isAdmin, onRegister, onReviewed }) => {
  const accent = CATEGORY_ACCENTS[account.category];
  const [views, setViews] = useState(account.views ?? 0);
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const [reportError, setReportError] = useState('');
  const [needsRegistration, setNeedsRegistration] = useState(!canReport);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setNeedsRegistration(!canReport);
  }, [canReport]);

  useEffect(() => {
    let active = true;
    recordAccountView(account.id, account.views ?? 0).then((v) => {
      if (active) setViews(v);
    });
    return () => { active = false; };
  }, [account.id]);

  const submitReport = async () => {
    if (!canReport || isOwnSubmission) return;
    setReporting(true);
    setReportError('');
    setReportMsg('');
    setNeedsRegistration(false);
    try {
      await reportAccountNotWorking(account.id);
      setReportMsg('Reported — pending admin review');
      setShowConfirm(false);
    } catch (e) {
      if (isRegistrationRequiredError(e)) {
        setNeedsRegistration(true);
        setShowConfirm(false);
      } else {
        setReportError(e instanceof Error ? e.message : 'Report failed');
      }
    } finally {
      setReporting(false);
    }
  };

  const isPending = account.status === 'unchecked';

  return (
    <div
      id={`premium-account-${account.id}`}
      className={`rounded-xl border bg-gradient-to-br p-3.5 flex flex-col gap-3 relative ${accent} ${
        isPending ? 'ring-1 ring-amber-500/40 border-dashed' : ''
      }`}
    >
      {isAdmin && isPending && onReviewed && (
        <AdminReviewButtons accountId={account.id} onDone={onReviewed} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate">{account.service}</div>
          <div className="text-[8px] font-mono text-slate-500 mt-0.5">
            {PREMIUM_CATEGORY_LABELS[account.category]}
            {account.plan ? ` · ${PLAN_LABELS[account.plan as PremiumAccountPlan] ?? account.plan}` : ''}
            {account.vip ? ' · VIP' : ''}
          </div>
          {account.website && (
            <div className="text-[8px] font-mono text-slate-600 truncate mt-0.5">{account.website}</div>
          )}
          {account.createdByUsername && (
            <div className="flex items-center gap-1 text-[8px] font-mono text-sky-400/80 mt-1">
              <User size={9} />
              <span>by @{account.createdByUsername}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[7px] font-mono text-slate-400 border-slate-700/60 bg-black/30">
            <Eye size={9} /> {(views || account.views || 0).toLocaleString('en-US')}
          </span>
          {account.vip && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[7px] font-mono uppercase border-amber-500/35 bg-amber-500/10 text-amber-300">
              <VipIcon className="text-amber-400" size={10} />
              VIP
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded border text-[7px] font-mono ${STATUS_STYLES[account.status]}`}>
            {STATUS_LABELS[account.status]}
          </span>
        </div>
      </div>

      <CopyField label="Email / username" value={account.email} />
      <VaultPasswordReveal accountId={account.id} hasPassword={account.hasPassword ?? true} />

      {account.expiresAt && (
        <div className="text-[8px] font-mono text-slate-500">
          Expires: <span className="text-slate-400">{account.expiresAt}</span>
        </div>
      )}
      {account.notes && (
        <div className="text-[8px] font-mono text-slate-500 leading-relaxed">{account.notes}</div>
      )}

      {isPending && (
        <p className="text-[8px] font-mono text-amber-300/80 border border-amber-500/25 bg-amber-500/5 rounded-lg px-2 py-1">
          ⏳ Awaiting admin review — visible to admins only
        </p>
      )}

      {account.createdByUserId && !isPending && (
        <div className="pt-1 border-t border-slate-800/50">
          {isOwnSubmission ? (
            <p className="text-[8px] font-mono text-slate-600">Your own entry — cannot report</p>
          ) : needsRegistration ? (
            <ReportRegistrationPrompt onRegister={onRegister} />
          ) : showConfirm ? (
            <ReportConfirmPanel
              service={account.service}
              reporting={reporting}
              onCancel={() => setShowConfirm(false)}
              onConfirm={submitReport}
            />
          ) : (
            <>
              <button
                type="button"
                disabled={reporting || Boolean(reportMsg)}
                onClick={() => {
                  setReportError('');
                  setShowConfirm(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[9px] font-mono text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition"
              >
                <AlertTriangle size={11} />
                {reportMsg ? 'Reported' : 'Report not working'}
              </button>
              {reportMsg && <p className="mt-1 text-[8px] font-mono text-emerald-400/90">{reportMsg}</p>}
              {reportError && <p className="mt-1 text-[8px] font-mono text-rose-400">{reportError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
};

function ExampleInput({
  label,
  example,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  example: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const [focused, setFocused] = useState(false);
  const showExample = !focused && !value;

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[8px] font-mono text-slate-500 uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={showExample ? example : ''}
        className={`bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono focus:border-amber-500/50 focus:outline-none ${
          showExample ? 'text-slate-500 placeholder:text-slate-600' : 'text-slate-200'
        }`}
      />
    </label>
  );
}

function QuickAddConfirmModal({
  siteName,
  siteUrl,
  email,
  plan,
  onCancel,
  onConfirm,
  saving,
}: {
  siteName: string;
  siteUrl: string;
  email: string;
  plan: PremiumAccountPlan;
  onCancel: () => void;
  onConfirm: (checks: { credentialsOk: boolean; typeOk: boolean }) => void;
  saving: boolean;
}) {
  const [credentialsOk, setCredentialsOk] = useState(false);
  const [typeOk, setTypeOk] = useState(false);
  const canSubmit = credentialsOk && typeOk;

  return (
    <div className="sm:col-span-2 rounded-xl border border-amber-500/35 bg-black/50 p-3 space-y-3">
      <p className="text-[10px] font-mono text-amber-200 font-semibold">Please confirm before submitting</p>
      <div className="text-[9px] font-mono text-slate-400 space-y-1 leading-relaxed">
        <p>
          <span className="text-slate-500">Site:</span> {siteName} · <span className="text-slate-500">URL:</span> {siteUrl}
        </p>
        <p>
          <span className="text-slate-500">Login:</span> {email} · <span className="text-slate-500">Type:</span>{' '}
          <span className={plan === 'Premium' ? 'text-amber-300' : plan === 'WorkingButFree' ? 'text-lime-300' : 'text-slate-300'}>
            {PLAN_LABELS[plan]}
          </span>
        </p>
      </div>
      <p className="text-[8px] font-mono text-slate-500 leading-relaxed border-l-2 border-sky-500/30 pl-2">
        Accounts are reviewed shortly after submission. For Premium, membership must remain active at least 1 day after
        submission (e.g. submitted 04/01/2026 → valid until at least 04/02/2026). Free accounts without
        premium please mark as <span className="text-slate-300">FREE</span> or <span className="text-lime-300">FREE 💩</span>
        (login works, but no premium). Wrong credentials or type labels can
        lead to bans.
      </p>
      <label className="flex items-start gap-2 text-[9px] font-mono text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={credentialsOk}
          onChange={(e) => setCredentialsOk(e.target.checked)}
          className="accent-emerald-500 mt-0.5"
        />
        <span>I confirm the login credentials (email/username & password) work.</span>
      </label>
      <label className="flex items-start gap-2 text-[9px] font-mono text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={typeOk}
          onChange={(e) => setTypeOk(e.target.checked)}
          className="accent-emerald-500 mt-0.5"
        />
        <span>
          I confirm the correct account type: <strong>{PLAN_LABELS[plan]}</strong>.
        </span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!canSubmit || saving}
          onClick={() => onConfirm({ credentialsOk, typeOk })}
          className="text-[10px] font-mono px-4 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {saving ? 'Submitting…' : 'Submit now'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-500"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function QuickAddForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState<PremiumAccountCategory>('other');
  const [planType, setPlanType] = useState<PremiumAccountPlan>('Free');
  const [vip, setVip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const reset = () => {
    setSiteName('');
    setSiteUrl('');
    setEmail('');
    setPassword('');
    setCategory('other');
    setPlanType('Free');
    setVip(false);
    setFormError('');
    setSubmitSuccess('');
    setShowConfirm(false);
  };

  const plan = planType;

  const validate = () => {
    if (!siteName.trim() || !siteUrl.trim() || !email.trim() || !password.trim()) {
      setFormError('Fill in site name, URL, email/username, and password');
      return false;
    }
    return true;
  };

  const requestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setFormError('');
    try {
      await createPremiumAccount({
        siteName: siteName.trim(),
        siteUrl: siteUrl.trim(),
        email: email.trim(),
        password: password.trim(),
        category,
        plan,
        vip,
      });
      setSubmitSuccess('Submitted — awaiting admin review (only admins see the entry).');
      reset();
      setOpen(true);
      onAdded();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[10px] font-mono text-amber-200 hover:text-amber-100"
      >
        <span>➕ Add account</span>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {submitSuccess && (
        <p className="mt-2 text-[9px] font-mono text-emerald-400/90 border border-emerald-500/25 bg-emerald-500/5 rounded-lg px-2 py-1.5">
          {submitSuccess}
        </p>
      )}

      {open && (
        <form onSubmit={requestSubmit} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <ExampleInput label="Site name" example="Netflix" value={siteName} onChange={setSiteName} />
          </div>
          <div className="sm:col-span-2">
            <ExampleInput label="Site URL" example="https://netflix.com" value={siteUrl} onChange={setSiteUrl} />
          </div>
          <ExampleInput label="Email / Username" example="example@gmail.com" value={email} onChange={setEmail} />
          <ExampleInput label="Password" example="Password123" value={password} onChange={setPassword} />

          <div className="sm:col-span-2 flex flex-wrap gap-1">
            {(Object.keys(PREMIUM_CATEGORY_LABELS) as PremiumAccountCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-2 py-1 rounded border text-[9px] font-mono ${
                  category === c ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'
                }`}
              >
                {PREMIUM_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <span className="text-[8px] font-mono text-slate-500 uppercase w-full sm:w-auto">Account type</span>
            {(['Free', 'Premium', 'WorkingButFree'] as const).map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="planType"
                  checked={planType === p}
                  onChange={() => setPlanType(p)}
                  className="accent-amber-500"
                />
                {PLAN_LABELS[p]}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-[10px] font-mono text-amber-300/80 cursor-pointer sm:ml-auto">
              <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="accent-amber-500" />
              <VipIcon className="text-amber-400" size={12} />
              VIP
            </label>
          </div>

          {showConfirm ? (
            <QuickAddConfirmModal
              siteName={siteName.trim()}
              siteUrl={siteUrl.trim()}
              email={email.trim()}
              plan={plan}
              saving={saving}
              onCancel={() => setShowConfirm(false)}
              onConfirm={confirmSubmit}
            />
          ) : (
            <>
              {formError && (
                <p className="sm:col-span-2 text-[9px] font-mono text-rose-400">{formError}</p>
              )}
              <div className="sm:col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="text-[10px] font-mono px-4 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  Continue to confirmation
                </button>
                <button
                  type="button"
                  onClick={() => { reset(); setOpen(false); }}
                  className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}

function formatWhen(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
}

function VerifiedSubmitHint() {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 flex items-start gap-2">
      <BadgeCheck className="text-sky-400 shrink-0 mt-0.5" size={14} />
      <div>
        <p className="text-[10px] font-mono text-sky-200">Submit accounts only for verified users</p>
        <p className="text-[9px] font-mono text-slate-500 mt-1 leading-relaxed">
          VIP can view the vault — to add accounts an admin must mark you as "Verified".
        </p>
      </div>
    </div>
  );
}

const VALID_CATEGORIES = new Set<string>(['streaming', 'vpn', 'software', 'gaming', 'porn', 'other']);

function PremiumAccountsContent({
  initialCategory,
  highlightAccountId,
}: {
  initialCategory?: string | null;
  highlightAccountId?: string | null;
}) {
  const { user, isLoggedIn, permissions, syncAchievements, openAuth } = useAuth();
  const [stats, setStats] = useState<PremiumAccountStats | null>(null);
  const [accounts, setAccounts] = useState<PremiumAccount[]>([]);
  const [category, setCategory] = useState<PremiumAccountCategory | 'all'>(() => {
    if (initialCategory && VALID_CATEGORIES.has(initialCategory)) {
      return initialCategory as PremiumAccountCategory;
    }
    return 'all';
  });
  const [statusFilter, setStatusFilter] = useState<PremiumAccountStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const [s, data] = await Promise.all([
        fetchPremiumAccountStats(),
        fetchPremiumAccounts({ category, status: statusFilter, search }),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setStats(s);
      setAccounts(data.accounts);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [category, statusFilter, search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(refresh, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [refresh, search]);

  useVisibilityAwarePoll(() => {
    if (!isLoggedIn) return;
    const gen = loadGenRef.current;
    fetchPremiumAccountStats()
      .then((s) => { if (gen === loadGenRef.current && mountedRef.current) setStats(s); })
      .catch(() => {});
  }, 15_000, isLoggedIn);

  useEffect(() => {
    if (!highlightAccountId || loading) return;
    const el = document.getElementById(`premium-account-${highlightAccountId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightAccountId, loading, accounts.length]);

  const copyWorking = async () => {
    const working = accounts.filter((a) => a.status === 'working' || a.status === 'working_free');
    if (!working.length) return;
    const text = await exportVaultAccountsText({ workingOnly: true, category, status: statusFilter, search });
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = async () => {
    const text = await exportVaultAccountsText({
      workingOnly: statusFilter !== 'offline' && statusFilter !== 'expired',
      category,
      status: statusFilter,
      search,
    });
    const blob = new Blob([text], {
      type: 'text/plain',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'premium-accounts.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportableWorking = accounts.filter((a) => a.status === 'working' || a.status === 'working_free');

  return (
    <PageShell
      id="premium-accounts-module"
      pageId="premiumaccounts"
      icon="👑"
      title="Free Premium Accounts"
      subtitle="VIP-only Vault · Quick-Add · Copy & Export"
      accentClass="text-amber-400"
    >
      <div className="flex flex-col gap-4 min-h-0">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-mono text-rose-200">
            {error}
          </div>
        )}

        {permissions.premiumSubmit ? (
          <QuickAddForm onAdded={async () => { await refresh(); await syncAchievements(); }} />
        ) : (
          <VerifiedSubmitHint />
        )}

        <div className={`grid grid-cols-2 ${permissions.admin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2`}>
          <StatCard label="Collected" value={stats?.total ?? 0} sub="published" accent="border-amber-500/30 bg-amber-500/10 text-amber-300" />
          <StatCard label="Working" value={stats?.working ?? 0} sub="working" accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" />
          <StatCard label="Offline" value={stats?.offline ?? 0} sub="expired / dead" accent="border-rose-500/25 bg-rose-500/5 text-rose-300" />
          {permissions.admin && (
            <StatCard
              label="Pending"
              value={stats?.pending ?? 0}
              sub="Admin-Review"
              accent="border-sky-500/30 bg-sky-500/10 text-sky-300"
            />
          )}
          <StatCard
            label="Kategorien"
            value={stats?.activeCategories ?? 0}
            sub={stats?.updatedAt ? `Update ${formatWhen(Date.parse(stats.updatedAt))}` : 'no data'}
            accent="border-violet-500/25 bg-violet-500/5 text-violet-300"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service or email…"
            className="flex-1 min-w-[160px] bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-200 focus:border-amber-500/50 focus:outline-none"
          />
          <button
            type="button"
            disabled={exportableWorking.length === 0}
            onClick={copyWorking}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40"
          >
            {copied ? '✓ Copied' : '📋 Copy Working'}
          </button>
          <button
            type="button"
            disabled={accounts.length === 0}
            onClick={downloadTxt}
            className="text-[10px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40"
          >
            ⬇ TXT
          </button>
        </div>

        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-2 py-1 rounded border text-[9px] font-mono ${
                category === c ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'
              }`}
            >
              {c === 'all' ? 'all' : PREMIUM_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap items-center">
          {(['all', 'working', 'working_free', 'offline', 'expired', ...(permissions.admin ? ['unchecked'] as const : [])] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded border text-[9px] font-mono ${
                statusFilter === s ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'
              }`}
            >
              {s === 'all' ? 'all' : STATUS_LABELS[s as PremiumAccountStatus] ?? s}
            </button>
          ))}
          <span className="text-[9px] font-mono text-slate-600 ml-auto">
            {loading ? 'Loading…' : `${accounts.length} accounts`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-h-[160px]">
          {!loading && accounts.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-800/80 bg-[#0b0c10]/60 p-10 text-center">
              <p className="text-[11px] font-mono text-slate-500">
                No premium accounts in the database.
              </p>
              <p className="text-[9px] font-mono text-slate-600 mt-2">
                Use "Add account" above — stored in data/premium-accounts/accounts.json
              </p>
            </div>
          )}
          {accounts.map((account) => (
            <PremiumAccountCard
              key={account.id}
              account={account}
              canReport={isLoggedIn}
              isAdmin={permissions.admin}
              isOwnSubmission={Boolean(user && account.createdByUserId === user.id)}
              onRegister={() => openAuth('register')}
              onReviewed={refresh}
            />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

export function FreePremiumAccountsPage({
  initialCategory,
  highlightAccountId,
}: {
  initialCategory?: string | null;
  highlightAccountId?: string | null;
} = {}) {
  return (
    <VipGate
      title="Premium Vault"
      description="Free Premium Accounts are only visible to logged-in VIP and admin users."
    >
      <PremiumAccountsContent
        initialCategory={initialCategory}
        highlightAccountId={highlightAccountId}
      />
    </VipGate>
  );
}