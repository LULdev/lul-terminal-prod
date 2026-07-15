/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Eye,
  MessageSquare,
  Terminal,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchMyActivity,
  formatRelativeTime,
  type UserActivitySummary,
} from '../../lib/analytics';
import { ActionButton, PageShell, ToolCard } from './PageShell';

function StatTile({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/25 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={accent} />
        <span className="text-[8px] font-mono text-slate-500 uppercase">{label}</span>
      </div>
      <div className={`text-xl font-mono font-bold tabular-nums ${accent}`}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
    </div>
  );
}

export function MyActivityPage() {
  const { isLoggedIn, openAuth } = useAuth();
  const [data, setData] = useState<UserActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const next = await fetchMyActivity();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setData(next);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setMsg(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isLoggedIn) {
    return (
      <PageShell id="my-activity" pageId="activity" icon="📊" title="My Activity" subtitle="Personal usage statistics" accentClass="text-indigo-400">
        <ToolCard title="Login required" icon="🔐" accent="indigo">
          <p className="text-[10px] font-mono text-slate-500 mb-3">Sign in to see your personal usage statistics.</p>
          <ActionButton onClick={() => openAuth('login')} variant="indigo">Sign in</ActionButton>
        </ToolCard>
      </PageShell>
    );
  }

  const u = data?.user;
  const act = u?.activity;

  return (
    <PageShell id="my-activity" pageId="activity" icon="📊" title="My Activity" subtitle="Private · local statistics" accentClass="text-indigo-400">
      {msg && <p className="text-[9px] font-mono text-rose-400 mb-2">{msg}</p>}
      {loading && <p className="text-[10px] font-mono text-slate-600">Loading activity…</p>}

      {!loading && !act && (
        <p className="text-[10px] font-mono text-slate-600 text-center py-8">No activity recorded yet.</p>
      )}

      {u && act && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile icon={Activity} label="Page visits" value={act.pageVisits} accent="text-indigo-300" />
            <StatTile icon={Terminal} label="Commands" value={act.commandsRun} accent="text-amber-300" />
            <StatTile icon={Clock} label="Online (min)" value={u.onlineMinutes} accent="text-emerald-300" />
            <StatTile icon={MessageSquare} label="Shoutbox" value={act.shoutboxSent} accent="text-cyan-300" />
            <StatTile icon={Eye} label="Profile visits" value={act.profileVisits} accent="text-violet-300" />
            <StatTile icon={Zap} label="Logins" value={act.loginCount} accent="text-rose-300" />
            <StatTile icon={BarChart3} label="Changelog" value={act.changelogReads} accent="text-slate-300" />
            <StatTile icon={BarChart3} label="News" value={act.newsReads} accent="text-slate-300" />
          </div>

          <ToolCard title="Visited areas" icon="🗺️" accent="violet">
            <div className="flex flex-wrap gap-1.5">
              {act.tabsVisited.length ? act.tabsVisited.map((t) => (
                <span key={t} className="px-2 py-1 rounded-lg border border-violet-500/25 bg-violet-500/10 text-[9px] font-mono text-violet-200 uppercase">{t}</span>
              )) : (
                <span className="text-[9px] font-mono text-slate-600">No tabs recorded yet</span>
              )}
            </div>
          </ToolCard>

          <ToolCard title="Profile metrics" icon="⭐" accent="cyan">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[9px] font-mono">
              <div><span className="text-slate-600">Profile views</span><div className="text-slate-300 text-lg">{u.profileViews}</div></div>
              <div><span className="text-slate-600">Uploads</span><div className="text-slate-300 text-lg">{u.imagesUploaded}</div></div>
              <div><span className="text-slate-600">Memes</span><div className="text-slate-300 text-lg">{u.memesCreated}</div></div>
              <div><span className="text-slate-600">Achievements</span><div className="text-slate-300 text-lg">{u.achievements}</div></div>
            </div>
          </ToolCard>

          {data.recentEvents.length > 0 && (
            <ToolCard title="Recent activity" icon="📡" accent="teal">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {data.recentEvents.map((e) => (
                  <div key={e.id} className="flex gap-2 text-[8px] font-mono text-slate-500 py-1 border-b border-slate-800/50">
                    <span className="text-teal-400/70 w-20 shrink-0">{formatRelativeTime(e.ts)}</span>
                    <span className="text-slate-400">{e.type}</span>
                    {e.tab && <span className="text-slate-600">· {e.tab}</span>}
                  </div>
                ))}
              </div>
            </ToolCard>
          )}
        </div>
      )}
    </PageShell>
  );
}