/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MemeEditorSnapshot, MemeFontFamily, MemeImageFilters, MemeTemplate, MemeTextBox } from '../../types/meme';
import { loadMemeDraft, useMemeDraft } from '../../hooks/useMemeDraft';
import {
  COLOR_PRESETS,
  DEFAULT_BOXES,
  DEFAULT_FILTERS,
  MEME_FONTS,
  POSITION_PRESETS,
  QUICK_PHRASES,
  SNAP_LINES,
  TEXT_PRESETS,
  applyPreset,
  memeFontCss,
  snapCoord,
  wrapText,
} from '../../utils/memeEditorConfig';
import { decodeMemeName, memeMediaUrl } from '../../utils/memeMedia';
import { notifyMemeCreated } from '../../lib/chatActivity';
import { uploadHostedImage } from '../../lib/imageHosting';
import { useAuth } from '../../context/AuthContext';
import { ActionButton } from '../pages/PageShell';
import { MemeCollapsible } from './MemeCollapsible';

type Props = {
  template: MemeTemplate;
  onBack: () => void;
  onMemeCreated?: () => void;
};

type PanelTab = 'text' | 'style' | 'image';

const MAX_HISTORY = 40;

function cloneSnapshot(s: MemeEditorSnapshot): MemeEditorSnapshot {
  return { boxes: s.boxes.map((b) => ({ ...b })), filters: { ...s.filters } };
}

function drawTextOnCanvas(ctx: CanvasRenderingContext2D, box: MemeTextBox, w: number, h: number) {
  if (!box.text.trim()) return;
  const x = (box.x / 100) * w;
  const y = (box.y / 100) * h;
  const size = box.fontSize * (w / 500);
  const displayText = box.uppercase ? box.text.toUpperCase() : box.text;
  ctx.font = `bold ${size}px ${memeFontCss(box.fontFamily)}`;
  ctx.textAlign = box.align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = box.strokeWidth * (w / 500);
  ctx.strokeStyle = box.strokeColor;
  ctx.fillStyle = box.color;
  const maxWidthPx = (box.maxWidth / 100) * w;
  const lines: string[] = [];
  for (const raw of displayText.split('\n')) {
    lines.push(...wrapText(ctx, raw, maxWidthPx));
  }
  const lineH = size * 1.15;
  const startY = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => {
    ctx.strokeText(line, x, startY + i * lineH);
    ctx.fillText(line, x, startY + i * lineH);
  });
}

function boxLabel(id: string, index: number) {
  if (id === 'top') return 'Top';
  if (id === 'bottom') return 'Bottom';
  return `Text ${index + 1}`;
}

export function MemeEditor({ template, onBack, onMemeCreated }: Props) {
  const { isLoggedIn } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const filterDragRef = useRef<MemeImageFilters | null>(null);

  const [boxes, setBoxes] = useState<MemeTextBox[]>(DEFAULT_BOXES);
  const [filters, setFilters] = useState<MemeImageFilters>(DEFAULT_FILTERS);
  const [activeBox, setActiveBox] = useState('top');
  const [panelTab, setPanelTab] = useState<PanelTab>('text');
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState<MemeEditorSnapshot[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSnap, setShowSnap] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [draftBanner, setDraftBanner] = useState<MemeEditorSnapshot | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const gifRef = useRef<HTMLImageElement | null>(null);

  const active = boxes.find((b) => b.id === activeBox) ?? boxes[0];
  const snapshot: MemeEditorSnapshot = { boxes, filters };

  useMemeDraft(template.id, snapshot, mediaLoaded && !draftBanner);

  const flash = (msg: string, ms = 2000) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };

  const pushHistory = useCallback((snap: MemeEditorSnapshot) => {
    const cloned = cloneSnapshot(snap);
    setHistoryIdx((idx) => {
      setHistory((prev) => [...prev.slice(0, idx + 1), cloned].slice(-MAX_HISTORY));
      return Math.min(idx + 1, MAX_HISTORY - 1);
    });
  }, []);

  const applySnapshot = useCallback((snap: MemeEditorSnapshot) => {
    setBoxes(snap.boxes.map((b) => ({ ...b })));
    setFilters({ ...snap.filters });
  }, []);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const nextIdx = historyIdx - 1;
    setHistoryIdx(nextIdx);
    applySnapshot(history[nextIdx]);
  }, [history, historyIdx, applySnapshot]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const nextIdx = historyIdx + 1;
    setHistoryIdx(nextIdx);
    applySnapshot(history[nextIdx]);
  }, [history, historyIdx, applySnapshot]);

  const commitState = useCallback(() => {
    pushHistory({ boxes, filters });
  }, [boxes, filters, pushHistory]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = template.type === 'gif' ? gifRef.current : imgRef.current;
    if (!canvas || !img || !mediaLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = img.naturalWidth || 500;
    const h = img.naturalHeight || 500;
    canvas.width = w;
    canvas.height = h;
    ctx.save();
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
    if (filters.flipH || filters.flipV) {
      ctx.translate(filters.flipH ? w : 0, filters.flipV ? h : 0);
      ctx.scale(filters.flipH ? -1 : 1, filters.flipV ? -1 : 1);
    }
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    for (const box of boxes) drawTextOnCanvas(ctx, box, w, h);
  }, [boxes, filters, mediaLoaded, template.type]);

  useEffect(() => {
    setMediaLoaded(false);
    setMediaError(false);
    setDraftBanner(null);
    setInlineEditId(null);
    setPreviewZoom(100);
    setFullscreen(false);

    const saved = loadMemeDraft(template.id);
    const initial = { boxes: DEFAULT_BOXES(), filters: DEFAULT_FILTERS() };
    setBoxes(initial.boxes);
    setFilters(initial.filters);
    setHistory([cloneSnapshot(initial)]);
    setHistoryIdx(0);
    setActiveBox(initial.boxes[0]?.id ?? 'top');
    if (saved) setDraftBanner(saved);

    const mediaSrc = memeMediaUrl(template.mediaUrl);
    const previewSrc = memeMediaUrl(template.previewUrl);
    const loadImg = (src: string, onOk: (img: HTMLImageElement) => void, onFail?: () => void) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => onOk(img);
      img.onerror = () => onFail?.();
      img.src = src;
    };

    if (template.type === 'gif') {
      loadImg(mediaSrc, (gif) => { gifRef.current = gif; setMediaLoaded(true); }, () => setMediaError(true));
    } else {
      loadImg(mediaSrc, (img) => { imgRef.current = img; setMediaLoaded(true); }, () => {
        loadImg(previewSrc, (fb) => { imgRef.current = fb; setMediaLoaded(true); }, () => setMediaError(true));
      });
    }
  }, [template]);

  useEffect(() => {
    drawCanvas();
    if (template.type !== 'gif' || !mediaLoaded) return;
    const t = setInterval(drawCanvas, 120);
    return () => clearInterval(t);
  }, [drawCanvas, mediaLoaded, template.type]);

  useEffect(() => {
    if (panelTab === 'text') textRef.current?.focus();
  }, [activeBox, panelTab]);

  const updateBox = (patch: Partial<MemeTextBox>, commit = true) => {
    setBoxes((prev) => {
      const next = prev.map((b) => (b.id === activeBox ? { ...b, ...patch } : b));
      if (commit) setTimeout(() => pushHistory({ boxes: next, filters }), 0);
      return next;
    });
  };

  const nudgeBox = (dx: number, dy: number) => {
    setBoxes((prev) => {
      const next = prev.map((b) =>
        b.id === activeBox
          ? { ...b, x: Math.min(95, Math.max(5, b.x + dx)), y: Math.min(98, Math.max(2, b.y + dy)) }
          : b,
      );
      setTimeout(() => pushHistory({ boxes: next, filters }), 0);
      return next;
    });
  };

  const updateFiltersLive = (patch: Partial<MemeImageFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const updateFilters = (patch: Partial<MemeImageFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      setTimeout(() => pushHistory({ boxes, filters: next }), 0);
      return next;
    });
  };

  const commitFilters = () => {
    if (filterDragRef.current) {
      pushHistory({ boxes, filters: filterDragRef.current });
      filterDragRef.current = null;
    } else {
      commitState();
    }
  };

  const addTextBox = () => {
    const id = `custom-${Date.now()}`;
    const next = [...boxes, {
      id, text: '', x: 50, y: 50, fontSize: 28, color: '#ffffff', strokeColor: '#000000',
      align: 'center' as const, fontFamily: 'impact' as MemeFontFamily, strokeWidth: 3, uppercase: true, maxWidth: 80,
    }];
    setBoxes(next);
    setActiveBox(id);
    setPanelTab('text');
    pushHistory({ boxes: next, filters });
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const duplicateBox = () => {
    const src = boxes.find((b) => b.id === activeBox);
    if (!src) return;
    const id = `dup-${Date.now()}`;
    const next = [...boxes, { ...src, id, x: Math.min(95, src.x + 5), y: Math.min(95, src.y + 5) }];
    setBoxes(next);
    setActiveBox(id);
    pushHistory({ boxes: next, filters });
  };

  const applyTextPreset = (presetId: string) => {
    const preset = TEXT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const next = applyPreset(preset);
    setBoxes(next);
    setActiveBox(next[0]?.id ?? 'top');
    pushHistory({ boxes: next, filters });
    flash('Layout applied');
  };

  const restoreDraft = () => {
    if (!draftBanner) return;
    applySnapshot(draftBanner);
    setHistory([cloneSnapshot(draftBanner)]);
    setHistoryIdx(0);
    setDraftBanner(null);
    flash('Draft loaded');
  };

  const resetAll = () => {
    const initial = { boxes: DEFAULT_BOXES(), filters: DEFAULT_FILTERS() };
    applySnapshot(initial);
    setActiveBox('top');
    pushHistory(initial);
    flash('Reset');
  };

  const getPngBlob = useCallback(async (): Promise<Blob | null> => {
    drawCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
  }, [drawCanvas]);

  const announcedTemplateRef = useRef<string | null>(null);

  const announceMemeExport = useCallback(async () => {
    if (announcedTemplateRef.current === template.id) return;
    onMemeCreated?.();
    if (!isLoggedIn) return;
    try {
      const blob = await getPngBlob();
      if (!blob) return;
      const safeName = template.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'meme';
      const file = new File([blob], `${safeName}.png`, { type: 'image/png' });
      const meta = await uploadHostedImage(file, () => {}, { source: 'meme' });
      await notifyMemeCreated({
        memeName: decodeMemeName(template.name),
        memeImageId: meta.id,
        templateId: template.id,
      });
      announcedTemplateRef.current = template.id;
    } catch {
      /* shoutbox announce is best-effort */
    }
  }, [getPngBlob, isLoggedIn, onMemeCreated, template.id, template.name]);

  useEffect(() => {
    announcedTemplateRef.current = null;
  }, [template.id]);

  const downloadPng = useCallback(async () => {
    const blob = await getPngBlob();
    if (!blob) return;
    const a = document.createElement('a');
    a.download = `${template.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    await announceMemeExport();
    flash('PNG saved');
  }, [announceMemeExport, getPngBlob, template.name]);

  const copyToClipboard = async () => {
    try {
      const blob = await getPngBlob();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      await announceMemeExport();
      flash('Copied to clipboard');
    } catch {
      flash('Clipboard blocked', 2500);
    }
  };

  useEffect(() => {
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreen) { setFullscreen(false); return; }
        if (inlineEditId) { setInlineEditId(null); return; }
        onBack();
        return;
      }
      if (typing(e.target)) {
        if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          const idx = boxes.findIndex((b) => b.id === activeBox);
          setActiveBox(boxes[(idx + 1) % boxes.length].id);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); downloadPng(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addTextBox(); return; }
      const step = e.shiftKey ? 5 : 1;
      if (e.key === 'ArrowUp') { e.preventDefault(); nudgeBox(0, -step); }
      if (e.key === 'ArrowDown') { e.preventDefault(); nudgeBox(0, step); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeBox(-step, 0); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudgeBox(step, 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, inlineEditId, boxes, activeBox, undo, redo, onBack, downloadPng]);

  const handleDragStart = (boxId: string, e: React.PointerEvent) => {
    if (inlineEditId) return;
    const box = boxes.find((b) => b.id === boxId);
    if (!box || !previewRef.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: boxId, startX: e.clientX, startY: e.clientY, origX: box.x, origY: box.y };
    setActiveBox(boxId);
    setShowSnap(true);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;
    const rawX = Math.min(95, Math.max(5, drag.origX + dx));
    const rawY = Math.min(98, Math.max(2, drag.origY + dy));
    setBoxes((prev) =>
      prev.map((b) => (b.id === drag.id ? { ...b, x: snapCoord(rawX), y: snapCoord(rawY) } : b)),
    );
  };

  const handleDragEnd = () => {
    if (dragRef.current) {
      dragRef.current = null;
      setShowSnap(false);
      commitState();
    }
  };

  const cssFilter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
  const cssFlip = [filters.flipH && 'scaleX(-1)', filters.flipV && 'scaleY(-1)'].filter(Boolean).join(' ') || undefined;

  const previewContent = (
    <>
      {mediaError ? (
        <p className="text-[10px] text-red-400 font-mono p-4">Could not load image.</p>
      ) : (
        <>
          <img
            src={memeMediaUrl(template.mediaUrl)}
            alt={template.name}
            className="max-w-full object-contain pointer-events-none transition-transform duration-150"
            style={{
              filter: cssFilter,
              transform: `${cssFlip ?? ''} scale(${previewZoom / 100})`.trim(),
              maxHeight: fullscreen ? '85vh' : `${Math.round(340 * previewZoom / 100)}px`,
            }}
            crossOrigin="anonymous"
            onLoad={() => template.type !== 'gif' && setMediaLoaded(true)}
            onError={() => setMediaError(true)}
          />
          {showSnap && SNAP_LINES.map((pct) => (
            <React.Fragment key={pct}>
              <div className="absolute top-0 bottom-0 w-px bg-cyan-400/30 pointer-events-none" style={{ left: `${pct}%` }} />
              <div className="absolute left-0 right-0 h-px bg-cyan-400/30 pointer-events-none" style={{ top: `${pct}%` }} />
            </React.Fragment>
          ))}
          <div className="absolute inset-0">
            {boxes.map((box) => {
              const display = box.uppercase ? box.text.toUpperCase() : box.text;
              const isActive = activeBox === box.id;
              if (inlineEditId === box.id) {
                return (
                  <textarea
                    key={box.id}
                    autoFocus
                    value={box.text}
                    onChange={(e) => updateBox({ text: e.target.value }, false)}
                    onBlur={() => { setInlineEditId(null); commitState(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setInlineEditId(null); commitState(); } }}
                    className="absolute bg-black/70 border border-amber-400/60 rounded px-1 py-0.5 text-white font-bold resize-none outline-none"
                    style={{
                      top: `${box.y}%`, left: `${box.x}%`, transform: 'translate(-50%, -50%)',
                      maxWidth: `${box.maxWidth}%`, fontFamily: memeFontCss(box.fontFamily),
                      fontSize: `${box.fontSize * 0.45}px`, textAlign: box.align,
                    }}
                    rows={2}
                  />
                );
              }
              return (
                <div
                  key={box.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => handleDragStart(box.id, e)}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerCancel={handleDragEnd}
                  onDoubleClick={(e) => { e.stopPropagation(); setActiveBox(box.id); setInlineEditId(box.id); }}
                  className={`absolute cursor-grab active:cursor-grabbing select-none touch-none px-1 rounded transition-shadow ${
                    isActive ? 'ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/10' : 'hover:ring-1 hover:ring-white/20'
                  }`}
                  style={{
                    top: `${box.y}%`,
                    left: box.align === 'center' ? `${box.x}%` : box.align === 'left' ? `${box.x}%` : 'auto',
                    right: box.align === 'right' ? `${100 - box.x}%` : 'auto',
                    transform: box.align === 'center' ? 'translate(-50%, -50%)' : 'translateY(-50%)',
                    maxWidth: `${box.maxWidth}%`, textAlign: box.align,
                    fontFamily: memeFontCss(box.fontFamily), fontSize: `${box.fontSize * 0.45}px`,
                    color: box.color, WebkitTextStroke: `${Math.max(1, box.strokeWidth * 0.15)}px ${box.strokeColor}`,
                    textShadow: `2px 2px 0 ${box.strokeColor}`, fontWeight: 'bold', lineHeight: 1.1,
                    whiteSpace: 'pre-wrap', pointerEvents: 'auto',
                  }}
                >
                  {display || (isActive ? 'Enter text…' : '')}
                </div>
              );
            })}
          </div>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </>
  );

  const sidebar = (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex rounded-lg border border-slate-800 overflow-hidden shrink-0">
        {([
          ['text', '✏️ Text'],
          ['style', '🎨 Stil'],
          ['image', '🖼 Image'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanelTab(id)}
            className={`flex-1 py-2 text-[9px] font-mono transition ${
              panelTab === id ? 'bg-rose-500/15 text-rose-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1 pr-0.5 text-[10px] font-mono flex flex-col gap-2">
        {panelTab === 'text' && (
          <>
            <MemeCollapsible title="Layout presets" icon="📐" defaultOpen>
              <div className="flex flex-wrap gap-1">
                {TEXT_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => applyTextPreset(p.id)}
                    className="px-2 py-1.5 rounded border border-slate-800 text-[8px] text-slate-400 hover:border-rose-500/40 hover:text-rose-300 min-h-[28px]">
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </MemeCollapsible>

            <div className="flex flex-wrap gap-1">
              {boxes.map((b, i) => (
                <button key={b.id} type="button" onClick={() => setActiveBox(b.id)}
                  className={`px-2.5 py-1.5 rounded border text-[9px] min-h-[30px] ${
                    activeBox === b.id ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}>
                  {boxLabel(b.id, i)}
                </button>
              ))}
              <button type="button" onClick={addTextBox}
                className="px-2.5 py-1.5 rounded border border-dashed border-slate-700 text-slate-500 hover:text-emerald-300 min-h-[30px]">
                + New
              </button>
            </div>

            <label className="text-slate-500">Text <span className="text-slate-700">(double-click on image)</span></label>
            <textarea
              ref={textRef}
              value={active.text}
              onChange={(e) => updateBox({ text: e.target.value }, false)}
              onBlur={commitState}
              placeholder="Enter meme text…"
              rows={4}
              className="bg-[#0b0c10] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 resize-y text-[11px] leading-relaxed focus:border-rose-500/50 focus:outline-none"
            />

            <MemeCollapsible title="Quick phrases" icon="💬" defaultOpen={false}>
              <div className="flex flex-wrap gap-1">
                {QUICK_PHRASES.map((phrase) => (
                  <button key={phrase} type="button"
                    onClick={() => updateBox({ text: active.text ? `${active.text}\n${phrase}` : phrase })}
                    className="px-2 py-1 rounded-full border border-slate-800/80 text-[8px] text-slate-500 hover:text-cyan-300 hover:border-cyan-500/30">
                    {phrase}
                  </button>
                ))}
              </div>
            </MemeCollapsible>

            <div className="flex gap-1 flex-wrap">
              <ActionButton onClick={duplicateBox} variant="cyan">Duplicate</ActionButton>
              {boxes.length > 1 && (
                <ActionButton onClick={() => {
                  const next = boxes.filter((b) => b.id !== activeBox);
                  setBoxes(next); setActiveBox(next[0]?.id ?? 'top'); pushHistory({ boxes: next, filters });
                }} variant="rose">Delete</ActionButton>
              )}
            </div>
          </>
        )}

        {panelTab === 'style' && (
          <>
            <label className="text-slate-500">Font</label>
            <select value={active.fontFamily} onChange={(e) => updateBox({ fontFamily: e.target.value as MemeFontFamily })}
              className="bg-[#0b0c10] border border-slate-800 rounded-lg px-2 py-2 text-slate-200 w-full">
              {MEME_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>

            <label className="text-slate-500">Size · {active.fontSize}px</label>
            <input type="range" min={12} max={80} value={active.fontSize}
              onChange={(e) => updateBox({ fontSize: parseInt(e.target.value, 10) }, false)}
              onMouseUp={commitState} onTouchEnd={commitState} className="w-full accent-rose-400" />

            <label className="text-slate-500">Width · {active.maxWidth}%</label>
            <input type="range" min={30} max={100} value={active.maxWidth}
              onChange={(e) => updateBox({ maxWidth: parseInt(e.target.value, 10) }, false)}
              onMouseUp={commitState} onTouchEnd={commitState} className="w-full accent-rose-400" />

            <label className="text-slate-500">Position</label>
            <div className="flex flex-wrap gap-1">
              {POSITION_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => updateBox({ x: p.x, y: p.y })}
                  className="px-2 py-1 rounded border border-slate-800 text-[8px] text-slate-500 hover:text-amber-300">
                  {p.label}
                </button>
              ))}
            </div>
            <label className="text-slate-500">Fine-tune · arrow keys {`(Shift = 5%)`}</label>
            <input type="range" min={2} max={98} value={active.y}
              onChange={(e) => updateBox({ y: parseInt(e.target.value, 10) }, false)}
              onMouseUp={commitState} onTouchEnd={commitState} className="w-full accent-rose-400" />
            <input type="range" min={5} max={95} value={active.x}
              onChange={(e) => updateBox({ x: parseInt(e.target.value, 10) }, false)}
              onMouseUp={commitState} onTouchEnd={commitState} className="w-full accent-rose-400" />

            <label className="text-slate-500">Stroke · {active.strokeWidth}px</label>
            <input type="range" min={0} max={12} value={active.strokeWidth}
              onChange={(e) => updateBox({ strokeWidth: parseInt(e.target.value, 10) }, false)}
              onMouseUp={commitState} onTouchEnd={commitState} className="w-full accent-rose-400" />

            <label className="text-slate-500">Colors</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {COLOR_PRESETS.map((c) => (
                <button key={c.label} type="button" title={c.label}
                  onClick={() => updateBox({ color: c.fill, strokeColor: c.stroke })}
                  className="w-7 h-7 rounded border border-slate-700 hover:scale-110 transition"
                  style={{ background: c.fill, boxShadow: `inset 0 0 0 2px ${c.stroke}` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="color" value={active.color} onChange={(e) => updateBox({ color: e.target.value })} className="w-full h-9 bg-transparent rounded cursor-pointer" title="Fill color" />
              <input type="color" value={active.strokeColor} onChange={(e) => updateBox({ strokeColor: e.target.value })} className="w-full h-9 bg-transparent rounded cursor-pointer" title="Stroke color" />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-slate-500">UPPERCASE</label>
              <button type="button" onClick={() => updateBox({ uppercase: !active.uppercase })}
                className={`px-3 py-1 rounded border text-[9px] ${active.uppercase ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-slate-800 text-slate-500'}`}>
                {active.uppercase ? 'ON' : 'OFF'}
              </button>
            </div>

            <label className="text-slate-500">Alignment</label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} type="button" onClick={() => updateBox({ align: a })}
                  className={`flex-1 py-2 rounded border text-[9px] ${active.align === a ? 'border-cyan-500/50 text-cyan-300 bg-cyan-500/10' : 'border-slate-800 text-slate-500'}`}>
                  {a === 'left' ? '◧' : a === 'center' ? '◫' : '◨'}
                </button>
              ))}
            </div>
          </>
        )}

        {panelTab === 'image' && (
          <MemeCollapsible title="Image adjustments" icon="🎛" defaultOpen>
            <div className="flex gap-1">
              <button type="button" onClick={() => updateFilters({ flipH: !filters.flipH })}
                className={`flex-1 py-2 rounded border text-[9px] ${filters.flipH ? 'border-violet-500/50 text-violet-300 bg-violet-500/10' : 'border-slate-800 text-slate-500'}`}>
                ↔ Mirror
              </button>
              <button type="button" onClick={() => updateFilters({ flipV: !filters.flipV })}
                className={`flex-1 py-2 rounded border text-[9px] ${filters.flipV ? 'border-violet-500/50 text-violet-300 bg-violet-500/10' : 'border-slate-800 text-slate-500'}`}>
                ↕ Mirror
              </button>
            </div>
            <button type="button" onClick={() => { const f = DEFAULT_FILTERS(); setFilters(f); pushHistory({ boxes, filters: f }); }}
              className="w-full py-1.5 rounded border border-slate-800 text-[8px] text-slate-500 hover:text-slate-300">
              Reset filters
            </button>
            {(['brightness', 'contrast', 'saturate'] as const).map((key) => (
              <div key={key}>
                <label className="text-slate-500 capitalize">{key === 'brightness' ? 'Brightness' : key === 'contrast' ? 'Contrast' : 'Saturation'} · {filters[key]}%</label>
                <input type="range" min={key === 'saturate' ? 0 : 40} max={key === 'saturate' ? 200 : 160} value={filters[key]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    filterDragRef.current = { ...filters, [key]: val };
                    updateFiltersLive({ [key]: val });
                  }}
                  onMouseUp={commitFilters} onTouchEnd={commitFilters}
                  className="w-full accent-violet-400" />
              </div>
            ))}
          </MemeCollapsible>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 min-h-0 h-full">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-[#0b0c10]/95 backdrop-blur border border-slate-800/80 rounded-lg p-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ActionButton onClick={onBack} variant="indigo">← Gallery</ActionButton>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono text-amber-300 font-bold truncate">{decodeMemeName(template.name)}</p>
            <p className="text-[7px] text-slate-600 font-mono">Esc · back · Ctrl+S · save · Tab · next box</p>
          </div>
          {toast && <span className="text-[9px] text-emerald-400 font-mono animate-pulse">{toast}</span>}
          <ActionButton onClick={undo} variant="indigo" disabled={historyIdx <= 0}>↶</ActionButton>
          <ActionButton onClick={redo} variant="indigo" disabled={historyIdx >= history.length - 1}>↷</ActionButton>
          <ActionButton onClick={resetAll} variant="amber">Reset</ActionButton>
          <ActionButton onClick={copyToClipboard} variant="emerald" disabled={!mediaLoaded}>Copy</ActionButton>
          <ActionButton onClick={downloadPng} variant="cyan" disabled={!mediaLoaded}>⬇ PNG</ActionButton>
        </div>
      </div>

      {draftBanner && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[10px] font-mono shrink-0">
          <span className="text-amber-200">Saved draft found</span>
          <div className="flex gap-2">
            <button type="button" onClick={restoreDraft} className="text-emerald-300 hover:underline">Restore</button>
            <button type="button" onClick={() => {
              const initial = { boxes: DEFAULT_BOXES(), filters: DEFAULT_FILTERS() };
              setBoxes(initial.boxes); setFilters(initial.filters);
              setHistory([cloneSnapshot(initial)]); setHistoryIdx(0); setDraftBanner(null);
            }} className="text-slate-500 hover:underline">Discard</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3 min-h-0 flex-1">
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[8px] text-slate-600 font-mono">Zoom</label>
            <input type="range" min={60} max={140} value={previewZoom} onChange={(e) => setPreviewZoom(parseInt(e.target.value, 10))}
              className="flex-1 max-w-[120px] accent-slate-500" />
            <span className="text-[8px] text-slate-600 w-8">{previewZoom}%</span>
            <button type="button" onClick={() => setFullscreen(true)}
              className="text-[8px] font-mono px-2 py-1 rounded border border-slate-800 text-slate-500 hover:text-white ml-auto">
              ⛶ Fullscreen
            </button>
          </div>
          <div ref={previewRef}
            className="relative bg-black/50 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[260px] flex-1">
            {previewContent}
            {!mediaError && (
              <p className="absolute bottom-2 left-2 text-[7px] text-slate-600 font-mono pointer-events-none">
                Drag · double-click to edit · snap at 25/50/75%
              </p>
            )}
          </div>
        </div>
        {sidebar}
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4" onClick={() => setFullscreen(false)}>
          <button type="button" onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white text-[11px] font-mono border border-slate-700 px-3 py-1.5 rounded">
            Esc to close
          </button>
          <div className="relative flex items-center justify-center max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            {previewContent}
          </div>
        </div>
      )}
    </div>
  );
}