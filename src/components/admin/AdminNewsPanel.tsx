/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Newspaper, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  createNewsArticle,
  deleteNewsArticle,
  fetchAdminNews,
  formatNewsDate,
  updateNewsArticle,
} from '../../lib/news';
import type { NewsArticle, NewsArticleInput } from '../../types/news';
import { ActionButton, ToolCard } from '../pages/PageShell';

type FormState = NewsArticleInput & { id?: string };

const CATEGORY_PRESETS = [
  'BULLETIN',
  'SYSTEM UPDATE',
  'CRITICAL EMERGENCY BULLETIN',
  'NETWORK SYS ANNOUNCEMENT',
  'COMMUNITY',
];

const ICON_PRESETS = ['📰', '🚨', '🔐', '✨', '📡', '⚠️', '🎉', '🔧'];

const emptyForm = (): FormState => ({
  title: '',
  body: '',
  category: 'BULLETIN',
  icon: '📰',
  highlight: false,
  active: true,
});

export function AdminNewsPanel() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const actionGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setError('');
    try {
      const data = await fetchAdminNews();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setArticles(data.articles);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load news');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const resetForm = () => setForm(emptyForm());

  const save = async () => {
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title) {
      setError('Title is required');
      return;
    }
    if (!body) {
      setError('Article body is required');
      return;
    }

    const gen = ++actionGenRef.current;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = { ...form, title, body };
      if (form.id) {
        await updateNewsArticle(form.id, payload);
        if (gen !== actionGenRef.current || !mountedRef.current) return;
        setSuccess(`"${title}" updated`);
      } else {
        await createNewsArticle(payload);
        if (gen !== actionGenRef.current || !mountedRef.current) return;
        setSuccess(`"${title}" published`);
      }
      resetForm();
      await load();
    } catch (e) {
      if (gen !== actionGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      if (gen === actionGenRef.current && mountedRef.current) setSaving(false);
    }
  };

  const remove = async (a: NewsArticle) => {
    if (!confirm(`Really delete article "${a.title}"?`)) return;
    const gen = ++actionGenRef.current;
    setError('');
    setSuccess('');
    try {
      await deleteNewsArticle(a.id);
      if (gen !== actionGenRef.current || !mountedRef.current) return;
      if (form.id === a.id) resetForm();
      setSuccess('Article deleted');
      await load();
    } catch (e) {
      if (gen !== actionGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const togglePublish = async (a: NewsArticle) => {
    const gen = ++actionGenRef.current;
    setTogglingId(a.id);
    setError('');
    try {
      await updateNewsArticle(a.id, { active: !a.active });
      if (gen !== actionGenRef.current || !mountedRef.current) return;
      await load();
    } catch (e) {
      if (gen !== actionGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      if (gen === actionGenRef.current && mountedRef.current) setTogglingId(null);
    }
  };

  const startEdit = (a: NewsArticle) => {
    setError('');
    setSuccess('');
    setForm({
      id: a.id,
      title: a.title,
      body: a.body,
      category: a.category,
      icon: a.icon,
      highlight: a.highlight,
      active: a.active,
    });
    document.getElementById('admin-news-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isEditing = Boolean(form.id);

  return (
    <div id="admin-news-composer" className="space-y-4">
      <ToolCard title="Write news" icon="✍️" accent="indigo">
        {error && (
          <p className="text-[10px] font-mono text-rose-400 mb-3 rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-[10px] font-mono text-emerald-300 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 flex items-center gap-1.5">
            <Check size={12} />
            {success}
          </p>
        )}

        <p className="text-[9px] font-mono text-slate-500 mb-4 leading-relaxed">
          Create a new bulletin or edit an existing one. Published articles appear immediately in the News tab (LUL Wire).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2">
            <span className="text-[8px] font-mono text-slate-500 uppercase">Title *</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. System maintenance completed"
              className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 focus:border-indigo-500/50 focus:outline-none"
              maxLength={160}
            />
          </label>

          <label>
            <span className="text-[8px] font-mono text-slate-500 uppercase">Category</span>
            <input
              type="text"
              value={form.category ?? ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              list="news-category-presets"
              className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-300 focus:border-indigo-500/50 focus:outline-none"
              maxLength={80}
            />
            <datalist id="news-category-presets">
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label>
            <span className="text-[8px] font-mono text-slate-500 uppercase">Icon</span>
            <div className="mt-1 flex gap-1.5">
              <input
                type="text"
                value={form.icon ?? ''}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-14 bg-black/40 border border-slate-800 rounded-lg px-2 py-2 text-center text-[14px] focus:border-indigo-500/50 focus:outline-none"
                maxLength={8}
              />
              <div className="flex flex-wrap gap-1">
                {ICON_PRESETS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm({ ...form, icon: ic })}
                    className={`w-7 h-7 rounded border text-sm leading-none transition-colors ${
                      form.icon === ic
                        ? 'border-indigo-500/50 bg-indigo-500/15'
                        : 'border-slate-800 bg-black/30 hover:border-slate-700'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </label>

          <label className="sm:col-span-2">
            <span className="text-[8px] font-mono text-slate-500 uppercase">Article body *</span>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              placeholder="Bulletin content…"
              className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 leading-relaxed focus:border-indigo-500/50 focus:outline-none resize-y"
              maxLength={8000}
            />
            <span className="text-[8px] font-mono text-slate-600 mt-1 block">{form.body.length} / 8000</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.highlight)}
              onChange={(e) => setForm({ ...form, highlight: e.target.checked })}
              className="accent-indigo-500"
            />
            <span className="text-[10px] font-mono text-indigo-300">Breaking / Highlight</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active !== false}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-emerald-500"
            />
            <span className="text-[10px] font-mono text-emerald-300">Publish immediately</span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton onClick={save} variant="indigo" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save article' : 'Publish article'}
          </ActionButton>
          {isEditing && (
            <ActionButton onClick={resetForm} variant="cyan">
              <X size={12} className="inline mr-1" />
              Cancel editing
            </ActionButton>
          )}
          {!isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[9px] font-mono px-3 py-2 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300"
            >
              Clear form
            </button>
          )}
        </div>
      </ToolCard>

      <ToolCard title="Published articles" icon="📰" accent="indigo">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-mono text-slate-600">
            {loading ? 'Loading…' : `${articles.length} articles`}
          </span>
          <button
            type="button"
            onClick={() => {
              resetForm();
              document.getElementById('admin-news-composer')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/35 bg-indigo-500/10 text-indigo-200 text-[10px] font-mono hover:bg-indigo-500/20"
          >
            <Plus size={12} /> New article
          </button>
        </div>

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {articles.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3 transition-colors ${
                form.id === a.id
                  ? 'border-indigo-500/40 bg-indigo-950/20'
                  : a.active
                    ? 'border-slate-800/80 bg-black/25'
                    : 'border-dashed border-slate-700/50 bg-slate-900/20 opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px]">{a.icon ?? '📰'}</span>
                    <span className="text-[11px] font-semibold text-slate-200 truncate">{a.title}</span>
                    {a.highlight && (
                      <span className="px-1.5 py-0.5 rounded border text-[7px] font-mono uppercase text-indigo-300 border-indigo-500/35 bg-indigo-500/10">
                        Breaking
                      </span>
                    )}
                    {!a.active && (
                      <span className="px-1.5 py-0.5 rounded border text-[7px] font-mono uppercase text-slate-500 border-slate-700 bg-slate-800/40">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="text-[8px] font-mono text-slate-500 mt-1">
                    {a.category} · {formatNewsDate(a.publishedAt)} · {a.authorName}
                  </div>
                  <p className="text-[9px] font-mono text-slate-500 mt-1.5 line-clamp-2">{a.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePublish(a)}
                    disabled={togglingId === a.id || saving}
                    className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-emerald-300 disabled:opacity-40"
                    title={a.active ? 'Set as draft' : 'Publish'}
                  >
                    {a.active ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-indigo-300"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-rose-300"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && articles.length === 0 && (
            <p className="text-center py-8 text-[10px] font-mono text-slate-600">
              No articles yet — fill out the form above and publish.
            </p>
          )}
        </div>
      </ToolCard>
    </div>
  );
}