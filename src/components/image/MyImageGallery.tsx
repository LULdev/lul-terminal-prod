/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Copy,
  Eye,
  Grid3X3,
  HardDrive,
  List,
  Search,
  Square,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  buildBbcode,
  buildHtml,
  buildMarkdown,
  buildViewUrl,
  deleteHostedImage,
  fetchMyGallery,
  fetchMyGalleryStats,
  formatImageBytes,
  mimeLabel,
  updateHostedImage,
  type GallerySort,
  type HostedImageMeta,
  type MyGalleryStats,
} from '../../lib/imageHosting';
import { safeHostedImageUrl, safeHostedViewUrl } from '../../lib/safeHostedImageUrl';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';

type MyImageGalleryProps = {
  refreshKey?: number;
  onSelectImage?: (img: HostedImageMeta) => void;
};

const SORT_OPTIONS: { id: GallerySort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'views', label: 'Most views' },
  { id: 'size', label: 'Largest' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'favorites', label: 'Favorites first' },
];

const MIME_FILTERS = ['all', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'] as const;

export function MyImageGallery({ refreshKey = 0, onSelectImage }: MyImageGalleryProps) {
  const [images, setImages] = useState<HostedImageMeta[]>([]);
  const [stats, setStats] = useState<MyGalleryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<GallerySort>('newest');
  const [mimeFilter, setMimeFilter] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<HostedImageMeta | null>(null);
  const [busy, setBusy] = useState(false);
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
      const [gallery, galleryStats] = await Promise.all([
        fetchMyGallery(sort),
        fetchMyGalleryStats(),
      ]);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setImages(gallery.images);
      setStats(galleryStats);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load gallery');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, refreshKey]);

  useVisibilityAwarePoll(() => { void load(); }, 30_000);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return images.filter((img) => {
      if (favoritesOnly && !img.favorite) return false;
      if (mimeFilter !== 'all' && img.mime !== mimeFilter) return false;
      if (!q) return true;
      const inName = img.name.toLowerCase().includes(q);
      const inTags = (img.tags ?? []).some((t) => t.includes(q));
      const inId = img.id.includes(q);
      return inName || inTags || inId;
    });
  }, [images, search, mimeFilter, favoritesOnly]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFavorite = async (img: HostedImageMeta) => {
    try {
      const updated = await updateHostedImage(img.id, { favorite: !img.favorite });
      setImages((prev) => prev.map((i) => (i.id === img.id ? updated : i)));
      if (detail?.id === img.id) setDetail(updated);
      load().catch(() => {});
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Really delete image? Link will stop working.')) return;
    setBusy(true);
    try {
      await deleteHostedImage(id);
      setImages((prev) => prev.filter((i) => i.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (detail?.id === id) setDetail(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} images?`)) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => deleteHostedImage(id)));
      setSelected(new Set());
      setBulkMode(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bulk delete failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkCopy = async () => {
    const urls = filtered.filter((i) => selected.has(i.id)).map((i) => safeHostedViewUrl(i.viewUrl, i.id) ?? buildViewUrl(i.id));
    if (!urls.length) return;
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
    } catch { /* ignore */ }
  };

  const storagePct = stats ? Math.min(100, Math.round((stats.totalBytes / stats.storageLimitBytes) * 100)) : 0;

  if (loading && !images.length) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && <GalleryStatsPanel stats={stats} storagePct={storagePct} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[140px] relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, tag, ID…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-300 focus:border-sky-500/40 focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as GallerySort)}
          className="px-2 py-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-400"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={`px-2.5 py-2 rounded-lg border text-[10px] font-mono flex items-center gap-1 ${
            favoritesOnly ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-slate-800 text-slate-500'
          }`}
        >
          <Star size={11} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favs
        </button>
        <button
          type="button"
          onClick={() => { setBulkMode((v) => !v); setSelected(new Set()); }}
          className={`px-2.5 py-2 rounded-lg border text-[10px] font-mono ${
            bulkMode ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-slate-800 text-slate-500'
          }`}
        >
          {bulkMode ? <CheckSquare size={11} className="inline mr-1" /> : <Square size={11} className="inline mr-1" />}
          Bulk
        </button>
        <div className="flex rounded-lg border border-slate-800 overflow-hidden">
          <button type="button" onClick={() => setViewMode('grid')} className={`px-2 py-2 ${viewMode === 'grid' ? 'bg-sky-500/15 text-sky-300' : 'text-slate-600'}`}>
            <Grid3X3 size={12} />
          </button>
          <button type="button" onClick={() => setViewMode('list')} className={`px-2 py-2 ${viewMode === 'list' ? 'bg-sky-500/15 text-sky-300' : 'text-slate-600'}`}>
            <List size={12} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MIME_FILTERS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMimeFilter(m)}
            className={`px-2 py-1 rounded-full text-[8px] font-mono border transition ${
              mimeFilter === m
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                : 'border-slate-800 text-slate-600 hover:text-slate-400'
            }`}
          >
            {m === 'all' ? 'All' : mimeLabel(m)}
            {stats?.byMime && m !== 'all' && stats.byMime[m] ? ` (${stats.byMime[m]})` : ''}
          </button>
        ))}
      </div>

      {bulkMode && selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-xl border border-violet-500/25 bg-violet-500/5">
          <span className="text-[9px] font-mono text-violet-300">{selected.size} selected</span>
          <button type="button" onClick={handleBulkCopy} className="text-[9px] font-mono px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-cyan-300">
            <Copy size={10} className="inline mr-1" /> Copy links
          </button>
          <button type="button" onClick={handleBulkDelete} disabled={busy} className="text-[9px] font-mono px-2 py-1 rounded border border-rose-800/50 text-rose-400 hover:bg-rose-500/10">
            <Trash2 size={10} className="inline mr-1" /> Delete
          </button>
        </div>
      )}

      {error && (
        <p className="text-[10px] font-mono text-rose-400 p-3 rounded-xl border border-rose-500/20 bg-rose-950/20">{error}</p>
      )}

      {!filtered.length ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-slate-800">
          <p className="text-3xl mb-2">🖼️</p>
          <p className="text-[11px] font-mono text-slate-500">
            {images.length ? 'No matches for filter/search' : 'No uploads yet — upload your first image!'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filtered.map((img) => (
            <React.Fragment key={img.id}>
              <GalleryCard
                img={img}
                bulkMode={bulkMode}
                selected={selected.has(img.id)}
                onToggleSelect={() => toggleSelect(img.id)}
                onOpen={() => setDetail(img)}
                onFavorite={() => toggleFavorite(img)}
                onCopy={() => copyText(img.viewUrl ?? buildViewUrl(img.id))}
                onDelete={() => handleDelete(img.id)}
                onQuickOpen={onSelectImage}
              />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((img) => (
            <React.Fragment key={img.id}>
              <GalleryListRow
                img={img}
                bulkMode={bulkMode}
                selected={selected.has(img.id)}
                onToggleSelect={() => toggleSelect(img.id)}
                onOpen={() => setDetail(img)}
                onFavorite={() => toggleFavorite(img)}
                onCopy={() => copyText(img.viewUrl ?? buildViewUrl(img.id))}
                onDelete={() => handleDelete(img.id)}
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {detail && (
        <ImageDetailModal
          img={detail}
          busy={busy}
          onClose={() => setDetail(null)}
          onFavorite={() => toggleFavorite(detail)}
          onDelete={() => handleDelete(detail.id)}
          onSave={async (patch) => {
            const updated = await updateHostedImage(detail.id, patch);
            setImages((prev) => prev.map((i) => (i.id === detail.id ? updated : i)));
            setDetail(updated);
            load().catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function GalleryStatsPanel({ stats, storagePct }: { stats: MyGalleryStats; storagePct: number }) {
  return (
    <div className="rounded-2xl border border-sky-500/15 bg-gradient-to-br from-sky-950/30 via-[#0c0d12] to-violet-950/20 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800/40">
        <MiniStat icon="🖼️" label="Your uploads" value={String(stats.count)} accent="text-sky-300" />
        <MiniStat icon="👁️" label="Your views" value={stats.totalViews.toLocaleString('en-US')} accent="text-violet-300" />
        <MiniStat icon="📊" label="Avg views" value={String(stats.avgViews)} accent="text-cyan-300" />
        <MiniStat icon="⭐" label="Favorites" value={String(stats.favorites)} accent="text-amber-300" />
      </div>
      <div className="px-4 py-3 border-t border-slate-800/50">
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 mb-1.5">
          <span className="flex items-center gap-1"><HardDrive size={10} /> Storage</span>
          <span>{formatImageBytes(stats.totalBytes)} / {formatImageBytes(stats.storageLimitBytes)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${storagePct > 85 ? 'bg-rose-500' : storagePct > 60 ? 'bg-amber-500' : 'bg-gradient-to-r from-sky-500 to-cyan-400'}`}
            style={{ width: `${storagePct}%` }}
          />
        </div>
        {stats.topViewedId && (
          <p className="text-[8px] font-mono text-slate-600 mt-2 flex items-center gap-1">
            <TrendingUp size={9} className="text-emerald-500" />
            Top Hit: <span className="text-emerald-400/90">{stats.topViewedViews} Views</span>
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0c0d12]/80 px-3 py-2.5">
      <div className="text-sm mb-0.5">{icon}</div>
      <div className={`text-[14px] font-mono font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[7px] font-mono text-slate-600 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function GalleryCard({
  img, bulkMode, selected, onToggleSelect, onOpen, onFavorite, onCopy, onDelete, onQuickOpen,
}: {
  img: HostedImageMeta;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onFavorite: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onQuickOpen?: (img: HostedImageMeta) => void;
}) {
  const isGif = img.mime === 'image/gif';
  return (
    <div
      className={`group relative aspect-square rounded-xl overflow-hidden border bg-black/40 transition-all ${
        selected ? 'border-violet-500/60 ring-1 ring-violet-500/30' : 'border-slate-800/80 hover:border-sky-500/40'
      }`}
    >
      <button type="button" onClick={bulkMode ? onToggleSelect : onOpen} className="absolute inset-0 w-full h-full">
        <img src={safeHostedImageUrl(img.url, img.id) ?? ''} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {isGif && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[7px] font-mono bg-black/70 text-rose-300 border border-rose-500/30">GIF</span>
      )}
      {img.favorite && (
        <Star size={12} className="absolute top-1.5 right-1.5 text-amber-400 fill-amber-400 drop-shadow" />
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-[8px] font-mono text-white truncate">{img.name}</p>
        <p className="text-[7px] font-mono text-slate-400 flex items-center gap-2">
          <span className="flex items-center gap-0.5"><Eye size={8} /> {img.views ?? 0}</span>
          <span>{formatImageBytes(img.size)}</span>
        </p>
      </div>

      <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {bulkMode ? (
          <button type="button" onClick={onToggleSelect} className="p-1 rounded bg-black/70 border border-slate-700 text-slate-300">
            {selected ? <CheckSquare size={11} /> : <Square size={11} />}
          </button>
        ) : (
          <>
            <button type="button" title="Toggle favorite" aria-label="Toggle favorite" onClick={(e) => { e.stopPropagation(); onFavorite(); }} className="p-1 rounded bg-black/70 border border-slate-700 text-amber-400 hover:bg-amber-500/20">
              <Star size={11} fill={img.favorite ? 'currentColor' : 'none'} />
            </button>
            <button type="button" title="Copy link" aria-label="Copy link" onClick={(e) => { e.stopPropagation(); onCopy(); }} className="p-1 rounded bg-black/70 border border-slate-700 text-cyan-400 hover:bg-cyan-500/20">
              <Copy size={11} />
            </button>
            {onQuickOpen && (
              <button type="button" title="Open in new tab" aria-label="Open in new tab" onClick={(e) => { e.stopPropagation(); onQuickOpen(img); }} className="p-1 rounded bg-black/70 border border-slate-700 text-sky-400 text-[8px] font-mono px-1.5">
                ↗
              </button>
            )}
            <button type="button" title="Delete" aria-label="Delete image" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded bg-black/70 border border-slate-700 text-rose-400 hover:bg-rose-500/20">
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GalleryListRow({
  img, bulkMode, selected, onToggleSelect, onOpen, onFavorite, onCopy, onDelete,
}: {
  img: HostedImageMeta;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onFavorite: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl border bg-black/25 hover:bg-black/40 transition ${
      selected ? 'border-violet-500/40' : 'border-slate-800/80'
    }`}>
      {bulkMode && (
        <button type="button" onClick={onToggleSelect} className="text-slate-500 shrink-0">
          {selected ? <CheckSquare size={14} className="text-violet-400" /> : <Square size={14} />}
        </button>
      )}
      <button type="button" onClick={onOpen} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-800">
        <img src={safeHostedImageUrl(img.url, img.id) ?? ''} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
      </button>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        <p className="text-[10px] font-mono text-slate-200 truncate flex items-center gap-1">
          {img.favorite && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
          {img.name}
        </p>
        <p className="text-[8px] font-mono text-slate-600">
          {mimeLabel(img.mime)} · {formatImageBytes(img.size)}
          {img.width && img.height ? ` · ${img.width}×${img.height}` : ''}
          · {new Date(img.createdAt).toLocaleDateString('en-US')}
        </p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono text-violet-300 tabular-nums flex items-center gap-0.5">
          <Eye size={10} /> {img.views ?? 0}
        </span>
        <button type="button" title="Toggle favorite" aria-label="Toggle favorite" onClick={onFavorite} className="text-amber-400/80 hover:text-amber-300">
          <Star size={12} fill={img.favorite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" title="Copy link" aria-label="Copy link" onClick={onCopy} className="text-slate-600 hover:text-cyan-300"><Copy size={12} /></button>
        <button type="button" title="Delete" aria-label="Delete image" onClick={onDelete} className="text-slate-600 hover:text-rose-400"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function ImageDetailModal({
  img, busy, onClose, onFavorite, onDelete, onSave,
}: {
  img: HostedImageMeta;
  busy: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onSave: (patch: { name?: string; tags?: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState(img.name);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(img.tags ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(img.name);
    setTags(img.tags ?? []);
  }, [img]);

  const directUrl = safeHostedImageUrl(img.url, img.id) ?? '';
  const viewUrl = safeHostedViewUrl(img.viewUrl, img.id) ?? buildViewUrl(img.id);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t) || tags.length >= 12) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const saveMeta = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || img.name, tags });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0c0d12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-[12px] font-mono text-sky-300 font-semibold truncate pr-4">{img.name}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-black/50 flex items-center justify-center p-4 min-h-[180px]">
            {directUrl && <img src={directUrl} alt={img.name} className="max-h-[320px] max-w-full object-contain rounded-lg" />}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <StatChip label="Views" value={String(img.views ?? 0)} />
            <StatChip label="Size" value={formatImageBytes(img.size)} />
            <StatChip label="Type" value={mimeLabel(img.mime)} />
            <StatChip label="Dimensions" value={img.width && img.height ? `${img.width}×${img.height}` : '—'} />
          </div>

          <div className="space-y-2">
            <label className="block text-[9px] font-mono text-slate-500">Filename</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-200"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[9px] font-mono text-slate-500 flex items-center gap-1"><Tag size={10} /> Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-[8px] font-mono text-sky-300">
                  {t}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="text-slate-500 hover:text-rose-400">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add tag…"
                className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-300"
              />
              <button type="button" onClick={addTag} className="px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400">+</button>
            </div>
          </div>

          <div className="space-y-2">
            <CopyRow label="Share-URL" value={viewUrl} />
            <CopyRow label="Direkt" value={directUrl} />
            <CopyRow label="Markdown" value={buildMarkdown(img.name, directUrl)} />
            <CopyRow label="BBCode" value={buildBbcode(directUrl)} />
            <CopyRow label="HTML" value={buildHtml(directUrl, img.name)} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onFavorite} className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-[9px] font-mono text-amber-300 hover:bg-amber-500/10">
              <Star size={11} className="inline mr-1" fill={img.favorite ? 'currentColor' : 'none'} />
              {img.favorite ? 'Favorite' : 'Mark favorite'}
            </button>
            <button type="button" onClick={saveMeta} disabled={saving} className="px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-[9px] font-mono text-sky-300">
              {saving ? 'Saving…' : 'Save metadata'}
            </button>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-white">
              Preview ↗
            </a>
            <button type="button" onClick={onDelete} disabled={busy} className="ml-auto px-3 py-1.5 rounded-lg border border-rose-800/50 text-[9px] font-mono text-rose-400 hover:bg-rose-500/10">
              <Trash2 size={11} className="inline mr-1" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-black/30 px-2 py-2">
      <div className="text-[7px] font-mono text-slate-600 uppercase">{label}</div>
      <div className="text-[11px] font-mono font-bold text-slate-200 tabular-nums">{value}</div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-mono text-slate-600 w-16 shrink-0">{label}</span>
      <code className="flex-1 text-[8px] font-mono text-slate-400 truncate bg-black/30 px-2 py-1 rounded border border-slate-800">{value}</code>
      <button type="button" onClick={copy} className="text-[8px] font-mono text-slate-500 hover:text-cyan-300 shrink-0">
        {copied ? '✓' : <Copy size={10} />}
      </button>
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch { /* ignore */ }
}