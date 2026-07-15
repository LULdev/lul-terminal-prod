/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  createAdminEmote,
  deleteAdminEmote,
  fetchAdminEmotes,
  readFileAsBase64,
  updateAdminEmote,
  uploadAdminEmoteImage,
  type AdminChatEmote,
} from '../../lib/adminEmotes';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { emoteToken } from '../../lib/chatEmotes';
import { ActionButton, ToolCard } from '../pages/PageShell';
import { safeEmoteUrl } from '../diagnostics/ChatMessageBody';

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
const MAX_MB = 3;

type CreateForm = {
  code: string;
  label: string;
  enabled: boolean;
  file: File | null;
  previewUrl: string | null;
};

const emptyCreate = (): CreateForm => ({
  code: '',
  label: '',
  enabled: true,
  file: null,
  previewUrl: null,
});

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeCodeInput(raw: string) {
  return raw.trim().replace(/^:+|:+$/g, '');
}

export function AdminEmotesPanel() {
  const [emotes, setEmotes] = useState<AdminChatEmote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminChatEmote | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState<CreateForm>(emptyCreate());
  const [createSaving, setCreateSaving] = useState(false);
  const [editCode, setEditCode] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const createFileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const data = await fetchAdminEmotes();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setEmotes(data.emotes);
      if (selected) {
        const hit = data.emotes.find((e) => e.id === selected.id);
        setSelected(hit ?? null);
      }
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [selected, loadGenRef, mountedRef]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    return () => {
      if (create.previewUrl) URL.revokeObjectURL(create.previewUrl);
    };
  }, [create.previewUrl]);

  const filtered = emotes.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return e.code.toLowerCase().includes(q) || e.label.toLowerCase().includes(q);
  });

  const stats = {
    total: emotes.length,
    enabled: emotes.filter((e) => e.enabled).length,
    placeholders: emotes.filter((e) => e.isPlaceholder).length,
  };

  const pickFile = (file: File | undefined | null, mode: 'create' | 'replace') => {
    if (!file) return;
    if (!ACCEPT.split(',').some((t) => file.type === t || (t === 'image/svg+xml' && file.name.endsWith('.svg')))) {
      setError('Only PNG, JPEG, GIF, WebP or SVG allowed');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Image max ${MAX_MB} MB`);
      return;
    }
    setError('');
    if (mode === 'create') {
      if (create.previewUrl) URL.revokeObjectURL(create.previewUrl);
      setCreate((c) => ({
        ...c,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    } else if (selected) {
      void handleReplaceImage(selected.id, file);
    }
  };

  const handleCreate = async () => {
    const code = normalizeCodeInput(create.code);
    const label = create.label.trim();
    if (!code) {
      setError('Emote code is required');
      return;
    }
    if (!label) {
      setError('Label is required');
      return;
    }
    if (!create.file) {
      setError('Upload an image or GIF');
      return;
    }

    setCreateSaving(true);
    setError('');
    try {
      const { mime, data } = await readFileAsBase64(create.file);
      await createAdminEmote({ code, label, mime, data, enabled: create.enabled });
      setSuccess(`Emote :${code}: created`);
      if (create.previewUrl) URL.revokeObjectURL(create.previewUrl);
      setCreate(emptyCreate());
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleReplaceImage = async (id: string, file: File) => {
    setActing(id);
    setError('');
    try {
      const { mime, data } = await readFileAsBase64(file);
      await uploadAdminEmoteImage(id, { mime, data });
      setSuccess('Image updated');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setActing(null);
    }
  };

  const handleSaveMeta = async (emote: AdminChatEmote) => {
    const code = normalizeCodeInput(editCode);
    const label = editLabel.trim();
    if (!code || !label) {
      setError('Code and label are required');
      return;
    }
    setActing(emote.id);
    setError('');
    try {
      await updateAdminEmote(emote.id, { code, label });
      setSuccess('Emote updated');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActing(null);
    }
  };

  const handleToggle = async (emote: AdminChatEmote) => {
    setActing(emote.id);
    setError('');
    try {
      await updateAdminEmote(emote.id, { enabled: !emote.enabled });
      setSuccess(emote.enabled ? 'Emote disabled' : 'Emote enabled');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async (emote: AdminChatEmote) => {
    if (!confirm(`Delete emote :${emote.code}:? This cannot be undone.`)) return;
    setActing(emote.id);
    setError('');
    try {
      await deleteAdminEmote(emote.id);
      if (selected?.id === emote.id) setSelected(null);
      setSuccess('Emote deleted');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActing(null);
    }
  };

  const selectEmote = (emote: AdminChatEmote) => {
    setSelected(emote);
    setEditCode(emote.code);
    setEditLabel(emote.label);
    setError('');
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(emoteToken(code));
      setSuccess(`Copied ${emoteToken(code)}`);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  return (
    <div id="admin-emotes-panel" className="space-y-4">
      <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
        Custom chat emotes — upload GIFs or images, set manual codes like <span className="text-fuchsia-300">:Emote1:</span>,
        and manage what appears in the shoutbox emote menu.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: stats.total, accent: 'text-slate-200' },
          { label: 'Enabled', value: stats.enabled, accent: 'text-emerald-300' },
          { label: 'Placeholders', value: stats.placeholders, accent: 'text-amber-300' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800/80 bg-black/25 px-3 py-2 text-center">
            <div className="text-[7px] font-mono uppercase text-slate-600">{s.label}</div>
            <div className={`text-sm font-mono font-bold ${s.accent}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or label…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:border-fuchsia-500/40 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-fuchsia-300"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <ActionButton
          onClick={() => {
            setCreateOpen((v) => !v);
            setError('');
          }}
          variant="emerald"
        >
          <span className="inline-flex items-center gap-1">
            <Plus size={11} /> New emote
          </span>
        </ActionButton>
      </div>

      {error && (
        <p className="text-[9px] font-mono text-rose-400 rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-[9px] font-mono text-emerald-300 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 flex items-center gap-1.5">
          <Check size={11} />
          {success}
        </p>
      )}

      {createOpen && (
        <ToolCard title="Create emote" icon="✨" accent="violet">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label>
                <span className="text-[8px] font-mono text-slate-500 uppercase">Code *</span>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[10px] font-mono text-fuchsia-400/70">:</span>
                  <input
                    type="text"
                    value={create.code}
                    onChange={(e) => setCreate({ ...create, code: e.target.value })}
                    placeholder="Emote1"
                    maxLength={24}
                    className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 focus:border-fuchsia-500/50 focus:outline-none"
                  />
                  <span className="text-[10px] font-mono text-fuchsia-400/70">:</span>
                </div>
                <p className="text-[7px] font-mono text-slate-600 mt-1">Letters, numbers, underscore — starts with a letter</p>
              </label>

              <label>
                <span className="text-[8px] font-mono text-slate-500 uppercase">Label *</span>
                <input
                  type="text"
                  value={create.label}
                  onChange={(e) => setCreate({ ...create, label: e.target.value })}
                  placeholder="e.g. LUL Wave"
                  maxLength={48}
                  className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 focus:border-fuchsia-500/50 focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={create.enabled}
                  onChange={(e) => setCreate({ ...create, enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-black/40 text-fuchsia-500 focus:ring-fuchsia-500/30"
                />
                <span className="text-[9px] font-mono text-slate-400">Enabled in chat menu</span>
              </label>

              <div className="flex gap-2 pt-1">
                <ActionButton onClick={() => void handleCreate()} variant="emerald" disabled={createSaving}>
                  {createSaving ? 'Uploading…' : 'Create emote'}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    if (create.previewUrl) URL.revokeObjectURL(create.previewUrl);
                    setCreate(emptyCreate());
                    setCreateOpen(false);
                  }}
                  variant="rose"
                >
                  Cancel
                </ActionButton>
              </div>
            </div>

            <div>
              <span className="text-[8px] font-mono text-slate-500 uppercase">Image / GIF *</span>
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files[0], 'create');
                }}
                onClick={() => createFileRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') createFileRef.current?.click(); }}
                className={`mt-1 relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition ${
                  dragOver
                    ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                    : 'border-slate-700/80 bg-black/30 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5'
                }`}
              >
                {create.previewUrl ? (
                  <img src={create.previewUrl} alt="Preview" className="w-20 h-20 object-contain rounded-lg" />
                ) : (
                  <ImagePlus className="text-slate-600" size={28} />
                )}
                <p className="text-[9px] font-mono text-slate-500 text-center">
                  Drop image here or click to browse
                  <br />
                  <span className="text-slate-600">PNG · JPEG · GIF · WebP · SVG · max {MAX_MB} MB</span>
                </p>
                <input
                  ref={createFileRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0], 'create')}
                />
              </div>
            </div>
          </div>
        </ToolCard>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        <ToolCard title="Emote library" icon="😀" accent="violet">
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filtered.map((emote) => {
              const isSel = selected?.id === emote.id;
              const busy = acting === emote.id;
              return (
                <button
                  key={emote.id}
                  type="button"
                  onClick={() => selectEmote(emote)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition ${
                    isSel
                      ? 'border-fuchsia-500/40 bg-fuchsia-500/10'
                      : 'border-slate-800/60 bg-black/20 hover:border-slate-700'
                  } ${busy ? 'opacity-60' : ''}`}
                >
                  <span className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-black/40 border border-slate-800/80">
                    <img src={safeEmoteUrl(emote.url) ?? ''} alt={emote.label} className="w-full h-full object-contain" loading="lazy" />
                    {emote.isPlaceholder && (
                      <span className="absolute bottom-0 inset-x-0 text-[5px] font-mono text-center bg-black/75 text-amber-300 py-px">
                        placeholder
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono text-fuchsia-200 truncate">:{emote.code}:</div>
                    <div className="text-[8px] font-mono text-slate-500 truncate">{emote.label}</div>
                  </div>
                  <span className={`shrink-0 w-2 h-2 rounded-full ${emote.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} title={emote.enabled ? 'Enabled' : 'Disabled'} />
                </button>
              );
            })}
            {!filtered.length && !loading && (
              <p className="text-[9px] font-mono text-slate-600 text-center py-8">No emotes found</p>
            )}
          </div>
        </ToolCard>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="rounded-2xl border border-slate-800/80 bg-black/30 p-4 space-y-4 h-full">
              <div className="flex items-start gap-4">
                <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-black/50 border border-slate-800">
                  <img src={safeEmoteUrl(selected.url) ?? ''} alt={selected.label} className="w-full h-full object-contain" />
                  {selected.isPlaceholder && (
                    <span className="absolute bottom-0 inset-x-0 text-[7px] font-mono text-center bg-black/80 text-amber-300 py-0.5">
                      Placeholder — upload to replace
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-mono font-bold text-fuchsia-200">{emoteToken(selected.code)}</span>
                    <button
                      type="button"
                      onClick={() => void copyCode(selected.code)}
                      className="p-1 rounded border border-slate-700 text-slate-500 hover:text-fuchsia-300"
                      title="Copy code"
                    >
                      <Copy size={11} />
                    </button>
                    <span className={`text-[7px] font-mono px-2 py-0.5 rounded-full border ${
                      selected.enabled
                        ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                        : 'border-slate-700 text-slate-500 bg-black/40'
                    }`}>
                      {selected.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[8px] font-mono text-slate-600">
                    Updated {formatTime(selected.updatedAt)} · {selected.mime}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Code</span>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-[10px] font-mono text-fuchsia-400/60">:</span>
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      maxLength={24}
                      className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-200 focus:border-fuchsia-500/50 focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-fuchsia-400/60">:</span>
                  </div>
                </label>
                <label>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Label</span>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    maxLength={48}
                    className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-200 focus:border-fuchsia-500/50 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton
                  onClick={() => void handleSaveMeta(selected)}
                  variant="indigo"
                  disabled={acting === selected.id}
                >
                  <span className="inline-flex items-center gap-1"><Pencil size={10} /> Save</span>
                </ActionButton>
                <ActionButton
                  onClick={() => replaceFileRef.current?.click()}
                  variant="cyan"
                  disabled={acting === selected.id}
                >
                  <span className="inline-flex items-center gap-1"><Upload size={10} /> Replace image</span>
                </ActionButton>
                <ActionButton
                  onClick={() => void handleToggle(selected)}
                  variant="amber"
                  disabled={acting === selected.id}
                >
                  <span className="inline-flex items-center gap-1">
                    {selected.enabled ? <EyeOff size={10} /> : <Eye size={10} />}
                    {selected.enabled ? 'Disable' : 'Enable'}
                  </span>
                </ActionButton>
                <ActionButton
                  onClick={() => void handleDelete(selected)}
                  variant="rose"
                  disabled={acting === selected.id}
                >
                  <span className="inline-flex items-center gap-1"><Trash2 size={10} /> Delete</span>
                </ActionButton>
                <input
                  ref={replaceFileRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0], 'replace');
                    e.target.value = '';
                  }}
                />
              </div>

              <p className="text-[8px] font-mono text-slate-600 leading-relaxed border-t border-slate-800/60 pt-3">
                Users can type <span className="text-fuchsia-300">{emoteToken(selected.code)}</span> manually in chat
                or pick it from the emote menu. Codes are case-sensitive.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800/80 bg-black/20 p-8 text-center h-full flex flex-col items-center justify-center">
              <span className="text-3xl mb-2">😀</span>
              <p className="text-[10px] font-mono text-slate-500">Select an emote to edit or upload a replacement image</p>
            </div>
          )}
        </div>

        <ToolCard title="How it works" icon="💡" accent="violet">
          <ul className="space-y-2 text-[8px] font-mono text-slate-500 leading-relaxed">
            <li>· Five test placeholders (<span className="text-fuchsia-300/80">:Emote1:</span> … <span className="text-fuchsia-300/80">:Emote5:</span>) ship by default.</li>
            <li>· Upload a GIF or image to replace any placeholder.</li>
            <li>· Set a unique code — members type <span className="text-fuchsia-300/80">:YourCode:</span> in chat.</li>
            <li>· Disabled emotes stay in admin but hide from the menu and code lookup.</li>
            <li>· Built-in unicode smileys were removed from the chat emote picker.</li>
          </ul>
        </ToolCard>
      </div>
    </div>
  );
}