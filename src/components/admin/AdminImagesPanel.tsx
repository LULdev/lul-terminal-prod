/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { ExternalLink, ImageIcon, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  adminDeleteImage,
  fetchAdminImages,
  type AdminImageMeta,
  type AdminImagesData,
} from '../../lib/adminModules';
import { formatBytes } from '../../lib/terminalStats';
import { safeHostedImageUrl, safeHostedViewUrl } from '../../lib/safeHostedImageUrl';
import { ToolCard } from '../pages/PageShell';

type Sort = 'newest' | 'oldest' | 'views' | 'size';

export function AdminImagesPanel() {
  const [data, setData] = useState<AdminImagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [acting, setActing] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminImageMeta | null>(null);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const result = await fetchAdminImages({ limit: 120, q: search || undefined, sort });
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, sort, loadGenRef, mountedRef]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const handleDelete = async (img: AdminImageMeta) => {
    if (!confirm(`Delete image "${img.name}"?`)) return;
    setActing(img.id);
    try {
      await adminDeleteImage(img.id);
      setSuccess('Image deleted');
      if (preview?.id === img.id) setPreview(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[9px] font-mono text-slate-500">
        Image gallery admin — all hosted images, views, storage & delete.
      </p>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
            <div className="text-[7px] font-mono uppercase text-slate-600">On disk</div>
            <div className="text-sm font-mono font-bold text-slate-200">{data.stats.onDisk}</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
            <div className="text-[7px] font-mono uppercase text-slate-600">Storage</div>
            <div className="text-sm font-mono font-bold text-orange-300">{formatBytes(data.stats.totalBytes)}</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
            <div className="text-[7px] font-mono uppercase text-slate-600">Views</div>
            <div className="text-sm font-mono font-bold text-cyan-300">{data.stats.totalViews.toLocaleString('en-US')}</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
            <div className="text-[7px] font-mono uppercase text-slate-600">Shown</div>
            <div className="text-sm font-mono font-bold text-slate-200">{data.images.length}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, ID, MIME…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="views">Most views</option>
          <option value="size">Largest</option>
        </select>
        <button type="button" title="Refresh" aria-label="Refresh" onClick={() => void load()} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-violet-300">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="text-[9px] font-mono text-rose-400">{error}</div>}
      {success && <div className="text-[9px] font-mono text-emerald-400">{success}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <ToolCard title="Gallery" icon="🖼️" accent="orange">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
            {(data?.images ?? []).map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setPreview(img)}
                className={`relative aspect-square rounded-lg border overflow-hidden group ${
                  preview?.id === img.id ? 'border-violet-500/50 ring-1 ring-violet-500/30' : 'border-slate-800/80 hover:border-slate-600'
                }`}
              >
                <img src={safeHostedImageUrl(img.url, img.id) ?? ''} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[6px] font-mono text-slate-400 truncate">
                  {img.views} views
                </div>
              </button>
            ))}
            {!data?.images.length && !loading && (
              <div className="col-span-full py-8 text-center text-slate-600">
                <ImageIcon size={24} className="mx-auto mb-2 opacity-40" />
                <span className="text-[9px] font-mono">No images</span>
              </div>
            )}
          </div>
        </ToolCard>

        {preview && (() => {
          const previewDirect = safeHostedImageUrl(preview.url, preview.id) ?? '';
          const previewView = safeHostedViewUrl(undefined, preview.id) ?? previewDirect;
          return (
          <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-black/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-[11px] font-mono font-bold text-slate-200">{preview.name}</h4>
                <p className="text-[8px] font-mono text-slate-600">{preview.id} · {preview.mime}</p>
              </div>
              <div className="flex gap-1">
                {previewView && (
                  <a
                    href={previewView}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-300"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  type="button"
                  disabled={acting === preview.id}
                  onClick={() => void handleDelete(preview)}
                  className="p-1.5 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {previewDirect && <img src={previewDirect} alt={preview.name} className="max-h-48 rounded-lg border border-slate-800 object-contain mx-auto" />}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8px] font-mono">
              <div><span className="text-slate-600">Size</span><br /><span className="text-slate-300">{formatBytes(preview.size)}</span></div>
              <div><span className="text-slate-600">Dims</span><br /><span className="text-slate-300">{preview.width ?? '?'}×{preview.height ?? '?'}</span></div>
              <div><span className="text-slate-600">Views</span><br /><span className="text-cyan-300">{preview.views}</span></div>
              <div><span className="text-slate-600">User</span><br /><span className="text-violet-300 truncate">{preview.userId ?? 'guest'}</span></div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}