/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Download,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import {
  exportAdminAnalytics,
  fetchAdminOverview,
  fetchAdminUserActivity,
  fetchAdminUserDetail,
  formatAnalyticsDate,
  formatEventMeta,
  formatRelativeTime,
  purgeAnalyticsEvents,
  type AdminOverview,
  type AnalyticsEvent,
  type UserActivitySummary,
  type VisitorIntelligence,
} from '../../lib/analytics';
import { ActionButton, ToolCard } from '../pages/PageShell';

function StatCard({ label, value, sub, accent = 'text-slate-200' }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/30 p-3 text-center">
      <div className="text-[7px] font-mono text-slate-600 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-mono font-bold tabular-nums ${accent}`}>
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
      {sub && <div className="text-[7px] font-mono text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color, labelWidth = 'w-24' }: {
  label: string;
  value: number;
  max: number;
  color: string;
  labelWidth?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[8px] font-mono">
      <span className={`${labelWidth} truncate text-slate-500`}>{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-slate-400 tabular-nums">{value}</span>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-[8px] font-mono">
      <span className="text-slate-600 shrink-0">{label}</span>
      <span className={`text-slate-300 text-right truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function EventRow({ event, detailed }: { event: AnalyticsEvent; detailed?: boolean }) {
  const meta = formatEventMeta(event.meta);
  return (
    <div className={`flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-mono border-b border-slate-800/40 pb-1 ${detailed ? '' : ''}`}>
      <span className="text-violet-400/80 shrink-0 w-16">{formatRelativeTime(event.ts)}</span>
      <span className="text-slate-400 shrink-0">{event.type}</span>
      {event.tab && <span className="text-indigo-400/80 shrink-0">{event.tab}</span>}
      {event.username && <span className="text-slate-500">@{event.username}</span>}
      {meta && <span className="text-slate-600 truncate">{meta}</span>}
      {detailed && event.sessionId && (
        <span className="text-slate-700 truncate" title={event.sessionId}>sess {event.sessionId.slice(0, 10)}…</span>
      )}
      {detailed && event.guestId && (
        <span className="text-slate-700 truncate" title={event.guestId}>guest {event.guestId.slice(0, 10)}…</span>
      )}
    </div>
  );
}

function VisitorIntelligencePanel({ vi }: { vi: VisitorIntelligence }) {
  const maxRef = Math.max(...vi.referrerDomains.map((r) => r.count), 1);

  return (
    <ToolCard title="Visitor intelligence" icon="🛰️" accent="cyan">
      <p className="text-[8px] font-mono text-slate-500 mb-3 leading-relaxed">
        Referrer URL, visit frequency, device, language, UTM, landing path, tab dwell time — 25+ tracking dimensions.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <StatCard label="Profiles" value={vi.totalProfiles} accent="text-cyan-300" />
        <StatCard label="Active 24h" value={vi.activeLast24h} accent="text-emerald-300" />
        <StatCard label="Return visits" value={vi.returnVisits} sub={`${vi.returnVisitorCount} profiles`} accent="text-violet-300" />
        <StatCard label="New visits" value={vi.newVisits} sub={`${vi.newVisitorCount} profiles`} accent="text-amber-300" />
        <StatCard label="Avg visits" value={vi.avgVisitsPerVisitor} accent="text-indigo-300" />
        <StatCard label="Referrers" value={vi.referrerDomains.length} accent="text-rose-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1.5">Referrer domains</div>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {vi.referrerDomains.map((r) => (
              <React.Fragment key={r.key}>
                <BarRow label={r.key} value={r.count} max={maxRef} color="bg-cyan-500" labelWidth="w-28" />
              </React.Fragment>
            ))}
            {!vi.referrerDomains.length && <p className="text-[8px] text-slate-600">No referrer data yet</p>}
          </div>
        </div>
        <div>
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1.5">Referrer type</div>
          <div className="space-y-1">
            {vi.referrerTypes.map((r) => (
              <React.Fragment key={r.key}>
                <BarRow label={r.key} value={r.count} max={vi.referrerTypes[0]?.count ?? 1} color="bg-violet-500" labelWidth="w-20" />
              </React.Fragment>
            ))}
          </div>
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1.5 mt-3">Devices</div>
          <div className="space-y-1">
            {vi.devices.map((d) => (
              <React.Fragment key={d.key}>
                <BarRow label={d.key} value={d.count} max={vi.devices[0]?.count ?? 1} color="bg-emerald-500" labelWidth="w-20" />
              </React.Fragment>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1.5">Languages · TZ · Connection</div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {vi.languages.slice(0, 6).map((l) => (
              <React.Fragment key={l.key}>
                <BarRow label={l.key} value={l.count} max={vi.languages[0]?.count ?? 1} color="bg-indigo-500" labelWidth="w-16" />
              </React.Fragment>
            ))}
          </div>
          <div className="space-y-1 mt-2 max-h-16 overflow-y-auto">
            {vi.timezones.slice(0, 4).map((t) => (
              <React.Fragment key={t.key}>
                <BarRow label={t.key} value={t.count} max={vi.timezones[0]?.count ?? 1} color="bg-amber-500" labelWidth="w-24" />
              </React.Fragment>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {vi.connections.map((c) => (
              <span key={c.key} className="px-1.5 py-0.5 rounded border border-slate-700 text-[7px] text-slate-400">{c.key} ×{c.count}</span>
            ))}
            {vi.colorSchemes.map((c) => (
              <span key={c.key} className="px-1.5 py-0.5 rounded border border-slate-700 text-[7px] text-slate-400">{c.key} theme ×{c.count}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1.5">Landing paths</div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {vi.landingPaths.map((p) => (
              <React.Fragment key={p.key}>
                <BarRow label={p.key || '/'} value={p.count} max={vi.landingPaths[0]?.count ?? 1} color="bg-rose-500" labelWidth="w-32" />
              </React.Fragment>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1.5">UTM · Platforms</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {vi.utmSources.map((u) => (
              <span key={u.key} className="px-1.5 py-0.5 rounded border border-cyan-500/25 bg-cyan-500/10 text-[7px] text-cyan-300">src:{u.key} ×{u.count}</span>
            ))}
            {vi.utmMediums.map((u) => (
              <span key={u.key} className="px-1.5 py-0.5 rounded border border-violet-500/25 text-[7px] text-violet-300">med:{u.key}</span>
            ))}
            {vi.utmCampaigns.map((u) => (
              <span key={u.key} className="px-1.5 py-0.5 rounded border border-amber-500/25 text-[7px] text-amber-300">cmp:{u.key}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {vi.platforms.map((p) => (
              <span key={p.key} className="px-1.5 py-0.5 rounded border border-slate-700 text-[7px] text-slate-400">{p.key} ×{p.count}</span>
            ))}
          </div>
          {vi.dwellByTab.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="text-[7px] font-mono text-slate-600">Tab dwell (avg sec)</div>
              {vi.dwellByTab.map((d) => (
                <React.Fragment key={d.tab}>
                  <BarRow label={d.tab} value={d.avgSec} max={vi.dwellByTab[0]?.avgSec ?? 1} color="bg-teal-500" labelWidth="w-20" />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-[7px] font-mono uppercase text-slate-600 mb-1.5">Recent visitors</div>
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {vi.recentVisitors.map((v) => (
          <div key={v.key} className="p-2 rounded-lg border border-slate-800/80 bg-black/20 text-[8px] font-mono">
            <div className="flex flex-wrap justify-between gap-1">
              <span className="text-slate-300">
                {v.username ? `@${v.username}` : v.guestId?.slice(0, 14) ?? v.key}
                {v.returnVisitor && <span className="text-violet-400 ml-1">↩ repeat</span>}
              </span>
              <span className="text-cyan-400">visit #{v.visitCount} · {v.sessionCount} sessions</span>
            </div>
            <div className="text-slate-500 mt-0.5 truncate" title={v.lastReferrer}>
              from <span className="text-emerald-400/90">{v.lastReferrerDomain}</span>
              {v.lastReferrer && v.lastReferrerDomain !== 'direct' && ` · ${v.lastReferrer.slice(0, 80)}`}
            </div>
            <div className="text-slate-600 mt-0.5">
              landed {v.lastLandingPath || '/'}
              {' · '}{v.deviceType} · {v.language} · {v.timezone}
              {v.utmSource && ` · utm:${v.utmSource}`}
              {v.refCode && ` · ref:${v.refCode}`}
              {' · '}{formatRelativeTime(v.lastSeenAt)}
            </div>
          </div>
        ))}
        {!vi.recentVisitors.length && <p className="text-[8px] text-slate-600 py-4 text-center">No visitor profiles yet — reload the app to seed session_start events</p>}
      </div>
    </ToolCard>
  );
}

function UserDetailPanel({ selected }: { selected: UserActivitySummary }) {
  const u = selected.user;
  const ins = selected.insights;
  const maxTab = Math.max(...(ins?.tabBreakdown.map((t) => t.count) ?? []), 1);
  const maxEvt = Math.max(...(ins?.eventBreakdown.map((e) => e.count) ?? []), 1);
  const flagEntries = Object.entries(u.activity.flags ?? {}).filter(([, v]) => v);

  return (
    <div className="rounded-xl border border-violet-500/20 bg-black/25 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-[11px] font-mono font-bold text-violet-200">{u.displayName}</h4>
          <div className="text-[8px] font-mono text-slate-500 mt-0.5">
            @{u.username} · {u.role}
            {u.verified && <span className="text-sky-400 ml-1">verified</span>}
            {!u.active && <span className="text-rose-400 ml-1">inactive</span>}
            {u.isOnline && <span className="text-emerald-400 ml-1">● online</span>}
          </div>
        </div>
        <div className="text-[7px] font-mono text-slate-600 text-right">
          <div>ID {u.id}</div>
          {u.email && <div className="text-slate-500">{u.email}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Page visits" value={u.activity.pageVisits} accent="text-indigo-300" />
        <StatCard label="Commands" value={u.activity.commandsRun} accent="text-amber-300" />
        <StatCard label="Online min" value={u.onlineMinutes} accent="text-emerald-300" />
        <StatCard label="Logins" value={u.activity.loginCount} accent="text-rose-300" />
        <StatCard label="Shoutbox" value={u.activity.shoutboxSent} accent="text-cyan-300" />
        <StatCard label="Profile views" value={u.activity.profileVisits} accent="text-violet-300" />
        <StatCard label="Pastes" value={u.pastesCreated} sub={`${u.pasteViewsTotal} views`} accent="text-teal-300" />
        <StatCard label="Achievements" value={u.achievements} accent="text-amber-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-800/80 bg-black/20 p-2 space-y-1">
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1">Account</div>
          <DetailRow label="Registered" value={formatAnalyticsDate(u.createdAt)} />
          <DetailRow label="Last login" value={formatAnalyticsDate(u.lastLoginAt)} />
          <DetailRow label="Last seen" value={formatAnalyticsDate(u.lastSeenAt)} />
          <DetailRow label="Referrals" value={u.referralsCount} />
          <DetailRow label="Uploads / Memes" value={`${u.imagesUploaded} / ${u.memesCreated}`} />
          <DetailRow label="Profile views (public)" value={u.profileViews} />
          {u.website && <DetailRow label="Website" value={u.website} />}
          <DetailRow label="Changelog read" value={u.activity.changelogLastReadVersion ?? '—'} />
          <DetailRow label="News read" value={u.activity.newsLastReadVersion ?? '—'} />
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-black/20 p-2 space-y-1">
          <div className="text-[7px] font-mono uppercase text-slate-600 mb-1">Event insights</div>
          <DetailRow label="Tracked events" value={ins?.totalEvents ?? 0} />
          <DetailRow label="Sessions" value={ins?.sessionCount ?? 0} />
          <DetailRow label="First event" value={formatAnalyticsDate(ins?.firstEventAt)} />
          <DetailRow label="Last event" value={formatAnalyticsDate(ins?.lastEventAt)} />
          <DetailRow label="Changelog opens" value={u.activity.changelogReads} />
          <DetailRow label="News opens" value={u.activity.newsReads} />
        </div>
      </div>

      {ins?.visitor && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 space-y-1">
          <div className="text-[7px] font-mono uppercase text-cyan-400/80 mb-1">Visitor origin & frequency</div>
          <DetailRow label="Client visit count" value={ins.visitor.maxVisitCount} />
          <DetailRow label="Tracked sessions" value={ins.visitor.sessionCount} />
          {ins.visitor.lastSession && (
            <>
              <DetailRow label="Last referrer domain" value={String(ins.visitor.lastSession.referrerDomain ?? 'direct')} />
              <DetailRow label="Referrer type" value={String(ins.visitor.lastSession.referrerType ?? '—')} />
              <DetailRow label="Referrer URL" value={String(ins.visitor.lastSession.referrer || 'direct')} mono />
              <DetailRow label="Landing path" value={String(ins.visitor.lastSession.landingPath ?? '—')} mono />
              <DetailRow label="Landing URL" value={String(ins.visitor.lastSession.landingUrl ?? '—')} mono />
              <DetailRow label="Return visitor" value={ins.visitor.lastSession.returnVisitor ? 'yes' : 'no'} />
              <DetailRow label="Days since last" value={String(ins.visitor.lastSession.daysSinceLastVisit ?? 0)} />
              <DetailRow label="Device" value={String(ins.visitor.lastSession.deviceType ?? '—')} />
              <DetailRow label="Screen / viewport" value={`${ins.visitor.lastSession.screen ?? '?'} / ${ins.visitor.lastSession.viewport ?? '?'}`} />
              <DetailRow label="Language / TZ" value={`${ins.visitor.lastSession.language ?? '?'} · ${ins.visitor.lastSession.timezone ?? '?'}`} />
              <DetailRow label="Connection" value={String(ins.visitor.lastSession.connection ?? '—')} />
              <DetailRow label="Color scheme" value={String(ins.visitor.lastSession.colorScheme ?? '—')} />
              <DetailRow label="UTM" value={[ins.visitor.lastSession.utmSource, ins.visitor.lastSession.utmMedium, ins.visitor.lastSession.utmCampaign].filter(Boolean).join(' / ') || '—'} />
              <DetailRow label="Ref code" value={String(ins.visitor.lastSession.refCode || '—')} />
              <DetailRow label="Page load ms" value={String(ins.visitor.lastSession.pageLoadMs ?? '—')} />
            </>
          )}
          {ins.visitor.referrerDomains.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {ins.visitor.referrerDomains.map((r) => (
                <span key={r.key} className="px-1.5 py-0.5 rounded border border-cyan-500/20 text-[7px] text-cyan-300">{r.key} ×{r.count}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {ins && ins.tabBreakdown.length > 0 && (
        <div>
          <div className="text-[7px] font-mono text-slate-600 mb-1">Tab hits (from event log)</div>
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {ins.tabBreakdown.map((t) => (
              <React.Fragment key={t.tab}>
                <BarRow label={t.tab} value={t.count} max={maxTab} color="bg-indigo-500" labelWidth="w-20" />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {ins && ins.eventBreakdown.length > 0 && (
        <div>
          <div className="text-[7px] font-mono text-slate-600 mb-1">Event types</div>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {ins.eventBreakdown.map((e) => (
              <React.Fragment key={e.type}>
                <BarRow label={e.type} value={e.count} max={maxEvt} color="bg-amber-500" labelWidth="w-20" />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {u.activity.tabsVisited.length > 0 && (
        <div>
          <div className="text-[7px] font-mono text-slate-600 mb-1">Tabs visited (lifetime)</div>
          <div className="flex flex-wrap gap-1">
            {u.activity.tabsVisited.map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded border border-slate-700 text-[7px] text-slate-400 uppercase">{t}</span>
            ))}
          </div>
        </div>
      )}

      {flagEntries.length > 0 && (
        <div>
          <div className="text-[7px] font-mono text-slate-600 mb-1">Feature flags</div>
          <div className="flex flex-wrap gap-1">
            {flagEntries.map(([k]) => (
              <span key={k} className="px-1.5 py-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 text-[7px] text-emerald-300">{k}</span>
            ))}
          </div>
        </div>
      )}

      {ins && ins.profileTargets.length > 0 && (
        <div>
          <div className="text-[7px] font-mono text-slate-600 mb-1">Profiles viewed</div>
          <div className="flex flex-wrap gap-1">
            {ins.profileTargets.map((p) => (
              <span key={p.target} className="px-1.5 py-0.5 rounded border border-violet-500/20 text-[7px] text-violet-300">
                @{p.target} ×{p.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {ins && ins.recentCommands.length > 0 && (
        <div>
          <div className="text-[7px] font-mono text-slate-600 mb-1">Recent commands</div>
          <div className="space-y-0.5 max-h-20 overflow-y-auto">
            {ins.recentCommands.map((c, i) => (
              <div key={`${c.ts}-${i}`} className="text-[7px] font-mono text-slate-500">
                {formatRelativeTime(c.ts)} · <span className="text-amber-300/90">{c.cmd}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {u.achievementIds.length > 0 && (
        <div>
          <div className="text-[7px] font-mono text-slate-600 mb-1">Achievements ({u.achievementIds.length})</div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {u.achievementIds.map((id) => (
              <span key={id} className="px-1.5 py-0.5 rounded border border-amber-500/20 text-[7px] text-amber-200/90">{id}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[7px] font-mono text-slate-600 mb-1">Event timeline ({selected.recentEvents.length})</div>
        <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
          {selected.recentEvents.map((e) => (
            <React.Fragment key={e.id}>
              <EventRow event={e} detailed />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminAnalyticsPanel() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserActivitySummary['user'][]>([]);
  const [selected, setSelected] = useState<UserActivitySummary | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const loadGenRef = useRef(0);
  const detailGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), search ? 280 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const loadOverview = useCallback(async () => {
    try {
      const ov = await fetchAdminOverview();
      if (mountedRef.current) setOverview(ov);
    } catch (e) {
      if (mountedRef.current) setMsg(e instanceof Error ? e.message : 'Failed to load overview');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setBusy(true);
    try {
      const us = await fetchAdminUserActivity(debouncedSearch, 80);
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setUsers(us.users);
      setMsg('');
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setMsg(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setBusy(false);
    }
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    await Promise.all([loadOverview(), loadUsers()]);
  }, [loadOverview, loadUsers]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  useVisibilityAwarePoll(loadOverview, 20_000);

  const maxTab = useMemo(() => Math.max(...(overview?.tabHits.map((t) => t.count) ?? []), 1), [overview]);

  const openUser = async (id: string) => {
    const gen = ++detailGenRef.current;
    try {
      const detail = await fetchAdminUserDetail(id);
      if (gen !== detailGenRef.current || !mountedRef.current) return;
      setSelected(detail);
    } catch (e) {
      if (gen !== detailGenRef.current || !mountedRef.current) return;
      setMsg(e instanceof Error ? e.message : 'Detail failed');
    }
  };

  const doExport = async () => {
    try {
      const data = await exportAdminAnalytics();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.download = `lul-analytics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      setMsg('Export downloaded');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const doPurge = async () => {
    if (!confirm('Trim old events to 2000?')) return;
    try {
      const r = await purgeAnalyticsEvents(2000);
      setMsg(`${r.removed} events removed (${r.before} → ${r.after})`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Purge failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 flex items-start gap-2">
        <Shield size={14} className="text-violet-400 shrink-0 mt-0.5" />
        <p className="text-[8px] font-mono text-violet-200/80 leading-relaxed">
          {overview?.disclaimer ?? 'Private use'} — local analytics in{' '}
          <code className="text-violet-300/90">data/analytics/</code>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <ActionButton onClick={load} variant="indigo" disabled={busy}>
          <RefreshCw size={12} className="inline mr-1" />
          {busy ? 'Loading…' : 'Refresh'}
        </ActionButton>
        <button type="button" onClick={doExport} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-teal-300">
          <Download size={11} /> Export JSON
        </button>
        <button type="button" onClick={doPurge} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/25 text-[9px] font-mono text-rose-300/80 hover:bg-rose-500/10">
          <Trash2 size={11} /> Purge events
        </button>
        {msg && <span className="text-[9px] font-mono text-teal-400">{msg}</span>}
      </div>

      {overview && (
        <>
          {overview.visitorIntelligence && (
            <VisitorIntelligencePanel vi={overview.visitorIntelligence} />
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <StatCard label="Users" value={overview.totals.users} />
            <StatCard label="Online" value={overview.totals.onlineNow} accent="text-emerald-400" sub="≤5 Min" />
            <StatCard label="Active today" value={overview.totals.activeToday} accent="text-cyan-300" />
            <StatCard label="New (7d)" value={overview.totals.newUsersWeek} accent="text-violet-300" />
            <StatCard label="Events" value={overview.totals.eventsStored} />
            <StatCard label="Page visits" value={overview.engagement.totalPageVisits} accent="text-indigo-300" />
            <StatCard label="Commands" value={overview.engagement.totalCommands} accent="text-amber-300" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ToolCard title="System-Health" icon="🖥️" accent="cyan">
              <div className="space-y-2 text-[9px] font-mono">
                <div className="flex justify-between text-slate-400"><span>Proxy pool</span><span className="text-teal-300">{overview.system.proxyPool.toLocaleString('en-US')}</span></div>
                <div className="flex justify-between text-slate-400"><span>Sources OK/Fail</span><span>{overview.system.proxySourcesOk} / {overview.system.proxySourcesFailed}</span></div>
                <div className="flex justify-between text-slate-400"><span>Checker alive</span><span className="text-emerald-300">{overview.system.proxyAlive}</span></div>
                <div className="flex justify-between text-slate-400"><span>Online minutes Σ</span><span>{overview.engagement.totalOnlineMinutes.toLocaleString('en-US')}</span></div>
                <div className="flex justify-between text-slate-400"><span>Shoutbox Σ</span><span>{overview.engagement.totalShoutbox}</span></div>
                <div className="flex justify-between text-slate-400"><span>Changelog/News Views</span><span>{overview.engagement.changelogViews} / {overview.engagement.newsViews}</span></div>
              </div>
            </ToolCard>

            <ToolCard title="Tab popularity" icon="📊" accent="indigo">
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {overview.tabHits.map((t) => (
                  <React.Fragment key={t.tab}>
                    <BarRow label={t.tab} value={t.count} max={maxTab} color="bg-indigo-500" />
                  </React.Fragment>
                ))}
                {!overview.tabHits.length && <p className="text-[8px] text-slate-600">No tab events yet</p>}
              </div>
            </ToolCard>

            <ToolCard title="Event types" icon="⚡" accent="amber">
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {overview.eventCounts.map((e) => (
                  <React.Fragment key={e.type}>
                    <BarRow label={e.type} value={e.count} max={overview.eventCounts[0]?.count ?? 1} color="bg-amber-500" />
                  </React.Fragment>
                ))}
              </div>
            </ToolCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ToolCard title="Live — online now" icon="🟢" accent="emerald">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {overview.onlineUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openUser(u.id)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-slate-800/60 bg-black/20 hover:border-emerald-500/25 text-left"
                  >
                    <div className="min-w-0">
                      <span className="text-[9px] font-mono text-slate-300">{u.displayName}</span>
                      <span className="text-[8px] font-mono text-slate-600 ml-1">@{u.username}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[7px] font-mono text-emerald-400 uppercase">{u.role}</div>
                      <div className="text-[7px] font-mono text-slate-600">{formatRelativeTime(u.lastSeenAt)}</div>
                    </div>
                  </button>
                ))}
                {!overview.onlineUsers.length && <p className="text-[8px] font-mono text-slate-600 py-4 text-center">Nobody online</p>}
              </div>
            </ToolCard>

            <ToolCard title="Activity feed" icon="📡" accent="violet">
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {overview.recentEvents.slice(0, 30).map((e) => (
                  <React.Fragment key={e.id}>
                    <EventRow event={e} detailed />
                  </React.Fragment>
                ))}
              </div>
            </ToolCard>
          </div>

          {overview.leaderboard.length > 0 && (
            <ToolCard title="Top users by page visits" icon="🏆" accent="amber">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {overview.leaderboard.slice(0, 8).map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openUser(u.id)}
                    className="text-left p-2 rounded-lg border border-slate-800/70 bg-black/20 hover:border-amber-500/25"
                  >
                    <div className="text-[8px] font-mono text-amber-400/80">#{i + 1}</div>
                    <div className="text-[9px] font-mono text-slate-300 truncate">{u.displayName}</div>
                    <div className="text-[7px] font-mono text-slate-600 mt-0.5">
                      {u.activity.pageVisits} visits · {u.activity.commandsRun} cmd · {u.onlineMinutes}m
                    </div>
                  </button>
                ))}
              </div>
            </ToolCard>
          )}

          {overview.dailySeries.length > 0 && (
            <ToolCard title="14-day trend" icon="📈" accent="teal">
              <div className="flex items-end gap-1 h-24">
                {overview.dailySeries.map((d) => {
                  const max = Math.max(...overview.dailySeries.map((x) => x.events), 1);
                  const h = Math.max(4, Math.round((d.events / max) * 88));
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.events} events, ${d.uniqueUsers} users`}>
                      <div className="w-full bg-teal-500/70 rounded-t" style={{ height: h }} />
                      <span className="text-[6px] font-mono text-slate-600 rotate-0 truncate w-full text-center">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </ToolCard>
          )}
        </>
      )}

      <ToolCard title="User tracking" icon="👥" accent="violet">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" size={11} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, username, email…"
              className="w-full pl-7 pr-2 py-1.5 bg-black/40 border border-slate-800 rounded-lg text-[9px] font-mono text-slate-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1 xl:col-span-1">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => openUser(u.id)}
                className={`w-full text-left p-2 rounded-xl border text-[9px] font-mono transition-colors ${
                  selected?.user.id === u.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-slate-800/70 bg-black/20 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="text-slate-300 truncate">{u.displayName}</span>
                  <span className="text-[7px] uppercase shrink-0 text-violet-400/80">{u.role}</span>
                </div>
                <div className="text-slate-600 truncate">@{u.username}{u.email ? ` · ${u.email}` : ''}</div>
                <div className="text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  <span><Activity size={9} className="inline" /> {u.activity.pageVisits}</span>
                  <span><Zap size={9} className="inline" /> {u.activity.commandsRun}</span>
                  <span><Users size={9} className="inline" /> {u.onlineMinutes}m</span>
                  {u.pastesCreated > 0 && <span>📋 {u.pastesCreated}</span>}
                  {u.isOnline && <span className="text-emerald-400">● online</span>}
                </div>
                <div className="text-[7px] text-slate-700 mt-0.5">
                  seen {(u.lastSeenAt || u.lastLoginAt) ? formatRelativeTime(u.lastSeenAt ?? u.lastLoginAt ?? 0) : 'never'}
                </div>
              </button>
            ))}
          </div>

          <div className="xl:col-span-2">
            {selected ? (
              <UserDetailPanel selected={selected} />
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-800 text-[9px] font-mono text-slate-600 min-h-[200px]">
                <BarChart3 size={16} className="mr-2 opacity-40" /> Select a user for full tracking details
              </div>
            )}
          </div>
        </div>
      </ToolCard>
    </div>
  );
}