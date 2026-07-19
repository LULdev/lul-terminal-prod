/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  Flame,
  GitFork,
  Grid3X3,
  List,
  Lock,
  Pin,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  buildPasteUrl,
  copyToClipboard,
  deletePaste,
  downloadPasteText,
  expiryLabel,
  fetchMyPasteStats,
  fetchMyPastes,
  forkPaste,
  formatPasteBytes,
  formatPasteDate,
  updatePasteMeta,
  type MyPasteStats,
  type PasteMeta,
  type PasteSort,
} from '../../lib/paste';
import { sessionFetch } from '../../lib/sessionFetch';
import { languageLabel, PASTE_VISIBILITY_OPTIONS } from '../../data/pasteLanguages';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { PasteQrCode } from './PasteQrCode';
import { PasteViewCount } from './PasteViewCount';
import { PasteVisibilityBadge } from './PasteVisibilityBadge';

type Props = {
  refreshKey?: number;
  onDeleted?: () => void;
  onFork?: (payload: { title: string; content: string; language: string; visibility: string }) => void;
};

const SORT_OPTIONS: { id: PasteSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'views', label: 'Most views' },
  { id: 'size', label: 'Largest' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'pinned', label: 'Pinned first' },
];

export function MyPasteGallery({ refreshKey = 0, onDeleted, onFork }: Props) {
  const [pastes, setPastes] = useState<PasteMeta[]>([]);
  const [stats, setStats] = useState<MyPasteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PasteSort>('newest');
  const [visFilter, setVisFilter] = useState<string>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const gen = ++loadGenRef.current;
    if (!opts?.soft) setError('');
    try {
      const [items, galleryStats] = await Promise.all([
        fetchMyPastes(sort),
        fetchMyPasteStats(),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setPastes(items);
      setStats(galleryStats);
      setError('');
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      const msg = e instanceof Error ? e.message : 'Could not load pastes';
      // Soft polls keep last good data on transient errors
      if (opts?.soft && /too many|429|rate|permission|sign in|session/i.test(msg)) return;
      setError(msg);
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  useVisibilityAwarePoll(() => { void load({ soft: true }); }, 30_000);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pastes.filter((p) => {
      if (pinnedOnly && !p.pinned) return false;
      if (visFilter !== 'all' && p.visibility !== visFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q)
        || p.id.toLowerCase().includes(q)
        || languageLabel(p.language).toLowerCase().includes(q)
      );
    });
  }, [pastes, search, visFilter, pinnedOnly]);

  const onDelete = async (id: string) => {
    if (!confirm('Delete this paste permanently?')) return;
    setDeleting(id);
    try {
      await deletePaste(id);
      setPastes((prev) => prev.filter((p) => p.id !== id));
      onDeleted?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const onTogglePin = async (p: PasteMeta) => {
    try {
      const updated = await updatePasteMeta(p.id, { pinned: !p.pinned });
      setPastes((prev) => prev.map((x) => (x.id === p.id ? { ...x, pinned: updated.pinned } : x)));
      load().catch(() => {});
    } catch { /* ignore */ }
  };

  const handleFork = async (p: PasteMeta) => {
    try {
      const fork = await forkPaste(p.id);
      onFork?.(fork);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fork failed');
    }
  };

  const onCopyLink = async (p: PasteMeta) => {
    if (await copyToClipboard(buildPasteUrl(p.id))) {
      setCopied(p.id);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  const onDownload = async (p: PasteMeta) => {
    try {
      const res = await sessionFetch(`/api/paste/${p.id}/raw`);
      if (!res.ok) throw new Error('Download failed');
      const text = await res.text();
      downloadPasteText(p.title || p.id, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  };

  if (loading && !pastes.length) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
        <p className="text-[10px] font-mono text-slate-500 animate-pulse py-4 text-center">Loading your pastes…</p>
      </div>
    );
  }

  if (error && !pastes.length) {
    return <p className="text-[10px] font-mono text-rose-400 py-4">{error}</p>;
  }

  if (!pastes.length) {
    return (
      <div className="py-10 text-center">
        <p className="text-3xl opacity-30 mb-2">📋</p>
        <p className="text-[10px] font-mono text-slate-500">No pastes yet — create your first snippet above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <QuickStat label="Total" value={String(stats.count)} icon="📋" />
          <QuickStat label="Views" value={stats.totalViews.toLocaleString('en-US')} icon="👁️" />
          <QuickStat label="Pinned" value={String(stats.pinned)} icon="📌" />
          <QuickStat label="Protected" value={String(stats.protectedCount)} icon="🔑" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[140px] relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, ID, language…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-300 focus:border-emerald-500/40 focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as PasteSort)}
          className="bg-black/40 border border-slate-800 text-[10px] font-mono rounded-lg px-2.5 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/40"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <select
          value={visFilter}
          onChange={(e) => setVisFilter(e.target.value)}
          className="bg-black/40 border border-slate-800 text-[10px] font-mono rounded-lg px-2.5 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/40"
        >
          <option value="all">All visibility</option>
          {PASTE_VISIBILITY_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setPinnedOnly((v) => !v)}
          className={`text-[9px] font-mono px-2.5 py-2 rounded-lg border transition ${
            pinnedOnly
              ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
              : 'border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          <Pin size={10} className="inline mr-1" />Pinned
        </button>
        <div className="flex rounded-lg border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500'}`}
          >
            <Grid3X3 size={12} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500'}`}
          >
            <List size={12} />
          </button>
        </div>
      </div>

      {error && <p className="text-[9px] font-mono text-rose-400">{error}</p>}

      <p className="text-[8px] font-mono text-slate-600">
        {filtered.length} of {pastes.length} pastes
        {stats?.topViewedTitle && (
          <span className="ml-2 text-emerald-500/70">
            <TrendingUp size={9} className="inline mr-0.5" />
            Top: {stats.topViewedTitle} ({stats.topViewedViews} views)
          </span>
        )}
      </p>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-2'}>
        {filtered.map((p) => (
          <div key={p.id}>
            <PasteCard
              paste={p}
              viewMode={viewMode}
              expanded={expanded === p.id}
              copied={copied === p.id}
              deleting={deleting === p.id}
              onToggleExpand={() => setExpanded((id) => (id === p.id ? null : p.id))}
              onDelete={() => onDelete(p.id)}
              onFork={() => handleFork(p)}
              onPin={() => onTogglePin(p)}
              onCopy={() => onCopyLink(p)}
              onDownload={() => onDownload(p)}
            />
          </div>
        ))}
      </div>

      {!filtered.length && (
        <p className="text-[10px] font-mono text-slate-500 py-6 text-center">No pastes match your filters.</p>
      )}
    </div>
  );
}

function QuickStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/30 px-3 py-2 flex items-center gap-2">
      <span>{icon}</span>
      <div>
        <p className="text-[7px] font-mono uppercase text-slate-600">{label}</p>
        <p className="text-[13px] font-mono font-bold text-slate-200 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function PasteCard({
  paste: p,
  viewMode,
  expanded,
  copied,
  deleting,
  onToggleExpand,
  onDelete,
  onFork,
  onPin,
  onCopy,
  onDownload,
}: {
  paste: PasteMeta;
  viewMode: 'list' | 'grid';
  expanded: boolean;
  copied: boolean;
  deleting: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onFork: () => void;
  onPin: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const url = buildPasteUrl(p.id);

  return (
    <div
      className={`group rounded-xl border bg-black/30 transition ${
        p.pinned ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 hover:border-emerald-500/25'
      } ${viewMode === 'grid' ? 'p-3 flex flex-col gap-2' : 'p-3'}`}
    >
      <div className={`flex ${viewMode === 'grid' ? 'flex-col gap-2' : 'flex-wrap items-center gap-3'}`}>
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {p.pinned && <Pin size={10} className="text-amber-400 shrink-0 fill-amber-400/30" />}
            <span className="text-[10px] font-mono font-semibold text-slate-200 truncate">{p.title}</span>
            <PasteViewCount views={p.views ?? 0} />
            <PasteVisibilityBadge visibility={p.visibility} />
            {p.locked && <Lock size={10} className="text-amber-400 shrink-0" />}
            {p.burnAfterRead && <Flame size={10} className="text-orange-400 shrink-0" />}
          </div>
          <div className="flex flex-wrap gap-2 text-[8px] font-mono text-slate-500">
            <span className="text-indigo-300/80">{languageLabel(p.language)}</span>
            <span>{p.lineCount} lines</span>
            <span>{formatPasteBytes(p.size)}</span>
            <span>{formatPasteDate(p.createdAt)}</span>
            <span>{expiryLabel(p.expiresAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <ActionBtn icon={<Pin size={10} />} label={p.pinned ? 'Unpin' : 'Pin'} onClick={onPin} accent={p.pinned ? 'amber' : undefined} />
          <ActionBtn icon={<GitFork size={10} />} label="Fork" onClick={onFork} />
          <ActionBtn icon={<Copy size={10} />} label={copied ? '✓' : 'Link'} onClick={onCopy} />
          <ActionBtn icon={<Download size={10} />} label=".txt" onClick={onDownload} />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-mono px-2 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30 transition"
          >
            <ExternalLink size={10} /> Open
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-600 hover:text-rose-400 hover:border-rose-500/40 transition disabled:opacity-40"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-[8px] font-mono px-2 py-1 rounded border border-slate-800 text-slate-500 hover:text-slate-300"
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-2 animate-fade-in">
          <p className="text-[8px] font-mono text-slate-600 break-all">ID: {p.id}</p>
          <PasteQrCode url={url} />
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: 'amber';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 text-[9px] font-mono px-2 py-1.5 rounded-lg border transition ${
        accent === 'amber'
          ? 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
          : 'border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30'
      }`}
    >
      {icon} {label}
    </button>
  );
}