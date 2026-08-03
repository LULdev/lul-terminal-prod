/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Crown, Pencil, Plus, Search, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import * as authApi from '../../lib/auth';
import type { AuthUser, UserRole } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { ActionButton, ToolCard } from '../pages/PageShell';

const ASSIGNABLE_ROLES: UserRole[] = ['user', 'vip', 'admin'];
const FILTER_ROLES: UserRole[] = ['user', 'vip', 'admin', 'bot'];

const ROLE_STYLES: Record<UserRole, string> = {
  user: 'text-slate-400 border-slate-600/40 bg-slate-800/30',
  vip: 'text-amber-300 border-amber-500/35 bg-amber-500/10',
  admin: 'text-violet-300 border-violet-500/35 bg-violet-500/10',
  bot: 'text-sky-300 border-sky-500/35 bg-sky-500/10',
};

type UserFormState = {
  id?: string;
  username: string;
  email: string;
  password: string;
  displayName: string;
  bio: string;
  role: UserRole;
  active: boolean;
  verified: boolean;
  avatarUrl: string;
  coverUrl: string;
};

const emptyForm = (): UserFormState => ({
  username: '',
  email: '',
  password: '',
  displayName: '',
  bio: '',
  role: 'user',
  active: true,
  verified: false,
  avatarUrl: '',
  coverUrl: 'linear-gradient(135deg,#0f172a,#1e293b,#020617)',
});

function UserEditorModal({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  title,
}: {
  form: UserFormState;
  onChange: (f: UserFormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-violet-500/25 bg-[#0c0d12] p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-violet-200 mb-3 flex items-center gap-2"><Shield size={14} /> {title}</h3>
        <div className="grid grid-cols-2 gap-2">
          <F label="Username" value={form.username} onChange={(v) => onChange({ ...form, username: v })} />
          <F label="Email" value={form.email} onChange={(v) => onChange({ ...form, email: v })} />
          <F label="Display name" value={form.displayName} onChange={(v) => onChange({ ...form, displayName: v })} span />
          <F label={form.id ? 'New password (empty = keep)' : 'Password'} value={form.password} onChange={(v) => onChange({ ...form, password: v })} type="password" span />
          <F label="Avatar URL" value={form.avatarUrl} onChange={(v) => onChange({ ...form, avatarUrl: v })} span />
          <F label="Cover image" value={form.coverUrl} onChange={(v) => onChange({ ...form, coverUrl: v })} span />
          <label className="col-span-2">
            <span className="text-[8px] font-mono text-slate-500 uppercase">Bio</span>
            <textarea value={form.bio} onChange={(e) => onChange({ ...form, bio: e.target.value })} rows={2} className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300" />
          </label>
          <label>
            <span className="text-[8px] font-mono text-slate-500 uppercase">Role</span>
            <select value={form.role} onChange={(e) => onChange({ ...form, role: e.target.value as UserRole })} className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300">
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1">
            <input type="checkbox" checked={form.active} onChange={(e) => onChange({ ...form, active: e.target.checked })} className="accent-violet-500" />
            <span className="text-[10px] font-mono text-slate-400">Active</span>
          </label>
          <label className="flex items-end gap-2 pb-1 sm:col-span-2">
            <input type="checkbox" checked={form.verified} onChange={(e) => onChange({ ...form, verified: e.target.checked })} className="accent-sky-500" />
            <span className="text-[10px] font-mono text-sky-300 flex items-center gap-1">
              <BadgeCheck size={12} /> Verified (may submit premium accounts)
            </span>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <ActionButton onClick={onSave} variant="indigo" disabled={saving}>{saving ? 'Saving…' : 'Save'}</ActionButton>
          <ActionButton onClick={onClose} variant="cyan">Cancel</ActionButton>
        </div>
      </div>
    </div>
  );
}

function F({ label, value, onChange, type = 'text', span }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: boolean }) {
  return (
    <label className={span ? 'col-span-2' : ''}>
      <span className="text-[8px] font-mono text-slate-500 uppercase">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300" />
    </label>
  );
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<UserFormState | null>(null);
  const [saving, setSaving] = useState(false);
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
      const data = await authApi.adminListUsers({
        search,
        role: roleFilter,
        active: activeFilter || undefined,
      });
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setUsers(data.users);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, roleFilter, activeFilter]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const saveUser = async () => {
    if (!editor) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        username: editor.username,
        email: editor.email,
        displayName: editor.displayName,
        bio: editor.bio,
        role: editor.role,
        active: editor.active,
        verified: editor.verified,
        avatarUrl: editor.avatarUrl,
        coverUrl: editor.coverUrl,
      };
      if (editor.password) payload.password = editor.password;
      if (editor.id) {
        await authApi.adminUpdateUser(editor.id, payload);
      } else {
        if (!editor.password) throw new Error('Password required');
        await authApi.adminCreateUser(payload);
      }
      setEditor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: AuthUser) => {
    setError('');
    try {
      await authApi.adminUpdateUser(u.id, { active: u.active === false });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const deleteUser = async (u: AuthUser) => {
    if (!confirm(`Really delete user "${u.displayName}"?`)) return;
    setError('');
    try {
      await authApi.adminDeleteUser(u.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const openEdit = (u: AuthUser) => {
    setEditor({
      id: u.id,
      username: u.username,
      email: u.email,
      password: '',
      displayName: u.displayName,
      bio: u.bio,
      role: u.role,
      active: u.active,
      verified: u.verified,
      avatarUrl: u.avatarUrl,
      coverUrl: u.coverUrl,
    });
  };

  return (
    <>
      {editor && (
        <UserEditorModal
          form={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={saveUser}
          saving={saving}
          title={editor.id ? 'Edit user' : 'Create user'}
        />
      )}
      {error && <p className="text-[10px] font-mono text-rose-400">{error}</p>}
      <ToolCard title="Users" icon="👥" accent="violet">
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email…"
              className="w-full pl-8 pr-3 py-2 bg-black/40 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-200 focus:border-violet-500/50 focus:outline-none"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | '')} className="bg-black/40 border border-slate-800 rounded-lg px-2 py-2 text-[10px] font-mono text-slate-400">
            <option value="">All roles</option>
            {FILTER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="bg-black/40 border border-slate-800 rounded-lg px-2 py-2 text-[10px] font-mono text-slate-400">
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select>
          <button
            type="button"
            onClick={() => setEditor(emptyForm())}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-200 text-[10px] font-mono"
          >
            <Plus size={12} /> New
          </button>
        </div>

        <div className="text-[9px] font-mono text-slate-600 mb-2">{loading ? 'Loading…' : `${users.length} users`}</div>

        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-800/80 bg-black/25 hover:border-slate-700/80">
              <img src={safeAvatarUrl(u.avatarUrl, u.username)} alt="" className="w-10 h-10 rounded-lg border border-slate-700/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-200 truncate">{u.displayName}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[7px] font-mono uppercase ${ROLE_STYLES[u.role]}`}>
                    {u.role === 'vip' && <Crown className="inline w-2.5 h-2.5 mr-0.5 -mt-px" />}
                    {ROLE_LABELS[u.role]}
                  </span>
                  {u.verified && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[7px] font-mono uppercase text-sky-300 border-sky-500/35 bg-sky-500/10">
                      <BadgeCheck size={9} /> Verified
                    </span>
                  )}
                  {u.active === false && <span className="text-[7px] font-mono text-rose-400 uppercase">inactive</span>}
                </div>
                <div className="text-[9px] font-mono text-slate-500 truncate">@{u.username} · {u.email}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => toggleActive(u)} className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-emerald-300" title={u.active !== false ? 'Deactivate' : 'Activate'}>
                  {u.active !== false ? <UserX size={12} /> : <UserCheck size={12} />}
                </button>
                <button type="button" onClick={() => openEdit(u)} className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-indigo-300">
                  <Pencil size={12} />
                </button>
                <button type="button" onClick={() => deleteUser(u)} className="p-1.5 rounded border border-slate-800 text-slate-500 hover:text-rose-300">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {!loading && users.length === 0 && (
            <p className="text-center py-8 text-[10px] font-mono text-slate-600">No users found</p>
          )}
        </div>
      </ToolCard>
    </>
  );
}