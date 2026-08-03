/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from './PageShell';
import { useMemeCatalog } from '../../hooks/useMemeCatalog';
import { useFirebaseMemesCreated } from '../../hooks/useFirebaseMemesCreated';
import { useMemeStorage } from '../../hooks/useMemeStorage';
import type { MemeTemplate, MemeTemplateType } from '../../types/meme';
import { MemeDatabaseStats } from '../meme/MemeDatabaseStats';
import { MemeEditor } from '../meme/MemeEditor';
import { decodeMemeName, memeMediaUrl } from '../../utils/memeMedia';
import { POPULAR_TAGS } from '../../utils/memeEditorConfig';

const PAGE_SIZE = 48;

type FilterType = 'all' | MemeTemplateType | 'favorites' | 'recent';
type SortMode = 'default' | 'name' | 'random';
type GridSize = 'cozy' | 'compact';

function useDebouncedValue<T>(value: T, delay = 280): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function MemeGeneratorPage() {
  const { catalog, loading, error } = useMemeCatalog();
  const { memesCreated, recordMemeCreated } = useFirebaseMemesCreated();
  const { favorites, recent, toggleFavorite, recordRecent, isFavorite } = useMemeStorage();
  const uploadRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortMode>('default');
  const [gridSize, setGridSize] = useState<GridSize>('cozy');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MemeTemplate | null>(null);
  const [customUpload, setCustomUpload] = useState<MemeTemplate | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<MemeTemplate | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const templateMap = useMemo(() => {
    const map = new Map<string, MemeTemplate>();
    catalog?.templates.forEach((t) => map.set(t.id, t));
    return map;
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = debouncedSearch.toLowerCase().trim();
    let list = catalog.templates.filter((t) => {
      const typeOk = filter === 'all' || filter === 'favorites' || filter === 'recent' || t.type === filter;
      const searchOk = !q || t.name.toLowerCase().includes(q) || t.path.toLowerCase().includes(q);
      return typeOk && searchOk;
    });

    if (filter === 'favorites') {
      const favSet = new Set(favorites);
      list = list.filter((t) => favSet.has(t.id));
    }
    if (filter === 'recent') {
      const ordered = recent.map((id) => templateMap.get(id)).filter(Boolean) as MemeTemplate[];
      list = q
        ? ordered.filter((t) => t.name.toLowerCase().includes(q) || t.path.toLowerCase().includes(q))
        : ordered;
    }

    if (sort === 'name') {
      list = [...list].sort((a, b) => decodeMemeName(a.name).localeCompare(decodeMemeName(b.name)));
    } else if (sort === 'random') {
      list = [...list].sort((a, b) => {
        const ha = (a.id.charCodeAt(0) + shuffleSeed) % 97;
        const hb = (b.id.charCodeAt(0) + shuffleSeed) % 97;
        return ha - hb;
      });
    }
    return list;
  }, [catalog, debouncedSearch, filter, sort, favorites, recent, templateMap, shuffleSeed]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleCount = Math.min((page + 1) * PAGE_SIZE, filtered.length);
  const paged = filtered.slice(0, visibleCount);

  const recentTemplates = useMemo(
    () => recent.map((id) => templateMap.get(id)).filter(Boolean).slice(0, 10) as MemeTemplate[],
    [recent, templateMap],
  );

  const gridCols = gridSize === 'cozy'
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
    : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6';

  const selectTemplate = useCallback((t: MemeTemplate) => {
    recordRecent(t.id);
    setSelected(t);
  }, [recordRecent]);

  const pickRandom = useCallback(() => {
    if (!catalog || catalog.templates.length === 0) return;
    const q = debouncedSearch.toLowerCase().trim();
    const pool = catalog.templates.filter((t) => {
      const typeOk = filter === 'all' || filter === 'favorites' || filter === 'recent' || t.type === filter;
      const searchOk = !q || t.name.toLowerCase().includes(q) || t.path.toLowerCase().includes(q);
      if (!typeOk || !searchOk) return false;
      if (filter === 'favorites') return favorites.includes(t.id);
      return true;
    });
    const list = filter === 'recent'
      ? recent.map((id) => templateMap.get(id)).filter(Boolean) as MemeTemplate[]
      : pool;
    if (list.length === 0) return;
    selectTemplate(list[Math.floor(Math.random() * list.length)]);
  }, [catalog, debouncedSearch, filter, favorites, recent, templateMap, selectTemplate]);

  const handleUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (customUpload?.mediaUrl) URL.revokeObjectURL(customUpload.mediaUrl);
    const url = URL.createObjectURL(file);
    const custom: MemeTemplate = {
      id: `upload-${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, '') || 'Custom image',
      path: url,
      type: 'upload',
      previewUrl: url,
      mediaUrl: url,
    };
    setCustomUpload(custom);
    setSelected(custom);
  }, [customUpload]);

  useEffect(() => () => {
    if (customUpload?.mediaUrl) URL.revokeObjectURL(customUpload.mediaUrl);
  }, [customUpload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'r' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        pickRandom();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, pickRandom]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (selected) return;
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((i) => i.type.startsWith('image/'))
        ?.getAsFile();
      if (file) handleUpload(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [selected, handleUpload]);

  const onCardEnter = (t: MemeTemplate, e: React.MouseEvent) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoverPreview(t);
      setHoverPos({ x: e.clientX, y: e.clientY });
    }, 350);
  };

  const onCardLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverPreview(null);
  };

  const statsBar = (
    <MemeDatabaseStats catalog={catalog} loading={loading} memesCreated={memesCreated} />
  );

  if (selected) {
    return (
      <PageShell
        id="memegen-module"
        pageId="memegen"
        icon="🖼️"
        title="Meme Generator"
        subtitle="Edit · draft auto-saved"
        accentClass="text-rose-400"
      >
        <div className="flex flex-col gap-3 min-h-0 h-full">
          {statsBar}
          <MemeEditor
            template={selected}
            onBack={() => {
              if (customUpload?.id === selected.id) {
                URL.revokeObjectURL(customUpload.mediaUrl);
                setCustomUpload(null);
              }
              setSelected(null);
            }}
            onMemeCreated={recordMemeCreated}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      id="memegen-module"
      pageId="memegen"
      icon="🖼️"
      title="Meme Generator"
      subtitle="Search · favorites · drag & drop · / or Ctrl+K focuses search"
      accentClass="text-rose-400"
    >
      <div
        className={`flex flex-col gap-2.5 min-h-0 transition ${dragOver ? 'ring-2 ring-emerald-500/40 rounded-lg' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleUpload(file);
        }}
      >
        {statsBar}

        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search memes… (/ or Ctrl+K)"
              className="bg-[#0b0c10] border border-slate-800 text-[11px] font-mono rounded-lg pl-3 pr-8 py-2.5 text-slate-200 w-full focus:outline-none focus:border-rose-500/50 transition-all"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setPage(0); searchRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 text-[12px] w-6 h-6 flex items-center justify-center">
                ×
              </button>
            )}
          </div>
          <div className="flex gap-1 shrink-0 flex-wrap">
            {([
              ['all', 'All'],
              ['image', 'Image'],
              ['gif', 'GIF'],
              ['favorites', `★ ${favorites.length}`],
              ['recent', 'Recent'],
            ] as const).map(([f, label]) => (
              <button key={f} type="button" onClick={() => { setFilter(f); setPage(0); }}
                className={`text-[9px] font-mono px-3 py-2 rounded-lg border transition min-h-[36px] ${
                  filter === f ? 'bg-rose-500/15 border-rose-500/40 text-rose-300' : 'border-slate-800 text-slate-500 hover:border-slate-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Popular tags */}
        <div className="flex flex-wrap gap-1 shrink-0 items-center">
          <span className="text-[8px] text-slate-600 font-mono mr-1">Popular:</span>
          {POPULAR_TAGS.map((tag) => (
            <button key={tag} type="button" onClick={() => { setSearch(tag); setPage(0); searchRef.current?.focus(); }}
              className="text-[8px] font-mono px-2 py-1 rounded-full border border-slate-800/80 text-slate-500 hover:text-rose-300 hover:border-rose-500/30">
              {tag}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 shrink-0 items-center">
          <button type="button" onClick={pickRandom} disabled={!catalog}
            className="text-[10px] font-mono px-4 py-2 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 disabled:opacity-40 min-h-[36px]"
            title="Shortcut: R">
            🎲 Random
          </button>
          <button type="button" onClick={() => uploadRef.current?.click()}
            className="text-[10px] font-mono px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 min-h-[36px]">
            📤 Upload image
          </button>
          <span className="text-[8px] text-slate-600 font-mono hidden sm:inline">or drag / paste image here</span>
          <input ref={uploadRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
          <select value={sort} onChange={(e) => {
            const v = e.target.value as SortMode;
            setSort(v);
            if (v === 'random') setShuffleSeed(Date.now());
            setPage(0);
          }} className="text-[9px] font-mono bg-[#0b0c10] border border-slate-800 rounded-lg px-2 py-2 text-slate-400 ml-auto">
            <option value="default">Default</option>
            <option value="name">A–Z</option>
            <option value="random">Shuffle</option>
          </select>
          <button type="button" onClick={() => setGridSize((g) => g === 'cozy' ? 'compact' : 'cozy')}
            className="text-[9px] font-mono px-2 py-2 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300"
            title="Toggle grid size">
            {gridSize === 'cozy' ? '▦ Compact' : '▣ Large'}
          </button>
        </div>

        {recentTemplates.length > 0 && filter !== 'recent' && (
          <div className="shrink-0">
            <p className="text-[8px] font-mono text-slate-600 mb-1.5">Recently edited</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {recentTemplates.map((t) => (
                <button key={t.id} type="button" onClick={() => selectTemplate(t)} title={decodeMemeName(t.name)}
                  className="shrink-0 w-16 rounded-lg border border-slate-800/80 overflow-hidden hover:border-rose-500/50 hover:scale-105 transition-transform">
                  <img src={memeMediaUrl(t.previewUrl)} alt="" className="w-full aspect-square object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-[10px] font-mono text-slate-500 animate-pulse py-8 text-center">Loading meme database…</div>
        )}

        {error && (
          <div className="p-4 border border-red-500/30 bg-red-950/20 rounded-lg text-[10px] font-mono text-red-300">
            <p>Catalog not found: {error}</p>
            <p className="text-slate-500 mt-2">Run: <code className="text-amber-300">node scripts/scrape-imgflip-memes.mjs</code></p>
          </div>
        )}

        {catalog && (
          <>
            <div className="text-[9px] font-mono text-slate-600 shrink-0 flex justify-between">
              <span>
                {filtered.length.toLocaleString('en-US')} matches
                {search !== debouncedSearch && ' · Searching…'}
                {filter === 'favorites' && favorites.length === 0 && ' — click ★ in gallery'}
              </span>
              <span>{paged.length} / {filtered.length} shown</span>
            </div>

            <div className={`grid ${gridCols} gap-2.5 min-h-0 overflow-y-auto flex-1 content-start pr-1 max-h-[420px]`}>
              {paged.map((t) => (
                <div key={t.id} className="relative group"
                  onMouseEnter={(e) => onCardEnter(t, e)}
                  onMouseLeave={onCardLeave}
                  onMouseMove={(e) => hoverPreview?.id === t.id && setHoverPos({ x: e.clientX, y: e.clientY })}>
                  <button type="button" onClick={() => selectTemplate(t)} title={decodeMemeName(t.name)}
                    className="w-full text-left rounded-lg border border-slate-800/80 bg-[#161a24] hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-500/5 overflow-hidden transition-all active:scale-[0.98]">
                    <div className={`bg-black/40 relative overflow-hidden ${gridSize === 'cozy' ? 'aspect-[4/3]' : 'aspect-square'}`}>
                      <img src={memeMediaUrl(t.previewUrl)} alt={t.name} loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      {t.type === 'gif' && (
                        <span className="absolute top-1.5 right-1.5 text-[7px] font-bold bg-violet-500/90 text-white px-1.5 py-0.5 rounded">GIF</span>
                      )}
                    </div>
                    <div className="p-2">
                      <span className="text-[9px] font-mono text-slate-400 line-clamp-2 leading-snug block">{decodeMemeName(t.name)}</span>
                    </div>
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleFavorite(t.id); }}
                    className={`absolute top-1.5 left-1.5 w-7 h-7 rounded-md text-[11px] flex items-center justify-center transition shadow ${
                      isFavorite(t.id)
                        ? 'bg-amber-500 text-black opacity-100'
                        : 'bg-black/70 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-amber-500/80 hover:text-black'
                    }`}
                    title={isFavorite(t.id) ? 'Remove favorite' : 'Favorite'}>
                    ★
                  </button>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="text-[10px] text-slate-500 font-mono text-center py-8">No memes found — try another search term?</p>
            )}

            {visibleCount < filtered.length && (
              <div className="flex justify-center shrink-0 pt-1">
                <button type="button" onClick={() => setPage((p) => p + 1)}
                  className="text-[10px] font-mono px-6 py-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 min-w-[200px]">
                  Load more ({filtered.length - visibleCount} left)
                </button>
              </div>
            )}

            {pageCount > 1 && visibleCount >= filtered.length && (
              <p className="text-[8px] text-slate-600 font-mono text-center">All {filtered.length} memes loaded</p>
            )}
          </>
        )}

        {dragOver && (
          <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px]">
            <div className="px-8 py-6 rounded-xl border-2 border-dashed border-emerald-400/60 bg-black/60 text-emerald-300 font-mono text-sm">
              Release image to upload
            </div>
          </div>
        )}

        {hoverPreview && (
          <div className="fixed z-50 pointer-events-none border border-slate-700 rounded-lg overflow-hidden shadow-2xl bg-black"
            style={{
              left: Math.min(hoverPos.x + 16, window.innerWidth - 220),
              top: Math.min(hoverPos.y + 16, window.innerHeight - 220),
              width: 200,
            }}>
            <img src={memeMediaUrl(hoverPreview.previewUrl)} alt="" className="w-full aspect-square object-cover" />
            <p className="text-[9px] font-mono text-slate-300 p-2 truncate">{decodeMemeName(hoverPreview.name)}</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}