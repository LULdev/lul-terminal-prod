/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchHostedImage, ImageFetchError, pollImageMeta, recordImageView, type HostedImageMeta } from '../../lib/imageHosting';
import { safeHostedImageUrl } from '../../lib/safeHostedImageUrl';

type Props = { id: string };

function formatViews(n: number) {
  return n.toLocaleString('en-US');
}

export function ImageHostViewer({ id }: Props) {
  const { isLoggedIn, openAuth } = useAuth();
  const [meta, setMeta] = useState<HostedImageMeta | null>(null);
  const [views, setViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [viewsReady, setViewsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setNeedsLogin(false);
    setViewsReady(false);

    (async () => {
      try {
        const m = await fetchHostedImage(id, { credentialed: isLoggedIn });
        if (cancelled) return;
        if (!m) {
          setError('Image not found — link invalid or expired.');
          return;
        }
        setMeta(m);
        setViews(m.views ?? 0);
        const count = await recordImageView(id, { credentialed: isLoggedIn });
        if (!cancelled) {
          setViews(count);
          setViewsReady(true);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ImageFetchError && (e.status === 401 || e.status === 403)) {
          setNeedsLogin(true);
          setError('Sign in to view hosted images.');
          return;
        }
        setError('Could not load image — is the server running?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, isLoggedIn]);

  useEffect(() => {
    if (!meta) return;
    return pollImageMeta(id, (m) => {
      setMeta(m);
      setViews(m.views ?? 0);
      setViewsReady(true);
    }, 4000, { credentialed: isLoggedIn });
  }, [id, meta?.id, isLoggedIn]);

  useEffect(() => {
    if (meta?.name) document.title = `${meta.name} · ${formatViews(views)} views`;
    return () => { document.title = 'LUL Terminal'; };
  }, [meta?.name, views]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center">
        <p className="text-[11px] font-mono text-slate-500 animate-pulse">Loading image…</p>
      </div>
    );
  }

  const imageSrc = meta ? safeHostedImageUrl(meta.url, meta.id) : null;

  if (error || !meta || !imageSrc) {
    return (
      <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-4xl opacity-40">🖼️</p>
        <p className="text-[12px] font-mono text-red-300/90 text-center max-w-sm">{error || 'Not found'}</p>
        {needsLogin && (
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="inline-flex items-center justify-center gap-1.5 text-[10px] font-mono px-4 py-2 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
          >
            <LogIn size={12} /> Sign in
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-500/[0.03] via-transparent to-violet-500/[0.02] pointer-events-none" />

      <div className="max-w-[min(100%,1200px)] w-full flex flex-col items-center gap-5 relative z-10">
        <div className="relative group w-full flex justify-center">
          <img
            src={imageSrc}
            alt={meta.name}
            className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/5"
          />

          <div
            className={`absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex items-center gap-2 px-3 py-2 rounded-full border border-sky-400/25 bg-black/55 backdrop-blur-md shadow-lg shadow-sky-500/10 transition-all duration-500 ${
              viewsReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/15 text-sm">👁</span>
            <div className="flex flex-col leading-none pr-0.5">
              <span className="text-[13px] font-mono font-bold text-sky-200 tabular-nums">{formatViews(views)}</span>
              <span className="text-[8px] font-mono text-sky-400/70 uppercase tracking-wider">
                {views === 1 ? 'View' : 'Views'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-[9px] font-mono text-slate-600">
          <span className="truncate max-w-[240px]">{meta.name}</span>
          {meta.width && meta.height && (
            <>
              <span className="text-slate-700">·</span>
              <span>{meta.width}×{meta.height}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}