/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { Check, X } from 'lucide-react';
import {
  acceptAccountReport,
  approvePremiumAccount,
  fetchPendingAccountReports,
  fetchPendingPremiumAccounts,
  rejectAccountReport,
  rejectPremiumAccount,
  type AccountReport,
  type PremiumAccount,
} from '../../lib/premiumAccounts';
import { PLAN_LABELS, PREMIUM_CATEGORY_LABELS, type PremiumAccountPlan } from '../../data/premiumAccounts';
import { ToolCard } from '../pages/PageShell';



function PendingAccountsPanel() {
  const [accounts, setAccounts] = useState<PremiumAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const data = await fetchPendingPremiumAccounts();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setAccounts(data);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load pending accounts');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useVisibilityAwarePoll(load, 20_000);

  const act = async (id: string, action: 'approve' | 'approve_free' | 'reject') => {
    if (action === 'reject' && !confirm('Reject and delete account?')) return;
    setActing(id);
    setError('');
    try {
      if (action === 'approve') await approvePremiumAccount(id, 'working');
      else if (action === 'approve_free') await approvePremiumAccount(id, 'working_free');
      else await rejectPremiumAccount(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  return (
    <ToolCard title="Account submissions (pending)" icon="📥" accent="amber">
      {error && <p className="text-[10px] font-mono text-rose-400 mb-2">{error}</p>}
      <p className="text-[9px] font-mono text-slate-500 mb-3 leading-relaxed">
        New submissions start as <span className="text-amber-300">unchecked</span> and are visible to admins only.
        ✅ Premium/working · 💩 FREE · ❌ reject & delete.
      </p>
      <div className="text-[9px] font-mono text-slate-600 mb-2">
        {loading ? 'Loading…' : `${accounts.length} open`}
      </div>
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {accounts.map((a) => (
          <div key={a.id} className="rounded-xl border border-dashed border-amber-500/30 bg-amber-950/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-200">{a.service}</div>
                <div className="text-[8px] font-mono text-slate-500 mt-0.5">
                  {PREMIUM_CATEGORY_LABELS[a.category]}
                  {a.plan ? ` · ${PLAN_LABELS[a.plan as PremiumAccountPlan] ?? a.plan}` : ''}
                  {a.website ? ` · ${a.website}` : ''}
                </div>
                <div className="text-[8px] font-mono text-slate-600 mt-1 truncate">{a.email}</div>
                {a.createdByUsername && (
                  <div className="text-[8px] font-mono text-sky-400/80 mt-1">by @{a.createdByUsername}</div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={acting === a.id}
                  onClick={() => act(a.id, 'approve')}
                  title="Premium / working"
                  className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-lg leading-none hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  ✅
                </button>
                <button
                  type="button"
                  disabled={acting === a.id}
                  onClick={() => act(a.id, 'approve_free')}
                  title="FREE 💩"
                  className="px-2.5 py-1.5 rounded-lg border border-lime-600/40 bg-lime-950/30 text-lg leading-none hover:bg-lime-900/40 disabled:opacity-40"
                >
                  💩
                </button>
                <button
                  type="button"
                  disabled={acting === a.id}
                  onClick={() => act(a.id, 'reject')}
                  title="Reject"
                  className="px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 text-lg leading-none hover:bg-rose-500/25 disabled:opacity-40"
                >
                  ❌
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && accounts.length === 0 && (
          <p className="text-center py-6 text-[10px] font-mono text-slate-600">No open submissions</p>
        )}
      </div>
    </ToolCard>
  );
}

function AccountReportsPanel() {
  const [reports, setReports] = useState<AccountReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const data = await fetchPendingAccountReports();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setReports(data);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useVisibilityAwarePoll(load, 20_000);

  const act = async (id: string, action: 'accept' | 'reject') => {
    setActing(id);
    setError('');
    try {
      if (action === 'accept') await acceptAccountReport(id);
      else await rejectAccountReport(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  return (
    <ToolCard title="Not-working reports" icon="⚠️" accent="rose">
      {error && <p className="text-[10px] font-mono text-rose-400 mb-2">{error}</p>}
      <p className="text-[9px] font-mono text-slate-500 mb-3 leading-relaxed">
        Registered users report accounts as broken. On confirmation: status → offline, entry appears on submitter profile under "Reported Not Working Accounts".
      </p>
      <div className="text-[9px] font-mono text-slate-600 mb-2">
        {loading ? 'Loading…' : `${reports.length} open`}
      </div>
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-200">
                  {r.account?.service ?? '— Account deleted?'}
                </div>
                <div className="text-[8px] font-mono text-slate-500 mt-0.5">
                  {r.account ? PREMIUM_CATEGORY_LABELS[r.account.category] : '—'}
                  {r.account?.createdByUsername ? ` · submitted by @${r.account.createdByUsername}` : ''}
                </div>
                <div className="text-[8px] font-mono text-sky-400/80 mt-1">
                  Reported by @{r.reportedByUsername} · {new Date(r.createdAt).toLocaleString('en-US')}
                </div>
                {r.account?.email && (
                  <div className="text-[8px] font-mono text-slate-600 mt-1 truncate">{r.account.email}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  disabled={acting === r.id}
                  onClick={() => act(r.id, 'accept')}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-[9px] font-mono text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  <Check size={11} /> Confirm
                </button>
                <button
                  type="button"
                  disabled={acting === r.id}
                  onClick={() => act(r.id, 'reject')}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-700 bg-black/30 text-[9px] font-mono text-slate-400 hover:text-rose-300 disabled:opacity-40"
                >
                  <X size={11} /> Ablehnen
                </button>
              </div>
            </div>
            {r.note && (
              <p className="text-[9px] font-mono text-slate-500 border-t border-slate-800/50 pt-2 mt-1">{r.note}</p>
            )}
          </div>
        ))}
        {!loading && reports.length === 0 && (
          <p className="text-center py-6 text-[10px] font-mono text-slate-600">No open reports</p>
        )}
      </div>
    </ToolCard>
  );
}

export function AdminModerationPanel() {
  return (
    <>
      <PendingAccountsPanel />
      <AccountReportsPanel />
    </>
  );
}