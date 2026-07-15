/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import {
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  adminDeletePaste,
  adminUpdatePaste,
  buildPasteUrl,
  copyToClipboard,
  expiryLabel,
  fetchAdminPaste,
  fetchAdminPastes,
  fetchAdminPasteStats,
  formatPasteBytes,
  formatPasteDate,
  type AdminPasteMeta,
  type AdminPasteStats,
  type AdminPasteUpdateInput,
  type PasteSort,
} from '../../lib/paste';
import {
  languageLabel,
  PASTE_EXPIRY_OPTIONS,
  PASTE_LANGUAGES,
  PASTE_VISIBILITY_OPTIONS,
  type PasteExpiry,
  type PasteVisibility,
} from '../../data/pasteLanguages';
import { ActionButton, ToolCard } from '../pages/PageShell';
import { PasteVisibilityBadge } from '../paste/PasteVisibilityBadge';

const SORT_OPTIONS: { id: PasteSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'views', label: 'Most views' },
  { id: 'size', label: 'Largest' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'pinned', label: 'Pinned first' },
];

type EditForm = {
  id: string;
  title: string;
  content: string;
  language: string;
  visibility: PasteVisibility;
  password: string;
  expiry: PasteExpiry;
  burnAfterRead: boolean;
  pinned: boolean;
  hasPassword: boolean;
};

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2">
      <div className="text-[8px] font-mono uppercase text-slate-600">{label}</div>
      <div className="text-sm font-semibold text-slate-200">{value}</div>
      {sub && <div className="text-[8px] font-mono text-slate-500">{sub}</div>}
    </div>
  );
}

export function AdminPastesPanel() {
  const [pastes, setPastes] = useState<AdminPasteMeta[]>([]);
  const [stats, setStats] = useState<AdminPasteStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [visFilter, setVisFilter] = useState('all');
  const [sort, setSort] = useState<PasteSort>('newest');
  const [acting, setActing] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditForm | null>(null);
  const [viewer, setViewer] = useState<{ meta: AdminPasteMeta; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const [list, pasteStats] = await Promise.all([
        fetchAdminPastes({ q: search, visibility: visFilter, sort, limit: 200 }),
        fetchAdminPasteStats(),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setPastes(list.pastes);
      setTotal(list.total);
      setStats(pasteStats);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load pastes');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, visFilter, sort, loadGenRef, mountedRef]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const visCounts = useMemo(() => stats?.byVisibility ?? {}, [stats]);

  const openView = async (id: string) => {
    setActing(id);
    setError('');
    try {
      const record = await fetchAdminPaste(id);
      setViewer({
        meta: record,
        content: record.content ?? '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load paste');
    } finally {
      setActing(null);
    }
  };

  const openEdit = async (id: string) => {
    setActing(id);
    setError('');
    try {
      const record = await fetchAdminPaste(id);
      let expiry: PasteExpiry = 'never';
      if (record.expiresAt) {
        const diff = record.expiresAt - record.createdAt;
        const match = PASTE_EXPIRY_OPTIONS.find((o) => {
          if (o.id === 'never') return false;
          const ms: Record<string, number> = {
            '10m': 10 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000,
            '1m': 30 * 24 * 60 * 60 * 1000,
          };
          return Math.abs((ms[o.id] ?? 0) - diff) < 60000;
        });
        expiry = (match?.id ?? 'never') as PasteExpiry;
      }
      setEditor({
        id: record.id,
        title: record.title,
        content: record.content ?? '',
        language: record.language,
        visibility: record.visibility,
        password: '',
        expiry,
        burnAfterRead: record.burnAfterRead,
        pinned: Boolean(record.pinned),
        hasPassword: Boolean(record.hasPassword),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load paste');
    } finally {
      setActing(null);
    }
  };

  const saveEdit = async () => {
    if (!editor) return;
    setSaving(true);
    setError('');
    try {
      const patch: AdminPasteUpdateInput = {
        title: editor.title,
        content: editor.content,
        language: editor.language,
        visibility: editor.visibility,
        expiry: editor.expiry,
        burnAfterRead: editor.burnAfterRead,
        pinned: editor.pinned,
      };
      if (editor.visibility === 'protected' && editor.password.trim()) {
        patch.password = editor.password.trim();
      }
      await adminUpdatePaste(editor.id, patch);
      setEditor(null);
      setSuccess('Paste updated');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete paste "${title}"? This cannot be undone.`)) return;
    setActing(id);
    setError('');
    try {
      await adminDeletePaste(id);
      if (viewer?.meta.id === id) setViewer(null);
      if (editor?.id === id) setEditor(null);
      setSuccess('Paste deleted');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setActing(null);
    }
  };

  return (
    <ToolCard title="All pastes" icon="📋" accent="cyan">
      <p className="text-[9px] font-mono text-slate-500 mb-3 leading-relaxed">
        Admin view — includes public, private, and password-protected pastes. Full content access without owner login.
      </p>

      {error && <p className="text-[10px] font-mono text-rose-400 mb-2">{error}</p>}
      {success && <p className="text-[10px] font-mono text-emerald-400 mb-2">{success}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
          <StatTile label="Total" value={stats.total} />
          <StatTile label="Public" value={visCounts.public ?? 0} />
          <StatTile label="Private" value={visCounts.private ?? 0} />
          <StatTile label="Protected" value={visCounts.protected ?? 0} />
          <StatTile label="Views" value={stats.totalViews.toLocaleString('en-US')} />
          <StatTile label="Storage" value={formatPasteBytes(stats.totalBytes)} sub={`${stats.burnAfterRead} burn`} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, ID, user…"
            className="w-full pl-8 pr-3 py-2 bg-black/40 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <select
          value={visFilter}
          onChange={(e) => setVisFilter(e.target.value)}
          className="bg-black/40 border border-slate-800 rounded-lg px-2 py-2 text-[10px] font-mono text-slate-400"
        >
          <option value="all">All visibility</option>
          {PASTE_VISIBILITY_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as PasteSort)}
          className="bg-black/40 border border-slate-800 rounded-lg px-2 py-2 text-[10px] font-mono text-slate-400"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setLoading(true); void load(); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 bg-black/30 text-[10px] font-mono text-slate-400 hover:text-cyan-200"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="text-[9px] font-mono text-slate-600 mb-2">
        {loading ? 'Loading…' : `${pastes.length} shown · ${total} total`}
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {pastes.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-start gap-3 p-3 rounded-xl border border-slate-800/80 bg-black/25 hover:border-slate-700/80"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-slate-200 truncate">{p.title}</span>
                <PasteVisibilityBadge visibility={p.visibility} />
                {p.pinned && (
                  <span className="text-[8px] font-mono text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">pinned</span>
                )}
                {p.burnAfterRead && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-mono text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded">
                    <Flame size={9} /> burn
                  </span>
                )}
              </div>
              <div className="text-[8px] font-mono text-slate-500">
                <span className="text-cyan-400/90">{p.id}</span>
                {' · '}{languageLabel(p.language)}
                {' · '}{formatPasteBytes(p.size)}
                {' · '}{p.lineCount} lines
                {' · '}{p.views} views
              </div>
              <div className="text-[8px] font-mono text-slate-600 mt-0.5">
                {p.username ? `@${p.username}` : 'anonymous'}
                {p.userId ? ` · uid ${p.userId}` : ''}
                {' · '}{formatPasteDate(p.createdAt)}
                {p.expiresAt ? ` · ${expiryLabel(p.expiresAt)}` : ''}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                disabled={acting === p.id}
                onClick={() => openView(p.id)}
                title="View content"
                className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-cyan-300 disabled:opacity-40"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                disabled={acting === p.id}
                onClick={() => openEdit(p.id)}
                title="Edit"
                className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-indigo-300 disabled:opacity-40"
              >
                <Pencil size={12} />
              </button>
              <a
                href={buildPasteUrl(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open paste"
                className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-emerald-300"
              >
                <ExternalLink size={12} />
              </a>
              <button
                type="button"
                disabled={acting === p.id}
                onClick={() => remove(p.id, p.title)}
                title="Delete"
                className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-rose-300 disabled:opacity-40"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {!loading && pastes.length === 0 && (
          <p className="text-center py-8 text-[10px] font-mono text-slate-600">No pastes found</p>
        )}
      </div>

      {viewer && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setViewer(null)}>
          <div
            className="w-full max-w-3xl rounded-xl border border-cyan-500/25 bg-[#0c0d12] p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-cyan-200 flex items-center gap-2">
                  <FileText size={14} /> {viewer.meta.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <PasteVisibilityBadge visibility={viewer.meta.visibility} />
                  <span className="text-[8px] font-mono text-slate-500">{viewer.meta.id}</span>
                </div>
              </div>
              <button type="button" onClick={() => setViewer(null)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>
            <pre className="text-[10px] font-mono text-slate-300 bg-black/40 border border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-[50vh]">
              {viewer.content}
            </pre>
            <div className="mt-3 flex gap-2">
              <ActionButton onClick={() => { void copyToClipboard(viewer.content); }} variant="cyan">Copy</ActionButton>
              <ActionButton onClick={() => { setViewer(null); void openEdit(viewer.meta.id); }} variant="indigo">Edit</ActionButton>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setEditor(null)}>
          <div
            className="w-full max-w-3xl rounded-xl border border-violet-500/25 bg-[#0c0d12] p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-violet-200 mb-3 flex items-center gap-2">
              <Pencil size={14} /> Edit paste — {editor.id}
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <label className="col-span-2">
                <span className="text-[8px] font-mono text-slate-500 uppercase">Title</span>
                <input
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
                />
              </label>
              <label>
                <span className="text-[8px] font-mono text-slate-500 uppercase">Language</span>
                <select
                  value={editor.language}
                  onChange={(e) => setEditor({ ...editor, language: e.target.value })}
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
                >
                  {PASTE_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[8px] font-mono text-slate-500 uppercase">Visibility</span>
                <select
                  value={editor.visibility}
                  onChange={(e) => setEditor({ ...editor, visibility: e.target.value as PasteVisibility })}
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
                >
                  {PASTE_VISIBILITY_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
              {editor.visibility === 'protected' && (
                <label className="col-span-2">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">
                    Password {editor.hasPassword ? '(leave empty to keep)' : '(required)'}
                  </span>
                  <input
                    type="password"
                    value={editor.password}
                    onChange={(e) => setEditor({ ...editor, password: e.target.value })}
                    className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
                  />
                </label>
              )}
              <label>
                <span className="text-[8px] font-mono text-slate-500 uppercase">Expiry</span>
                <select
                  value={editor.expiry}
                  onChange={(e) => setEditor({ ...editor, expiry: e.target.value as PasteExpiry })}
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
                >
                  {PASTE_EXPIRY_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editor.burnAfterRead}
                    onChange={(e) => setEditor({ ...editor, burnAfterRead: e.target.checked })}
                    className="accent-orange-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400">Burn after read</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editor.pinned}
                    onChange={(e) => setEditor({ ...editor, pinned: e.target.checked })}
                    className="accent-amber-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400">Pinned</span>
                </label>
              </div>
              <label className="col-span-2">
                <span className="text-[8px] font-mono text-slate-500 uppercase">Content</span>
                <textarea
                  value={editor.content}
                  onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                  rows={14}
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300 font-mono"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <ActionButton onClick={saveEdit} variant="indigo" disabled={saving}>{saving ? 'Saving…' : 'Save'}</ActionButton>
              <ActionButton onClick={() => setEditor(null)} variant="cyan">Cancel</ActionButton>
            </div>
          </div>
        </div>
      )}
    </ToolCard>
  );
}