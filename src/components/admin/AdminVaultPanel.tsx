/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeHref } from '../../lib/safeHref';
import {
  CheckCircle2,
  Copy,
  Crown,
  Eye,
  FileUp,
  Globe,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  bulkImportVaultAccounts,
  createAdminVaultAccount,
  deleteVaultAccount,
  fetchPremiumAccounts,
  fetchPremiumAccountStats,
  updateVaultAccount,
  type PremiumAccount,
  type PremiumAccountStats,
} from '../../lib/premiumAccounts';
import {
  PLAN_LABELS,
  PREMIUM_CATEGORY_LABELS,
  STATUS_LABELS,
  type PremiumAccountCategory,
  type PremiumAccountPlan,
  type PremiumAccountStatus,
} from '../../data/premiumAccounts';
import {
  parseVaultBulkText,
  VAULT_BULK_TEMPLATE,
  type VaultBulkEntry,
} from '../../lib/premiumAccountsBulkParse';
import { ActionButton, ToolCard } from '../pages/PageShell';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';

const STATUS_COLORS: Record<string, string> = {
  working: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  working_free: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  offline: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  expired: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  unchecked: 'text-slate-400 border-slate-600/40 bg-slate-800/30',
};

type VaultForm = {
  id?: string;
  service: string;
  website: string;
  email: string;
  password: string;
  category: PremiumAccountCategory;
  status: PremiumAccountStatus;
  plan: PremiumAccountPlan;
  vip: boolean;
  notes: string;
  expiresAt: string;
};

const emptyForm = (): VaultForm => ({
  service: '',
  website: '',
  email: '',
  password: '',
  category: 'other',
  status: 'working',
  plan: 'Premium',
  vip: false,
  notes: '',
  expiresAt: '',
});

type PanelMode = 'inventory' | 'bulk';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  span,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  span?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={span ? 'col-span-2' : ''}>
      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-black/50 border border-slate-800/90 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40"
      />
    </label>
  );
}

function VaultEditorModal({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  title,
}: {
  form: VaultForm;
  onChange: (f: VaultForm) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12131a] to-[#0a0b10] p-5 max-h-[92vh] overflow-y-auto shadow-2xl shadow-amber-500/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-amber-200 flex items-center gap-2">
            <Crown size={15} className="text-amber-400" /> {title}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name (Website)" value={form.service} onChange={(v) => onChange({ ...form, service: v })} span />
          <Field label="Url" value={form.website} onChange={(v) => onChange({ ...form, website: v })} span placeholder="https://…" />
          <Field label="Username" value={form.email} onChange={(v) => onChange({ ...form, email: v })} />
          <Field
            label={form.id ? 'Password (empty = keep)' : 'Password'}
            value={form.password}
            onChange={(v) => onChange({ ...form, password: v })}
            type="text"
          />
          <label>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Category</span>
            <select
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value as PremiumAccountCategory })}
              className="mt-1 w-full bg-black/50 border border-slate-800/90 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200"
            >
              {(Object.keys(PREMIUM_CATEGORY_LABELS) as PremiumAccountCategory[]).map((c) => (
                <option key={c} value={c}>{PREMIUM_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Status</span>
            <select
              value={form.status}
              onChange={(e) => onChange({ ...form, status: e.target.value as PremiumAccountStatus })}
              className="mt-1 w-full bg-black/50 border border-slate-800/90 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200"
            >
              {(Object.keys(STATUS_LABELS) as PremiumAccountStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Plan</span>
            <select
              value={form.plan}
              onChange={(e) => onChange({ ...form, plan: e.target.value as PremiumAccountPlan })}
              className="mt-1 w-full bg-black/50 border border-slate-800/90 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200"
            >
              {(Object.keys(PLAN_LABELS) as PremiumAccountPlan[]).map((p) => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={form.vip}
              onChange={(e) => onChange({ ...form, vip: e.target.checked })}
              className="accent-amber-500"
            />
            <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
              <Crown size={11} /> VIP badge
            </span>
          </label>
          <Field label="Expires (optional)" value={form.expiresAt} onChange={(v) => onChange({ ...form, expiresAt: v })} span />
          <label className="col-span-2">
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              rows={2}
              className="mt-1 w-full bg-black/50 border border-slate-800/90 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200"
            />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <ActionButton onClick={onSave} variant="amber" disabled={saving}>
            {saving ? 'Saving…' : 'Save account'}
          </ActionButton>
          <ActionButton onClick={onClose} variant="cyan">Cancel</ActionButton>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ account, onClose, onEdit }: { account: PremiumAccount; onClose: () => void; onEdit: () => void }) {
  const [password, setPassword] = useState(account.password ?? '');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (account.password) {
      setPassword(account.password);
      return;
    }
    let active = true;
    setPwLoading(true);
    import('../../lib/premiumAccounts').then(({ revealVaultPassword }) => revealVaultPassword(account.id))
      .then((pw) => { if (active) setPassword(pw); })
      .catch(() => { if (active) setPassword(''); })
      .finally(() => { if (active) setPwLoading(false); });
    return () => { active = false; };
  }, [account.id, account.password]);

  const copyAll = async () => {
    let pw = password;
    if (!pw && !pwLoading) {
      try {
        const { revealVaultPassword } = await import('../../lib/premiumAccounts');
        pw = await revealVaultPassword(account.id);
        setPassword(pw);
      } catch { /* ignore */ }
    }
    const text = [
      `Name: ${account.service}`,
      `Username: ${account.email}`,
      `Password: ${pw || '—'}`,
      `Url: ${account.website ?? ''}`,
    ].join('\n');
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-gradient-to-b from-[#14151c] to-[#0a0b10] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              {account.vip && <Crown size={14} className="text-amber-400" />}
              <h3 className="text-base font-semibold text-slate-100">{account.service}</h3>
            </div>
            {account.website && safeHref(account.website.startsWith('http') ? account.website : `https://${account.website}`) && (
              <a
                href={safeHref(account.website.startsWith('http') ? account.website : `https://${account.website}`)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1 mt-1"
              >
                <Globe size={10} /> {account.website}
              </a>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
        </div>

        <div className="space-y-2.5 rounded-xl border border-slate-800/80 bg-black/30 p-3">
          {[
            ['Username', account.email],
            ['Password', pwLoading ? 'Loading…' : (password || '—')],
            ['Category', PREMIUM_CATEGORY_LABELS[account.category]],
            ['Status', STATUS_LABELS[account.status]],
            ['Plan', account.plan ? PLAN_LABELS[account.plan] : '—'],
            ['Views', String(account.views ?? 0)],
            ['Submitted by', account.createdByUsername ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-[10px] font-mono">
              <span className="text-slate-500 shrink-0">{k}</span>
              <span className="text-slate-200 text-right break-all">{v}</span>
            </div>
          ))}
          {account.notes && (
            <div className="pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">{account.notes}</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton onClick={copyAll} variant="amber">Copy block</ActionButton>
          <ActionButton onClick={onEdit} variant="indigo">Edit</ActionButton>
          <ActionButton onClick={onClose} variant="cyan">Close</ActionButton>
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  account,
  onView,
  onEdit,
  onDelete,
}: {
  account: PremiumAccount;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusClass = STATUS_COLORS[account.status] ?? STATUS_COLORS.unchecked;

  return (
    <div className="group rounded-xl border border-slate-800/70 bg-gradient-to-br from-black/40 to-amber-500/[0.03] p-3 hover:border-amber-500/25 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {account.vip && <Crown size={12} className="text-amber-400 shrink-0" />}
            <span className="text-[11px] font-semibold text-slate-100 truncate">{account.service}</span>
          </div>
          <div className="text-[9px] font-mono text-slate-500 truncate mt-0.5">{account.email}</div>
        </div>
        <span className={`shrink-0 text-[7px] font-mono uppercase px-1.5 py-0.5 rounded border ${statusClass}`}>
          {STATUS_LABELS[account.status]}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[8px] font-mono text-slate-600">
        <span>{PREMIUM_CATEGORY_LABELS[account.category]}</span>
        <span className="text-cyan-400/70">{account.views ?? 0} views</span>
      </div>
      <div className="mt-2.5 flex gap-1 opacity-80 group-hover:opacity-100">
        <button type="button" onClick={onView} className="flex-1 py-1.5 rounded-lg border border-slate-700/80 text-[8px] font-mono text-violet-300 hover:bg-violet-500/10">
          <Eye size={10} className="inline mr-1" />Details
        </button>
        <button type="button" onClick={onEdit} className="px-2 py-1.5 rounded-lg border border-slate-700/80 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10">
          <Pencil size={10} />
        </button>
        <button type="button" onClick={onDelete} className="px-2 py-1.5 rounded-lg border border-slate-700/80 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

export function AdminVaultPanel() {
  const [mode, setMode] = useState<PanelMode>('inventory');
  const [stats, setStats] = useState<PremiumAccountStats | null>(null);
  const [accounts, setAccounts] = useState<PremiumAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PremiumAccountCategory | 'all'>('all');
  const [status, setStatus] = useState<PremiumAccountStatus | 'all'>('all');
  const [editor, setEditor] = useState<VaultForm | null>(null);
  const [detail, setDetail] = useState<PremiumAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PremiumAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [bulkText, setBulkText] = useState('');
  const [bulkCategory, setBulkCategory] = useState<PremiumAccountCategory>('other');
  const [bulkStatus, setBulkStatus] = useState<PremiumAccountStatus>('working');
  const [bulkPlan, setBulkPlan] = useState<PremiumAccountPlan>('Premium');
  const [bulkVip, setBulkVip] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<string>('');

  const bulkPreview = useMemo(() => parseVaultBulkText(bulkText), [bulkText]);
  const bulkValid = bulkPreview.filter((e) => e.valid).length;
  const bulkInvalid = bulkPreview.filter((e) => !e.valid).length;
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
      const [s, data] = await Promise.all([
        fetchPremiumAccountStats(),
        fetchPremiumAccounts({ search, category, status }),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setStats(s);
      setAccounts(data.accounts);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, category, status]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useVisibilityAwarePoll(load, 25_000);

  const openCreate = () => setEditor(emptyForm());

  const openEdit = (a: PremiumAccount) => {
    setDetail(null);
    setEditor({
      id: a.id,
      service: a.service,
      website: a.website ?? '',
      email: a.email,
      password: '',
      category: a.category,
      status: a.status,
      plan: a.plan ?? 'Premium',
      vip: Boolean(a.vip),
      notes: a.notes ?? '',
      expiresAt: a.expiresAt ?? '',
    });
  };

  const saveAccount = async () => {
    if (!editor) return;
    if (!editor.service.trim() || !editor.email.trim() || (!editor.id && !editor.password.trim())) {
      setError('Name, username and password are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editor.id) {
        const patch: Record<string, unknown> = {
          service: editor.service.trim(),
          website: editor.website.trim(),
          email: editor.email.trim(),
          category: editor.category,
          status: editor.status,
          plan: editor.plan,
          vip: editor.vip,
          notes: editor.notes.trim(),
          expiresAt: editor.expiresAt.trim(),
        };
        if (editor.password.trim()) patch.password = editor.password.trim();
        await updateVaultAccount(editor.id, patch);
      } else {
        await createAdminVaultAccount({
          service: editor.service.trim(),
          website: editor.website.trim() || undefined,
          email: editor.email.trim(),
          password: editor.password.trim(),
          category: editor.category,
          status: editor.status,
          plan: editor.plan,
          vip: editor.vip,
          notes: editor.notes.trim() || undefined,
          expiresAt: editor.expiresAt.trim() || undefined,
        });
      }
      setEditor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError('');
    try {
      await deleteVaultAccount(deleteTarget.id);
      setDeleteTarget(null);
      if (detail?.id === deleteTarget.id) setDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const runBulkImport = async () => {
    if (!bulkValid) {
      setError('No valid entries to import');
      return;
    }
    setBulkImporting(true);
    setError('');
    setBulkResult('');
    try {
      const result = await bulkImportVaultAccounts({
        text: bulkText,
        category: bulkCategory,
        status: bulkStatus,
        plan: bulkPlan,
        vip: bulkVip,
      });
      setBulkResult(
        `Imported ${result.imported} of ${result.total} entries`
        + (result.failed ? ` · ${result.failed} skipped (invalid)` : ''),
      );
      setBulkText('');
      setMode('inventory');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk import failed');
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[9px] font-mono text-slate-500 max-w-xl">
          Account Vault Manager — add, edit, delete, inspect credentials & bulk-import formatted lists.
        </p>
        <div className="flex rounded-xl border border-slate-800/80 bg-black/30 p-0.5">
          {(['inventory', 'bulk'] as PanelMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wide transition-colors ${
                mode === m
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'inventory' ? 'Inventory' : 'Bulk import'}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: 'Total', value: stats.total, accent: 'text-slate-200' },
            { label: 'Working', value: stats.working, accent: 'text-emerald-400' },
            { label: 'Offline', value: stats.offline, accent: 'text-rose-400' },
            { label: 'Pending', value: stats.pending ?? 0, accent: 'text-amber-300' },
            { label: 'Categories', value: stats.activeCategories, accent: 'text-violet-300' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-800/70 bg-black/25 px-3 py-2.5 text-center">
              <div className="text-[7px] font-mono uppercase text-slate-600">{s.label}</div>
              <div className={`text-sm font-mono font-bold ${s.accent}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[9px] font-mono text-rose-300">
          {error}
        </div>
      )}

      {mode === 'inventory' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or username…"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/30"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PremiumAccountCategory | 'all')}
              className="px-3 py-2.5 rounded-xl border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300"
            >
              <option value="all">All categories</option>
              {(Object.keys(PREMIUM_CATEGORY_LABELS) as PremiumAccountCategory[]).map((c) => (
                <option key={c} value={c}>{PREMIUM_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PremiumAccountStatus | 'all')}
              className="px-3 py-2.5 rounded-xl border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300"
            >
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_LABELS) as PremiumAccountStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button type="button" onClick={() => void load()} className="px-3 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-amber-300">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <ActionButton onClick={openCreate} variant="amber">
              <Plus size={12} className="inline mr-1" />Add
            </ActionButton>
            <ActionButton onClick={() => setMode('bulk')} variant="indigo">
              <Upload size={12} className="inline mr-1" />Bulk
            </ActionButton>
          </div>

          <ToolCard title={`Accounts (${accounts.length})`} icon="👑" accent="amber">
            {loading && !accounts.length ? (
              <div className="py-10 text-center text-[10px] font-mono text-slate-600">Loading vault…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {accounts.map((a) => (
                  <div key={a.id}>
                    <AccountCard
                      account={a}
                      onView={() => setDetail(a)}
                      onEdit={() => openEdit(a)}
                      onDelete={() => setDeleteTarget(a)}
                    />
                  </div>
                ))}
                {!accounts.length && !loading && (
                  <div className="col-span-full py-10 text-center text-[10px] font-mono text-slate-600">
                    No accounts — add one or use bulk import.
                  </div>
                )}
              </div>
            )}
          </ToolCard>
        </>
      ) : (
        <ToolCard title="Bulk import" icon="📥" accent="indigo">
          <div className="space-y-4">
            <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
              Paste a long list — each block needs <span className="text-amber-300/90">Name</span>,{' '}
              <span className="text-amber-300/90">Username</span>, <span className="text-amber-300/90">Password</span> and{' '}
              <span className="text-amber-300/90">Url</span> (one per line). Blocks can be separated by blank lines.
            </p>

            <div className="flex flex-wrap gap-2">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as PremiumAccountCategory)}
                className="px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300"
              >
                {(Object.keys(PREMIUM_CATEGORY_LABELS) as PremiumAccountCategory[]).map((c) => (
                  <option key={c} value={c}>{PREMIUM_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as PremiumAccountStatus)}
                className="px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300"
              >
                {(Object.keys(STATUS_LABELS) as PremiumAccountStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={bulkPlan}
                onChange={(e) => setBulkPlan(e.target.value as PremiumAccountPlan)}
                className="px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300"
              >
                {(Object.keys(PLAN_LABELS) as PremiumAccountPlan[]).map((p) => (
                  <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 px-2 text-[10px] font-mono text-amber-300">
                <input type="checkbox" checked={bulkVip} onChange={(e) => setBulkVip(e.target.checked)} className="accent-amber-500" />
                VIP all
              </label>
              <button
                type="button"
                onClick={() => setBulkText(VAULT_BULK_TEMPLATE)}
                className="text-[9px] font-mono text-slate-500 hover:text-cyan-300"
              >
                Load template
              </button>
            </div>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={12}
              placeholder={VAULT_BULK_TEMPLATE}
              className="w-full rounded-xl border border-slate-800/90 bg-black/50 px-3 py-3 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/35"
            />

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-3 text-[9px] font-mono">
                <span className="text-emerald-400">{bulkValid} valid</span>
                {bulkInvalid > 0 && <span className="text-rose-400">{bulkInvalid} invalid</span>}
                <span className="text-slate-600">{bulkPreview.length} total blocks</span>
              </div>
              <ActionButton
                onClick={() => void runBulkImport()}
                variant="emerald"
                disabled={bulkImporting || bulkValid === 0}
              >
                <FileUp size={12} className="inline mr-1" />
                {bulkImporting ? 'Importing…' : `Import ${bulkValid} accounts`}
              </ActionButton>
              <ActionButton onClick={() => setMode('inventory')} variant="cyan">Back</ActionButton>
            </div>

            {bulkResult && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-300">
                <CheckCircle2 size={14} /> {bulkResult}
              </div>
            )}

            {bulkPreview.length > 0 && (
              <div className="rounded-xl border border-slate-800/70 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-[9px] font-mono">
                  <thead className="sticky top-0 bg-[#0c0d12]">
                    <tr className="text-slate-600 border-b border-slate-800">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Name</th>
                      <th className="text-left py-2 px-2">Username</th>
                      <th className="text-left py-2 px-2">Url</th>
                      <th className="text-right py-2 px-2">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.slice(0, 50).map((row: VaultBulkEntry) => (
                      <tr key={row.index} className="border-b border-slate-800/40">
                        <td className="py-1.5 px-2 text-slate-600">{row.index}</td>
                        <td className="py-1.5 px-2 text-slate-300 truncate max-w-[120px]">{row.name || '—'}</td>
                        <td className="py-1.5 px-2 text-slate-400 truncate max-w-[120px]">{row.username || '—'}</td>
                        <td className="py-1.5 px-2 text-slate-500 truncate max-w-[100px]">{row.url || '—'}</td>
                        <td className={`py-1.5 px-2 text-right ${row.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {row.valid ? '✓' : row.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bulkPreview.length > 50 && (
                  <div className="py-2 text-center text-[8px] font-mono text-slate-600">
                    +{bulkPreview.length - 50} more rows in preview
                  </div>
                )}
              </div>
            )}
          </div>
        </ToolCard>
      )}

      {editor && (
        <VaultEditorModal
          form={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={() => void saveAccount()}
          saving={saving}
          title={editor.id ? 'Edit account' : 'Add account'}
        />
      )}

      {detail && (
        <DetailModal
          account={detail}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="rounded-xl border border-rose-500/30 bg-[#0c0d12] p-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] text-slate-200 mb-1">Delete account?</p>
            <p className="text-[10px] font-mono text-slate-500 mb-4">
              {deleteTarget.service} · {deleteTarget.email}
            </p>
            <div className="flex gap-2">
              <ActionButton onClick={() => void confirmDelete()} variant="rose" disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </ActionButton>
              <ActionButton onClick={() => setDeleteTarget(null)} variant="cyan">Cancel</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}