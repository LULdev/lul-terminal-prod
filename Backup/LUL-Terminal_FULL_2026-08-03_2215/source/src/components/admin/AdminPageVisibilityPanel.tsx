/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import {
  DASHBOARD_MENU_ITEM,
  LAB_MENU_ITEMS,
  MAIN_MENU_ITEMS,
  TabId,
} from '../../config/menuItems';
import {
  DEFAULT_SITE_UI,
  fetchAdminPageVisibility,
  resetAdminPageVisibility,
  updateAdminPageVisibility,
  type AdminAccessControl,
  type PageVisibility,
  type SiteUiConfig,
} from '../../lib/pageVisibility';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { usePageVisibility } from '../../context/PageVisibilityContext';
import { ToolCard } from '../pages/PageShell';

type PageRow = {
  id: TabId;
  icon: string;
  label: string;
  group: 'main' | 'labs' | 'system';
  tagline: string;
};

const SYSTEM_PAGES: PageRow[] = [
  { id: 'dashboard', icon: DASHBOARD_MENU_ITEM.icon, label: DASHBOARD_MENU_ITEM.label, group: 'system', tagline: DASHBOARD_MENU_ITEM.tagline },
  { id: 'profile', icon: '👤', label: 'Profile', group: 'system', tagline: 'Public profile pages via link' },
  { id: 'activity', icon: '📊', label: 'My Activity', group: 'system', tagline: 'Personal analytics' },
  { id: 'admin', icon: '🛡️', label: 'Admin Panel', group: 'system', tagline: 'Administrator tools' },
];

const MAIN_PAGES = MAIN_MENU_ITEMS.map((m) => ({ id: m.id, icon: m.icon, label: m.label, group: 'main' as const, tagline: m.tagline }));

const ALL_PAGES: PageRow[] = [
  ...SYSTEM_PAGES.filter((p) => p.id === 'dashboard'),
  ...MAIN_PAGES,
  ...LAB_MENU_ITEMS.map((m) => ({ id: m.id, icon: m.icon, label: m.label, group: 'labs' as const, tagline: m.tagline })),
  ...SYSTEM_PAGES.filter((p) => p.id !== 'dashboard'),
];

const GROUP_LABELS: Record<PageRow['group'], string> = {
  main: 'Main menu',
  labs: 'Creative Labs',
  system: 'System & Account',
};

export function AdminPageVisibilityPanel() {
  const { refresh: refreshGlobal } = usePageVisibility();
  const [data, setData] = useState<AdminAccessControl | null>(null);
  const [draft, setDraft] = useState<Record<string, PageVisibility>>({});
  const [uiDraft, setUiDraft] = useState<SiteUiConfig>({ ...DEFAULT_SITE_UI });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveGenRef = useRef(0);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'members'>('all');
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setErr('');
    try {
      const res = await fetchAdminPageVisibility();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(res);
      setDraft(res.pages);
      setUiDraft({
        showDiagnosticsPane: res.ui?.showDiagnosticsPane !== false,
      });
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [loadGenRef, mountedRef]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const pagesDirty = ALL_PAGES.some((p) => draft[p.id] !== data.pages[p.id]);
    const uiDirty = uiDraft.showDiagnosticsPane !== (data.ui?.showDiagnosticsPane !== false);
    return pagesDirty || uiDirty;
  }, [data, draft, uiDraft]);

  const stats = useMemo(() => {
    const publicCount = ALL_PAGES.filter((p) => draft[p.id] === 'public').length;
    const membersCount = ALL_PAGES.length - publicCount;
    return { publicCount, membersCount };
  }, [draft]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_PAGES.filter((p) => {
      if (filter === 'public' && draft[p.id] !== 'public') return false;
      if (filter === 'members' && draft[p.id] !== 'members') return false;
      if (!q) return true;
      return p.label.toLowerCase().includes(q) || p.id.includes(q) || p.tagline.toLowerCase().includes(q);
    });
  }, [search, filter, draft]);

  const setVisibility = (id: TabId, vis: PageVisibility) => {
    if (data?.lockedPublic.includes(id)) return;
    if (data?.lockedMembers.includes(id)) return;
    setDraft((prev) => ({ ...prev, [id]: vis }));
  };

  const setAll = (vis: PageVisibility) => {
    const next = { ...draft };
    for (const p of ALL_PAGES) {
      if (data?.lockedPublic.includes(p.id)) next[p.id] = 'public';
      else if (data?.lockedMembers.includes(p.id)) next[p.id] = 'members';
      else next[p.id] = vis;
    }
    setDraft(next);
  };

  const save = async () => {
    const gen = ++saveGenRef.current;
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const res = await updateAdminPageVisibility(draft, uiDraft);
      if (gen !== saveGenRef.current) return;
      setData(res);
      setDraft(res.pages);
      setUiDraft({
        showDiagnosticsPane: res.ui?.showDiagnosticsPane !== false,
      });
      await refreshGlobal();
      if (gen !== saveGenRef.current) return;
      setMsg('Saved — layout & visibility apply site-wide (reload within ~60s for other tabs).');
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      if (gen !== saveGenRef.current) return;
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      if (gen === saveGenRef.current) setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all visibility settings to defaults?')) return;
    const gen = ++saveGenRef.current;
    setSaving(true);
    setErr('');
    try {
      const res = await resetAdminPageVisibility();
      if (gen !== saveGenRef.current) return;
      setData(res);
      setDraft(res.pages);
      setUiDraft({
        showDiagnosticsPane: res.ui?.showDiagnosticsPane !== false,
      });
      await refreshGlobal();
      if (gen !== saveGenRef.current) return;
      setMsg('Defaults restored.');
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      if (gen !== saveGenRef.current) return;
      setErr(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      if (gen === saveGenRef.current) setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const groups: PageRow['group'][] = ['main', 'labs', 'system'];
    return groups.map((g) => ({
      group: g,
      items: filtered.filter((p) => p.group === g),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  if (loading && !data) {
    return (
      <ToolCard title="Page visibility" icon="👁️" accent="teal">
        <div className="py-8 text-center text-[10px] font-mono text-slate-600 animate-pulse">Loading configuration…</div>
      </ToolCard>
    );
  }

  return (
    <ToolCard title="Page visibility" icon="👁️" accent="teal">
      <p className="text-[9px] font-mono text-slate-500 mb-4 leading-relaxed">
        Control which tabs guests without login may open. <span className="text-sky-400/90">Public</span> = freely accessible ·{' '}
        <span className="text-violet-400/90">Members</span> = login gate with explanation modal.
      </p>

      {/* Layout chrome */}
      <div className="mb-4 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-indigo-100 flex items-center gap-1.5">
              <span aria-hidden>📟</span> Diagnostics / Shoutbox pane
            </div>
            <p className="text-[8px] font-mono text-slate-500 mt-1 leading-relaxed">
              Right-hand terminal (telemetry, shoutbox, CLI). When off, the main content uses the full width for everyone.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={uiDraft.showDiagnosticsPane}
            onClick={() =>
              setUiDraft((prev) => ({
                ...prev,
                showDiagnosticsPane: !prev.showDiagnosticsPane,
              }))
            }
            className={`shrink-0 relative w-11 h-6 rounded-full border transition-colors ${
              uiDraft.showDiagnosticsPane
                ? 'bg-indigo-500/40 border-indigo-400/50'
                : 'bg-slate-900 border-slate-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${
                uiDraft.showDiagnosticsPane ? 'translate-x-5' : 'translate-x-0'
              }`}
              style={{ width: 18, height: 18 }}
            />
          </button>
        </div>
        <p className="text-[8px] font-mono mt-2 text-slate-600">
          Status:{' '}
          <span className={uiDraft.showDiagnosticsPane ? 'text-emerald-400' : 'text-amber-400'}>
            {uiDraft.showDiagnosticsPane ? 'Visible' : 'Hidden'}
          </span>
          {' · '}remember to Save
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatPill icon={<Globe size={12} />} label="Public" value={stats.publicCount} accent="text-emerald-300" />
        <StatPill icon={<Lock size={12} />} label="Members only" value={stats.membersCount} accent="text-violet-300" />
        <StatPill icon={<Users size={12} />} label="Total pages" value={ALL_PAGES.length} accent="text-slate-300" />
        <StatPill
          icon={<Shield size={12} />}
          label="Locked"
          value={(data?.lockedPublic.length ?? 0) + (data?.lockedMembers.length ?? 0)}
          accent="text-amber-300"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[160px] relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search page…"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-300 focus:border-teal-500/40 focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg border border-slate-800 overflow-hidden">
          {(['all', 'public', 'members'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-2 text-[9px] font-mono capitalize ${filter === f ? 'bg-teal-500/15 text-teal-300' : 'text-slate-600'}`}
            >
              {f === 'all' ? 'All' : f === 'public' ? 'Public' : 'Members'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => setAll('public')} className="px-2.5 py-1.5 rounded-lg border border-emerald-800/50 text-[9px] font-mono text-emerald-400 hover:bg-emerald-500/10">
          All → Public
        </button>
        <button type="button" onClick={() => setAll('members')} className="px-2.5 py-1.5 rounded-lg border border-violet-800/50 text-[9px] font-mono text-violet-400 hover:bg-violet-500/10">
          All → Members
        </button>
        <button type="button" onClick={load} className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-500 hover:text-slate-300 inline-flex items-center gap-1">
          <RefreshCw size={10} /> Reload
        </button>
        <button type="button" onClick={reset} disabled={saving} className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-500 hover:text-amber-300 inline-flex items-center gap-1">
          <RotateCcw size={10} /> Defaults
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="ml-auto px-3 py-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-[9px] font-mono text-teal-200 hover:bg-teal-500/20 disabled:opacity-40 inline-flex items-center gap-1"
        >
          <Save size={10} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {msg && <p className="text-[9px] font-mono text-emerald-400 mb-3">{msg}</p>}
      {err && <p className="text-[9px] font-mono text-rose-400 mb-3">{err}</p>}

      <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-600 mb-2 sticky top-0 bg-[#161a24] py-1 z-10">
              {GROUP_LABELS[group]}
            </div>
            <div className="space-y-1.5">
              {items.map((page) => {
                const vis = draft[page.id] ?? 'members';
                const lockedPublic = data?.lockedPublic.includes(page.id);
                const lockedMembers = data?.lockedMembers.includes(page.id);
                const locked = lockedPublic || lockedMembers;
                return (
                  <div
                    key={page.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                      vis === 'public'
                        ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                        : 'border-slate-800/80 bg-black/20'
                    }`}
                  >
                    <span className="text-lg w-8 text-center shrink-0">{page.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-200 truncate">{page.label}</span>
                        <code className="text-[7px] font-mono text-slate-600">{page.id}</code>
                        {locked && (
                          <span className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400/90">
                            {lockedPublic ? 'always public' : 'always members'}
                          </span>
                        )}
                      </div>
                      <p className="text-[8px] font-mono text-slate-600 truncate">{page.tagline}</p>
                    </div>
                    <VisibilityToggle
                      value={vis}
                      disabled={locked}
                      onChange={(v) => setVisibility(page.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!filtered.length && (
          <p className="text-center py-6 text-[10px] font-mono text-slate-600">No matches</p>
        )}
      </div>

      {data?.updatedAt && (
        <p className="text-[8px] font-mono text-slate-700 mt-3 text-right">
          Last saved: {new Date(data.updatedAt).toLocaleString('en-US')}
        </p>
      )}
    </ToolCard>
  );
}

function VisibilityToggle({
  value,
  disabled,
  onChange,
}: {
  value: PageVisibility;
  disabled?: boolean;
  onChange: (v: PageVisibility) => void;
}) {
  return (
    <div className={`flex rounded-lg border overflow-hidden shrink-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        onClick={() => onChange('public')}
        className={`px-2.5 py-1.5 text-[8px] font-mono flex items-center gap-1 transition ${
          value === 'public' ? 'bg-emerald-500/20 text-emerald-300 border-r border-emerald-500/30' : 'text-slate-600 hover:text-slate-400'
        }`}
      >
        <Globe size={10} /> Public
      </button>
      <button
        type="button"
        onClick={() => onChange('members')}
        className={`px-2.5 py-1.5 text-[8px] font-mono flex items-center gap-1 transition ${
          value === 'members' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-600 hover:text-slate-400'
        }`}
      >
        <Lock size={10} /> Members
      </button>
    </div>
  );
}

function StatPill({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/25 px-3 py-2">
      <div className={`flex items-center gap-1 text-[14px] font-mono font-bold tabular-nums ${accent}`}>
        {icon}
        {value}
      </div>
      <div className="text-[7px] font-mono text-slate-600 uppercase tracking-wide">{label}</div>
    </div>
  );
}