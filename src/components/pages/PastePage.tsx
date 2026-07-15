/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Download, LayoutGrid, Link2, Lock, PenLine, Sparkles, TrendingUp } from 'lucide-react';
import {
  PASTE_EXPIRY_OPTIONS,
  PASTE_LANGUAGES,
  PASTE_TEMPLATES,
  PASTE_VISIBILITY_OPTIONS,
  type PasteExpiry,
  type PasteVisibility,
} from '../../data/pasteLanguages';
import {
  buildPasteUrl,
  copyToClipboard,
  createPaste,
  downloadPasteText,
  fetchPublicPastes,
  fetchTrendingPastes,
  formatPasteBytes,
  formatPasteDate,
  formatPasteViews,
  pollPasteMeta,
  type PasteMeta,
  type PasteRecord,
} from '../../lib/paste';
import { safePasteAssetUrl, safePastePageUrl } from '../../lib/safePasteUrl';
import { useAuth } from '../../context/AuthContext';
import { MyPasteGallery } from '../paste/MyPasteGallery';
import { PasteCodeView } from '../paste/PasteCodeView';
import { PasteStatsBar } from '../paste/PasteStatsBar';
import { PasteViewCount } from '../paste/PasteViewCount';
import { PasteQrCode } from '../paste/PasteQrCode';
import { PasteVisibilityBadge } from '../paste/PasteVisibilityBadge';
import { ActionButton, PageShell, TerminalInput, TerminalTextarea, ToolCard } from './PageShell';

type PasteTab = 'create' | 'mine' | 'archive';

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="text-[9px] font-mono px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className={`text-[10px] text-slate-300 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 break-all leading-relaxed ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono transition ${
        active
          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
          : 'text-slate-500 hover:text-slate-300 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function PastePage() {
  const { syncAchievements } = useAuth();
  const [tab, setTab] = useState<PasteTab>('create');
  const [archive, setArchive] = useState<PasteMeta[]>([]);
  const [trending, setTrending] = useState<PasteMeta[]>([]);
  const [galleryKey, setGalleryKey] = useState(0);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [visibility, setVisibility] = useState<PasteVisibility>('public');
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState<PasteExpiry>('1w');
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PasteRecord | null>(null);
  const [liveViews, setLiveViews] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPublicPastes(24).then((data) => {
      if (!cancelled) setArchive(data);
    }).catch(() => {});
    fetchTrendingPastes(8).then((data) => {
      if (!cancelled) setTrending(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [galleryKey]);

  useEffect(() => {
    if (!result?.id) return;
    setLiveViews(result.views ?? 0);
    return pollPasteMeta(result.id, (meta) => setLiveViews(meta.views ?? 0), 3000);
  }, [result?.id]);

  const applyFork = useCallback((payload: { title: string; content: string; language: string; visibility: string }) => {
    setTab('create');
    setResult(null);
    setTitle(payload.title);
    setContent(payload.content);
    setLanguage(payload.language);
    const vis = PASTE_VISIBILITY_OPTIONS.find((o) => o.id === payload.visibility)?.id;
    setVisibility(vis ?? 'private');
    setPassword('');
    setError('');
  }, []);

  const applyTemplate = (templateId: string) => {
    const tpl = PASTE_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setTitle(tpl.title);
    setContent(tpl.content);
    setLanguage(tpl.language);
    setError('');
  };

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setLanguage('javascript');
    setVisibility('public');
    setPassword('');
    setExpiry('1w');
    setBurnAfterRead(false);
    setError('');
    setResult(null);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Paste content cannot be empty');
      return;
    }
    if (visibility === 'protected' && !password.trim()) {
      setError('Set a password for password-protected pastes');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const paste = await createPaste({
        title: title.trim() || 'Untitled Paste',
        content,
        language,
        visibility,
        password: visibility === 'protected' ? password : undefined,
        expiry,
        burnAfterRead,
      });
      setResult(paste);
      setGalleryKey((k) => k + 1);
      syncAchievements().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save paste');
    } finally {
      setSaving(false);
    }
  };

  const bytes = new TextEncoder().encode(content).length;
  const viewUrl = result ? (safePastePageUrl(result.viewUrl, result.id) ?? buildPasteUrl(result.id)) : '';
  const rawUrl = result ? safePasteAssetUrl(result.rawUrl) : null;

  return (
    <PageShell
      id="paste-module"
      pageId="paste"
      icon="📋"
      title="Paste"
      subtitle="Public · private (only you) · password protected · expiry · burn-after-read"
      accentClass="text-emerald-400"
    >
      <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
        <PasteStatsBar />

        <div className="flex gap-1 p-1 rounded-xl border border-slate-800 bg-black/30 w-fit">
          <TabBtn active={tab === 'create'} onClick={() => setTab('create')} icon={<PenLine size={12} />} label="New paste" />
          <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')} icon={<LayoutGrid size={12} />} label="My pastes" />
          <TabBtn active={tab === 'archive'} onClick={() => setTab('archive')} icon={<Archive size={12} />} label="Archive" />
        </div>

        {tab === 'create' && !result && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-[9px] font-mono text-slate-600">
              <span className="px-2 py-1 rounded-full border border-slate-800">Max 512 KB</span>
              <span className="px-2 py-1 rounded-full border border-slate-800">20 syntax modes</span>
              <span className="px-2 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/5 text-emerald-400/80">
                Members create · public &amp; protected links work for anyone
              </span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <ToolCard title="Compose" icon="✍️" accent="emerald">
                <div className="space-y-3">
                  <div>
                    <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                      <Sparkles size={10} /> Quick templates
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PASTE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl.id)}
                          className="text-[8px] font-mono px-2 py-1 rounded-lg border border-slate-800 text-slate-500 hover:text-emerald-300 hover:border-emerald-500/30 transition"
                        >
                          {tpl.icon} {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-1">Title</p>
                    <TerminalInput value={title} onChange={setTitle} placeholder="My snippet" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-1">Syntax</p>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full bg-[#0b0c10] border border-slate-800 text-[10px] font-mono rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/60"
                      >
                        {PASTE_LANGUAGES.map((l) => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-1">Expires</p>
                      <select
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value as PasteExpiry)}
                        className="w-full bg-[#0b0c10] border border-slate-800 text-[10px] font-mono rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/60"
                      >
                        {PASTE_EXPIRY_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500">Content</p>
                      <span className="text-[8px] font-mono text-slate-600">{formatPasteBytes(bytes)}</span>
                    </div>
                    <TerminalTextarea
                      value={content}
                      onChange={setContent}
                      placeholder="Paste code or text…"
                      rows={10}
                    />
                  </div>
                </div>
              </ToolCard>

              <ToolCard title="Privacy & Options" icon="🔐" accent="indigo">
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    {PASTE_VISIBILITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setVisibility(opt.id);
                          if (opt.id !== 'protected') setPassword('');
                        }}
                        className={`text-left px-3 py-2 rounded-lg border transition ${
                          visibility === opt.id
                            ? 'border-indigo-500/35 bg-indigo-500/10'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-[10px] font-mono text-slate-200 flex items-center gap-1.5">
                          <span>{opt.icon}</span> {opt.label}
                        </div>
                        <div className="text-[8px] font-mono text-slate-500 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {visibility === 'protected' && (
                    <div>
                      <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                        <Lock size={10} /> View password
                      </p>
                      <TerminalInput value={password} onChange={setPassword} placeholder="Required to unlock paste" />
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={burnAfterRead}
                      onChange={(e) => setBurnAfterRead(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Burn after first read
                  </label>
                </div>
              </ToolCard>
            </div>

            {content.trim() && (
              <ToolCard title="Preview" icon="👁️" accent="cyan">
                <PasteCodeView content={content} language={language} maxHeight="200px" showHeader={false} />
              </ToolCard>
            )}

            {error && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-[10px] font-mono text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="text-[10px] font-mono font-bold border px-3 py-1.5 rounded transition disabled:opacity-40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              >
                {saving ? 'Publishing…' : 'Publish paste'}
              </button>
              <ActionButton onClick={resetForm} variant="indigo">Clear</ActionButton>
            </div>
          </form>
        )}

        {tab === 'create' && result && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex items-center gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="text-[12px] font-mono text-emerald-300 font-medium">Paste published</p>
                <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                  {result.title} · {result.lineCount} lines · {formatPasteBytes(result.size)}
                  {result.visibility === 'protected' ? ' · password protected' : result.visibility === 'private' ? ' · private (only you)' : ' · public'}
                </p>
              </div>
              <div className="ml-auto flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTab('mine')}
                  className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                >
                  My pastes
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[10px] font-mono px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white"
                >
                  + New paste
                </button>
              </div>
            </div>

            {result.content && (
              <div className="rounded-2xl border border-slate-800 bg-[#12151c] overflow-hidden">
                <PasteCodeView content={result.content} language={result.language} maxHeight="320px" views={liveViews} />
              </div>
            )}

            <div className="flex items-center gap-3 px-1 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
              <span className="text-xl">👁️</span>
              <div>
                <p className="text-[9px] font-mono text-indigo-400/80 uppercase tracking-wide">View counter active</p>
                <p className="text-[13px] font-mono font-bold text-indigo-200 tabular-nums">
                  {formatPasteViews(liveViews)} {liveViews === 1 ? 'view' : 'views'} on share URL
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-1">
              <CopyField label="Share link (public · view counter)" value={viewUrl} />
              {rawUrl && <CopyField label="Raw text URL" value={rawUrl} />}
              <PasteQrCode url={viewUrl} label="Scan to open paste" />
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              >
                Open preview ↗
              </a>
              {rawUrl && (
                <a
                  href={rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200"
                >
                  <Link2 size={12} /> Raw text ↗
                </a>
              )}
              {result.content && (
                <button
                  type="button"
                  onClick={() => downloadPasteText(result.title || result.id, result.content!)}
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono px-4 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                >
                  <Download size={12} /> Download .txt
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'mine' && (
          <ToolCard title="My pastes" icon="📁" accent="cyan">
            <MyPasteGallery
              refreshKey={galleryKey}
              onDeleted={() => setGalleryKey((k) => k + 1)}
              onFork={applyFork}
            />
          </ToolCard>
        )}

        {tab === 'archive' && (
          <div className="space-y-4">
            {trending.length > 0 && (
              <ToolCard title="Trending" icon="🔥" accent="amber">
                <p className="text-[9px] font-mono text-slate-500 mb-3 flex items-center gap-1">
                  <TrendingUp size={11} /> Most viewed public pastes right now
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {trending.map((p, i) => (
                    <a
                      key={p.id}
                      href={buildPasteUrl(p.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/15 bg-amber-500/5 hover:border-amber-500/35 transition group"
                    >
                      <span className="text-[11px] font-mono font-bold text-amber-400/80 w-5">#{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold text-slate-200 truncate group-hover:text-amber-200">
                            {p.title}
                          </span>
                          <PasteViewCount views={p.views ?? 0} />
                        </div>
                        <div className="text-[8px] font-mono text-slate-500">
                          {p.username ? `@${p.username} · ` : ''}{p.lineCount} lines
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </ToolCard>
            )}

          <ToolCard title="Public archive" icon="🌐" accent="indigo">
            <p className="text-[9px] font-mono text-slate-500 mb-3">
              Recent public pastes — private and password-protected entries are hidden.
            </p>
            {!archive.length ? (
              <p className="text-[10px] font-mono text-slate-600 py-6 text-center">No public pastes yet.</p>
            ) : (
              <div className="space-y-2">
                {archive.map((p) => (
                  <a
                    key={p.id}
                    href={buildPasteUrl(p.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-800 bg-black/30 hover:border-indigo-500/30 transition group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono font-semibold text-slate-200 truncate group-hover:text-indigo-200 transition">
                          {p.title}
                        </span>
                        <PasteViewCount views={p.views ?? 0} />
                        <PasteVisibilityBadge visibility="public" />
                      </div>
                      <div className="text-[8px] font-mono text-slate-500">
                        {p.username ? `@${p.username} · ` : ''}
                        {formatPasteDate(p.createdAt)} · {p.lineCount} lines
                      </div>
                    </div>
                    <Link2 size={12} className="text-slate-600 group-hover:text-indigo-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </ToolCard>
          </div>
        )}
      </div>
    </PageShell>
  );
}