/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGrid, Upload } from 'lucide-react';
import { pollImageMeta } from '../../lib/imageHosting';
import { ImageHostingStatsBar } from '../image/ImageHostingStatsBar';
import { MyImageGallery } from '../image/MyImageGallery';
import {
  ALLOWED_MIME,
  MAX_IMAGE_BYTES,
  buildBbcode,
  buildHtml,
  buildMarkdown,
  buildViewUrl,
  formatImageBytes,
  uploadHostedImage,
  validateImageFileAsync,
  type HostedImageMeta,
} from '../../lib/imageHosting';
import { safeHostedImageUrl, safeHostedViewUrl } from '../../lib/safeHostedImageUrl';
import { useAuth } from '../../context/AuthContext';
import { ActionButton, PageShell } from './PageShell';

type Phase = 'idle' | 'uploading' | 'success' | 'error';
type HostTab = 'upload' | 'gallery';

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
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
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">{label}</span>
        <button type="button" onClick={copy}
          className="text-[9px] font-mono px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className={`text-[10px] text-slate-300 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 break-all leading-relaxed ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}

export function ImageHostingPage() {
  const { isLoggedIn, syncAchievements, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hostTab, setHostTab] = useState<HostTab>('upload');
  const [galleryRefresh, setGalleryRefresh] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<HostedImageMeta | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [liveViews, setLiveViews] = useState(0);

  useEffect(() => {
    if (!result?.id) return;
    return pollImageMeta(result.id, (m) => setLiveViews(m.views ?? 0), 3000);
  }, [result?.id]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress(0);
    setError('');
    setResult(null);
    setPendingFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }, [preview]);

  const startUpload = useCallback(async (file: File) => {
    const validation = await validateImageFileAsync(file);
    if (validation) {
      setError(validation);
      setPhase('error');
      return;
    }

    setError('');
    setPhase('uploading');
    setProgress(0);
    setPendingFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));

    try {
      const meta = await uploadHostedImage(file, setProgress);
      setResult(meta);
      setPhase('success');
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setGalleryRefresh((k) => k + 1);
      if (isLoggedIn) {
        syncAchievements().catch(() => {});
        refresh().catch(() => {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      const friendly = msg.includes('Server unreachable')
        ? 'Image host API offline — run npm run dev or npm run start'
        : msg;
      setError(friendly);
      setPhase('error');
    }
  }, [preview, isLoggedIn, syncAchievements, refresh]);

  const onFiles = useCallback((files: FileList | File[] | null) => {
    const file = files?.[0];
    if (file) startUpload(file);
  }, [startUpload]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (hostTab !== 'upload' || phase !== 'idle') return;
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((i) => i.type.startsWith('image/'))
        ?.getAsFile();
      if (file) onFiles([file]);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFiles, hostTab, phase]);

  const viewUrl = result ? (safeHostedViewUrl(result.viewUrl, result.id) ?? buildViewUrl(result.id)) : '';
  const directUrl = result ? (safeHostedImageUrl(result.url, result.id) ?? '') : '';

  const openGalleryImage = (img: HostedImageMeta) => {
    setResult(img);
    setPhase('success');
    setHostTab('upload');
    setLiveViews(img.views ?? 0);
  };

  return (
    <PageShell
      id="imagehost-module"
      pageId="imagehost"
      icon="☁️"
      title="Image Hosting"
      subtitle="Upload · personal gallery · stats · tags · bulk tools"
      accentClass="text-sky-400"
    >
      <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
        <ImageHostingStatsBar />

        <div className="flex gap-1 p-1 rounded-xl border border-slate-800 bg-black/30 w-fit">
          <TabBtn active={hostTab === 'upload'} onClick={() => setHostTab('upload')} icon={<Upload size={12} />} label="Upload" />
          <TabBtn
            active={hostTab === 'gallery'}
            onClick={() => setHostTab('gallery')}
            icon={<LayoutGrid size={12} />}
            label="My gallery"
          />
        </div>

        {hostTab === 'gallery' && (
          <MyImageGallery
            refreshKey={galleryRefresh}
            onSelectImage={openGalleryImage}
          />
        )}

        {hostTab === 'upload' && (
          <>
            <div className="flex flex-wrap gap-2 text-[9px] font-mono text-slate-600">
              <span className="px-2 py-1 rounded-full border border-slate-800">Max {(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB</span>
              <span className="px-2 py-1 rounded-full border border-slate-800">JPG · PNG · GIF · WebP · AVIF · BMP · SVG</span>
              {isLoggedIn && (
                <span className="px-2 py-1 rounded-full border border-sky-500/25 bg-sky-500/5 text-sky-400/80">
                  Logged in — uploads go to your gallery
                </span>
              )}
            </div>

            {phase !== 'success' && (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                onClick={() => phase === 'idle' && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onFiles(e.dataTransfer.files);
                }}
                className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer min-h-[220px] flex flex-col items-center justify-center gap-3 p-8 ${
                  dragOver
                    ? 'border-sky-400/70 bg-sky-500/10 scale-[1.01]'
                    : phase === 'uploading'
                      ? 'border-sky-500/30 bg-sky-500/5 cursor-default'
                      : 'border-slate-700/80 bg-[#12151c]/80 hover:border-sky-500/40 hover:bg-sky-500/5'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={Array.from(ALLOWED_MIME).join(',')}
                  className="hidden"
                  onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
                />

                {phase === 'uploading' ? (
                  <>
                    {preview && (
                      <img src={preview} alt="" className="max-h-32 max-w-full rounded-lg object-contain opacity-80" />
                    )}
                    <p className="text-[11px] font-mono text-sky-300">Uploading… {progress}%</p>
                    <div className="w-full max-w-xs h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300 rounded-full"
                        style={{ width: `${progress}%` }} />
                    </div>
                    {pendingFile && (
                      <p className="text-[9px] font-mono text-slate-500">{pendingFile.name} · {formatImageBytes(pendingFile.size)}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-3xl">
                      📤
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-mono text-slate-200 font-medium">Drop image here</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-1">or click · Ctrl+V to paste</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {phase === 'error' && error && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-[10px] font-mono text-red-300 flex justify-between items-start gap-3">
                <span>{error}</span>
                <button type="button" onClick={reset} className="text-slate-400 hover:text-white shrink-0">↺</button>
              </div>
            )}

            {phase === 'success' && result && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex items-center gap-3">
                  <span className="text-2xl">✓</span>
                  <div>
                    <p className="text-[12px] font-mono text-emerald-300 font-medium">Upload successful</p>
                    <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                      {result.name} · {formatImageBytes(result.size)}
                      {result.width && result.height ? ` · ${result.width}×${result.height}` : ''}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2 shrink-0">
                    {isLoggedIn && (
                      <button type="button" onClick={() => setHostTab('gallery')}
                        className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-sky-500/30 text-sky-300 hover:bg-sky-500/10">
                        Gallery
                      </button>
                    )}
                    <button type="button" onClick={reset}
                      className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white">
                      + New image
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#12151c] overflow-hidden">
                  <div className="bg-black/50 flex items-center justify-center p-6 min-h-[160px]">
                    {directUrl && <img src={directUrl} alt={result.name} className="max-h-[280px] max-w-full object-contain rounded-lg" />}
                  </div>
                </div>

                <div className="flex items-center gap-3 px-1 py-2 rounded-xl border border-violet-500/20 bg-violet-500/5">
                  <span className="text-xl">👁️</span>
                  <div>
                    <p className="text-[9px] font-mono text-violet-400/80 uppercase tracking-wide">View-Counter aktiv</p>
                    <p className="text-[13px] font-mono font-bold text-violet-200 tabular-nums">
                      {liveViews.toLocaleString('en-US')} {liveViews === 1 ? 'view' : 'views'} on share URL
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-1">
                  <CopyField label="Page link (for sharing · includes view counter)" value={viewUrl} />
                  <CopyField label="Direct link (for forums & embed)" value={directUrl} />
                  <CopyField label="Markdown" value={buildMarkdown(result.name, directUrl)} />
                  <CopyField label="BBCode" value={buildBbcode(directUrl)} />
                  <CopyField label="HTML" value={buildHtml(directUrl, result.name)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-mono px-4 py-2 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20">
                    Open preview ↗
                  </a>
                  <a href={directUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-mono px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200">
                    Direct image ↗
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function TabBtn({
  active, onClick, icon, label, badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono transition ${
        active
          ? 'bg-sky-500/15 border border-sky-500/30 text-sky-300'
          : 'text-slate-500 hover:text-slate-300 border border-transparent'
      }`}
    >
      {icon}
      {label}
      {badge && <span className="text-[8px] opacity-60">{badge}</span>}
    </button>
  );
}