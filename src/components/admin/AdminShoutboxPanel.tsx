/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Bot,
  CheckSquare,
  Clock,
  Copy,
  Eraser,
  MessageSquare,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  Square,
  Trash2,
  User,
  VolumeX,
  X,
} from 'lucide-react';
import { ChatRoleBadges } from '../diagnostics/ChatRoleBadges';
import {
  adminBroadcastShoutbox,
  adminBulkDeleteShoutboxMessages,
  adminClearShoutbox,
  adminDeleteShoutboxMessage,
  adminModerateShoutboxUser,
  fetchAdminShoutbox,
  type ShoutboxAdminData,
  type ShoutboxKindFilter,
  type ShoutboxMessage,
} from '../../lib/adminModules';
import { buildProfileUrl } from '../../lib/profileRouting';
import { ChatUserChip } from '../diagnostics/ChatUserChip';
import { ChatMessageBody, isBotSpeaker } from '../diagnostics/ChatMessageBody';
import { ActionButton, ToolCard } from '../pages/PageShell';
import type { UserRole } from '../../types/auth';

const KIND_FILTERS: { id: ShoutboxKindFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '✦' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'bot', label: 'Bot', icon: '🤖' },
  { id: 'system', label: 'System', icon: '⚙️' },
  { id: 'action', label: 'Action', icon: '✨' },
  { id: 'ping', label: 'Ping', icon: '📡' },
  { id: 'achievement', label: 'Achieve', icon: '🏅' },
];

const KIND_STYLES: Record<string, { pill: string; accent: string }> = {
  chat: { pill: 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30', accent: 'border-l-indigo-500/60' },
  bot: { pill: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/30', accent: 'border-l-cyan-500/60' },
  system: { pill: 'bg-amber-500/15 text-amber-200 border-amber-500/30', accent: 'border-l-amber-500/60' },
  action: { pill: 'bg-violet-500/15 text-violet-200 border-violet-500/30', accent: 'border-l-violet-500/60' },
  ping: { pill: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30', accent: 'border-l-fuchsia-500/60' },
  achievement: { pill: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30', accent: 'border-l-emerald-500/60' },
  pinned: { pill: 'bg-slate-500/15 text-slate-300 border-slate-500/30', accent: 'border-l-slate-500/60' },
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return formatTime(ts);
}

function isBotLike(msg: ShoutboxMessage) {
  return isBotSpeaker({ role: msg.role as UserRole, kind: msg.kind });
}

function isProtectedModTarget(role: string | undefined): boolean {
  return role === 'admin' || role === 'bot' || role === 'vip';
}

function openProfileNewTab(username: string) {
  window.open(buildProfileUrl(username), '_blank', 'noopener,noreferrer');
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function StatTile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="shoutbox-admin-stat rounded-xl border border-slate-800/70 bg-gradient-to-br from-[#12151f] to-[#0a0b10] px-3 py-2.5">
      <div className="text-[7px] font-mono uppercase tracking-[0.14em] text-slate-600">{label}</div>
      <div className="text-lg font-mono font-bold text-slate-100 tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[7px] font-mono text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export function AdminShoutboxPanel() {
  const [data, setData] = useState<ShoutboxAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<ShoutboxKindFilter>('all');
  const [userFilter, setUserFilter] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [broadcast, setBroadcast] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const gen = ++loadGenRef.current;
    if (!opts?.silent) setError('');
    try {
      const result = await fetchAdminShoutbox({
        limit: 250,
        q: search || undefined,
        kind: kindFilter,
        username: userFilter || undefined,
      });
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(result);
      setSelected((prev) => {
        const ids = new Set(result.messages.map((m) => m.id));
        const next = new Set([...prev].filter((id) => ids.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch (err) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [search, kindFilter, userFilter]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, search ? 280 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => { if (!document.hidden) void load({ silent: true }); };
    const interval = setInterval(tick, 12_000);
    const onVis = () => { if (!document.hidden) void load({ silent: true }); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [autoRefresh, load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const flash = (msg: string) => setSuccess(msg);

  const handleDelete = async (msg: ShoutboxMessage) => {
    if (!confirm(`Delete message from @${msg.username}?`)) return;
    setActing(msg.id);
    try {
      await adminDeleteShoutboxMessage(msg.id);
      flash('Message deleted');
      setSelected((s) => { const n = new Set(s); n.delete(msg.id); return n; });
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActing(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected message(s)?`)) return;
    setActing('bulk');
    try {
      const r = await adminBulkDeleteShoutboxMessages(ids);
      flash(`${r.removed} message(s) deleted`);
      setSelected(new Set());
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setActing(null);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear the entire shoutbox lobby? A system notice will be posted.')) return;
    setActing('clear');
    try {
      const r = await adminClearShoutbox();
      flash(`Cleared ${r.cleared} stored message(s)`);
      setSelected(new Set());
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setActing(null);
    }
  };

  const handleBroadcast = async () => {
    const text = broadcast.trim();
    if (!text) return;
    setBroadcasting(true);
    try {
      await adminBroadcastShoutbox(text);
      flash('BOT announcement sent');
      setBroadcast('');
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  };

  const resolveModRole = useCallback((username: string) => {
    const normalized = username.trim().toLowerCase();
    const chatter = data?.topChatters?.find((c) => c.username === normalized);
    if (chatter?.role) return chatter.role;
    const msg = data?.messages?.find((m) => m.username.toLowerCase() === normalized);
    return msg?.role;
  }, [data]);

  const runMod = async (username: string, action: 'ban' | 'unban' | 'mute' | 'unmute', minutes?: number) => {
    if ((action === 'ban' || action === 'mute') && isProtectedModTarget(resolveModRole(username))) {
      setError(`Cannot ${action} protected user @${username}`);
      return;
    }
    const label = action === 'mute' ? `Mute @${username} for ${minutes ?? 30}m?` : `${action} @${username}?`;
    if (!confirm(label)) return;
    setActing(`${action}:${username}`);
    try {
      await adminModerateShoutboxUser({ action, username, minutes });
      flash(`${action} applied to @${username}`);
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moderation failed');
    } finally {
      setActing(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableIds = useMemo(
    () => (data?.messages ?? []).filter((m) => m.kind !== 'pinned').map((m) => m.id),
    [data?.messages],
  );

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };

  const lastUpdated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="shoutbox-admin-hero rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/30 via-[#10131c] to-[#08090d] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500" />
              </span>
              <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-fuchsia-300/80">Live monitor</span>
            </div>
            <h2 className="text-sm font-bold text-slate-100 font-sans">Shoutbox Command Center</h2>
            <p className="text-[9px] font-mono text-slate-500 mt-1 max-w-xl leading-relaxed">
              Browse, filter, moderate, and broadcast — same user chips as the live terminal.
              Left-click profile · right-click ping &amp; mod · auto-refresh every 12s.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[8px] font-mono font-bold transition ${
                autoRefresh
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-black/30 text-slate-500'
              }`}
            >
              {autoRefresh ? <Play size={10} /> : <Pause size={10} />}
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-black/30 text-slate-400 hover:text-fuchsia-300 hover:border-fuchsia-500/30 text-[8px] font-mono transition"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              Sync
            </button>
            <span className="text-[7px] font-mono text-slate-600 tabular-nums">Updated {lastUpdated}</span>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
            <StatTile label="Stored" value={data.stats.stored} />
            <StatTile label="Showing" value={data.total} sub="after filters" />
            <StatTile label="Members" value={data.stats.uniqueUsers ?? '—'} sub="unique chatters" />
            <StatTile label="Chat" value={data.stats.byKind.chat ?? 0} />
            <StatTile label="Bot" value={data.stats.byKind.bot ?? 0} />
            <StatTile
              label="System+"
              value={(data.stats.byKind.system ?? 0) + (data.stats.byKind.achievement ?? 0)}
            />
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[9px] font-mono text-rose-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-400/60 hover:text-rose-200"><X size={12} /></button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[9px] font-mono text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
        <div className="space-y-3 min-w-0">
          {/* Filters + search */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0e1018]/90 p-3 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value.slice(0, 80))}
                  placeholder="Search text, user, or message ID…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-800 bg-black/50 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:border-fuchsia-500/40 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/20"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {KIND_FILTERS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKindFilter(k.id)}
                  className={`px-2 py-1 rounded-full border text-[7px] font-mono font-bold uppercase tracking-wider transition ${
                    kindFilter === k.id
                      ? 'border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200'
                      : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                  }`}
                >
                  {k.icon} {k.label}
                  {k.id !== 'all' && data?.stats.byKind[k.id] != null && (
                    <span className="ml-1 opacity-60 tabular-nums">{data.stats.byKind[k.id]}</span>
                  )}
                </button>
              ))}
            </div>
            {userFilter && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-slate-500">User filter:</span>
                <button
                  type="button"
                  onClick={() => setUserFilter('')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 text-[8px] font-mono text-fuchsia-200 hover:bg-fuchsia-500/20"
                >
                  @{userFilter} <X size={10} />
                </button>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <ToolCard title="Quick actions" icon="⚡" accent="violet">
            <div className="space-y-3">
              <div>
                <label className="text-[8px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <Bot size={10} /> BOT broadcast
                </label>
                <div className="flex gap-2">
                  <input
                    value={broadcast}
                    onChange={(e) => setBroadcast(e.target.value.slice(0, 280))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleBroadcast(); }}
                    placeholder="/bot style announcement (max 280)…"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none"
                  />
                  <ActionButton onClick={() => void handleBroadcast()} variant="indigo" disabled={broadcasting || !broadcast.trim()}>
                    <span className="inline-flex items-center gap-1"><Send size={10} /> Send</span>
                  </ActionButton>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/60">
                <ActionButton onClick={() => void handleClear()} variant="amber" disabled={acting === 'clear'}>
                  <span className="inline-flex items-center gap-1"><Eraser size={10} /> Clear lobby</span>
                </ActionButton>
                {selected.size > 0 && (
                  <ActionButton onClick={() => void handleBulkDelete()} variant="rose" disabled={acting === 'bulk'}>
                    <span className="inline-flex items-center gap-1"><Trash2 size={10} /> Delete {selected.size}</span>
                  </ActionButton>
                )}
              </div>
            </div>
          </ToolCard>

          {/* Message list */}
          <ToolCard title={`Messages${data ? ` · ${data.messages.length}` : ''}`} icon="💬" accent="rose">
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/60">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1 text-[8px] font-mono text-slate-500 hover:text-slate-300 transition"
              >
                {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                {allSelected ? 'Deselect all' : 'Select visible'}
              </button>
              {selected.size > 0 && (
                <span className="text-[8px] font-mono text-fuchsia-400 tabular-nums">{selected.size} selected</span>
              )}
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 shoutbox-admin-scroll">
              {(data?.messages ?? []).map((msg) => {
                const styles = KIND_STYLES[msg.kind] ?? KIND_STYLES.chat;
                const isPinned = msg.kind === 'pinned';
                const isSelected = selected.has(msg.id);
                return (
                  <div
                    key={msg.id}
                    className={`shoutbox-admin-card group flex items-start gap-2 p-2.5 rounded-xl border border-slate-800/50 bg-black/25 hover:bg-black/40 hover:border-slate-700/80 border-l-2 ${styles.accent} transition ${
                      isSelected ? 'ring-1 ring-fuchsia-500/30 bg-fuchsia-500/5' : ''
                    }`}
                  >
                    {!isPinned && (
                      <button
                        type="button"
                        onClick={() => toggleSelect(msg.id)}
                        className="shrink-0 mt-0.5 text-slate-600 hover:text-fuchsia-400 transition"
                        aria-label={isSelected ? 'Deselect' : 'Select'}
                      >
                        {isSelected ? <CheckSquare size={13} className="text-fuchsia-400" /> : <Square size={13} />}
                      </button>
                    )}
                    {isPinned && <div className="w-[13px] shrink-0" />}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-mono">
                        {isBotLike(msg) ? (
                          <span className="inline-flex items-center gap-1 text-cyan-400 font-semibold">
                            <ChatRoleBadges role="bot" compact />
                            <span className="bot-username-style">@{msg.username}</span>
                          </span>
                        ) : (
                          <ChatUserChip
                            user={{
                              userId: msg.userId ?? msg.username,
                              username: msg.username,
                              displayName: msg.displayName,
                              role: (msg.role as UserRole) || 'user',
                              avatarUrl: msg.avatarUrl ?? undefined,
                              verified: msg.verified,
                            }}
                            onOpenProfile={openProfileNewTab}
                            modViaApi
                            compact
                          />
                        )}
                        <span className={`px-1.5 py-px rounded border text-[6px] font-bold uppercase tracking-wider ${styles.pill}`}>
                          {msg.kind}
                        </span>
                        <span className="text-slate-600" title={formatTime(msg.createdAt)}>
                          {formatRelative(msg.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyText(msg.id).then((ok) => ok && flash('ID copied'))}
                          className="text-slate-700 hover:text-slate-400 font-mono text-[6px] opacity-0 group-hover:opacity-100 transition"
                          title="Copy message ID"
                        >
                          #{msg.id}
                        </button>
                      </div>
                      <p className="text-[9px] font-mono text-slate-400 mt-1.5 break-words leading-relaxed">
                        <ChatMessageBody
                          msg={{ text: msg.text, segments: msg.segments ?? null }}
                          onOpenProfile={openProfileNewTab}
                        />
                      </p>
                    </div>

                    <div className="shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => void copyText(msg.text).then((ok) => ok && flash('Text copied'))}
                        className="p-1 rounded border border-slate-700/60 text-slate-500 hover:text-slate-300"
                        title="Copy text"
                      >
                        <Copy size={10} />
                      </button>
                      {!isBotLike(msg) && !isPinned && !isProtectedModTarget(msg.role) && (
                        <>
                          <button
                            type="button"
                            disabled={!!acting}
                            onClick={() => void runMod(msg.username, 'mute', 5)}
                            className="p-1 rounded border border-amber-500/20 text-amber-500/70 hover:text-amber-300"
                            title="Mute 5 min"
                          >
                            <Clock size={10} />
                          </button>
                          <button
                            type="button"
                            disabled={!!acting}
                            onClick={() => void runMod(msg.username, 'ban')}
                            className="p-1 rounded border border-rose-500/20 text-rose-500/70 hover:text-rose-300"
                            title="Ban from shoutbox"
                          >
                            <Ban size={10} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={acting === msg.id || isPinned}
                        onClick={() => void handleDelete(msg)}
                        className="p-1 rounded border border-rose-500/20 text-rose-400/50 hover:text-rose-300 disabled:opacity-30"
                        title={isPinned ? 'Pinned messages cannot be deleted' : 'Delete'}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!data?.messages.length && !loading && (
                <div className="py-12 text-center">
                  <MessageSquare className="mx-auto text-slate-700 mb-2" size={28} />
                  <p className="text-[9px] font-mono text-slate-600">No messages match your filters</p>
                </div>
              )}
              {loading && !data?.messages.length && (
                <div className="py-12 text-center text-[9px] font-mono text-slate-600 animate-pulse">Loading shoutbox…</div>
              )}
            </div>
          </ToolCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <ToolCard title="Top chatters" icon="📊" accent="cyan">
            <p className="text-[8px] font-mono text-slate-600 mb-2 leading-relaxed">
              Click a user to filter the feed. Ban/mute status shown when known.
            </p>
            <div className="space-y-1 max-h-[280px] overflow-y-auto pr-0.5">
              {(data?.topChatters ?? []).map((c) => {
                const muted = c.chatMutedUntil && c.chatMutedUntil > Date.now();
                const active = userFilter === c.username;
                return (
                  <button
                    key={c.username}
                    type="button"
                    onClick={() => setUserFilter((u) => (u === c.username ? '' : c.username))}
                    className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                      active
                        ? 'border-fuchsia-500/40 bg-fuchsia-500/10'
                        : 'border-slate-800/60 bg-black/20 hover:border-slate-700 hover:bg-black/30'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold text-fuchsia-300 tabular-nums w-5 shrink-0">
                      {c.count}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <ChatRoleBadges role={c.role as UserRole} verified={c.verified} compact />
                        <span className="text-[8px] font-mono text-slate-300 truncate">@{c.username}</span>
                      </div>
                      {(c.chatBanned || muted) && (
                        <div className="text-[6px] font-mono text-rose-400/80 mt-0.5">
                          {c.chatBanned ? 'BANNED' : muted ? 'MUTED' : ''}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {!data?.topChatters?.length && (
                <p className="text-[8px] font-mono text-slate-600 py-4 text-center">No chatter data yet</p>
              )}
            </div>
          </ToolCard>

          <ToolCard title="Mod shortcuts" icon="🛡️" accent="amber">
            <div className="space-y-2 text-[8px] font-mono text-slate-500 leading-relaxed">
              <p><Radio size={10} className="inline text-amber-400 mr-1" />Hover a row for mute, ban, copy &amp; delete.</p>
              <p><User size={10} className="inline text-violet-400 mr-1" />Right-click chips for full mod menu (terminal parity).</p>
              <p><VolumeX size={10} className="inline text-slate-400 mr-1" />Bulk-select then delete spam bursts.</p>
            </div>
            {userFilter && !isProtectedModTarget(resolveModRole(userFilter)) && (
              <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[8px] font-mono text-slate-400">Quick mod @{userFilter}</div>
                <div className="flex flex-wrap gap-1">
                  <ActionButton onClick={() => void runMod(userFilter, 'mute', 30)} variant="amber">Mute 30m</ActionButton>
                  <ActionButton onClick={() => void runMod(userFilter, 'unmute')} variant="cyan">Unmute</ActionButton>
                  <ActionButton onClick={() => void runMod(userFilter, 'ban')} variant="rose">Ban</ActionButton>
                  <ActionButton onClick={() => void runMod(userFilter, 'unban')} variant="emerald">Unban</ActionButton>
                </div>
              </div>
            )}
          </ToolCard>
        </div>
      </div>
    </div>
  );
}