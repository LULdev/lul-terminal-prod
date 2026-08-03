/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Award,
  Clock,
  Crown,
  Eye,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  Radio,
  Server,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useFirebaseStats } from '../../hooks/useFirebaseStats';
import { useFirebaseCaughtCount } from '../../hooks/useFirebaseCaughtCount';
import { TOOL_VAULT_CATALOG } from '../../data/toolVault/catalog';
import { ACHIEVEMENT_CATALOG } from '../../data/achievements';
import { CHANGELOG } from '../../data/changelog';
import {
  fetchTerminalStats,
  formatBytes,
  formatRelativeEn,
  formatStatNumber,
  type TerminalStats,
} from '../../lib/terminalStats';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { PageShell } from './PageShell';
import { GreenPulseDot } from '../ui/GreenPulseDot';

export function TerminalStatsPage() {
  const firebase = useFirebaseStats();
  const { caughtCount } = useFirebaseCaughtCount();
  const [stats, setStats] = useState<TerminalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    const gen = ++loadGenRef.current;
    fetchTerminalStats()
      .then((d) => {
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        setStats(d);
        setErr('');
      })
      .catch((e) => {
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        setErr(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  useVisibilityAwarePoll(load, 30_000);

  const c = stats?.community;
  const m = stats?.media;
  const n = stats?.network;
  const v = stats?.vault;
  const ct = stats?.content;
  const l = stats?.labs;
  const a = stats?.analytics;

  return (
    <PageShell
      id="terminal-stats-module"
      pageId="stats"
      icon="📡"
      title="Terminal Pulse"
      subtitle="Live counters · real databases · zero fake data"
      accentClass="text-cyan-400"
    >
      <div className="space-y-5 max-w-5xl">
        {/* Live pulse bar */}
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-[#0c0d12] to-violet-950/30 p-4 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-mono">
              <LiveChip icon={<Globe size={11} />} label="Online now" value={firebase.online} accent="text-emerald-400" />
              <LiveChip icon={<Eye size={11} />} label="Total hits" value={firebase.hits} accent="text-sky-300" />
              <LiveChip icon={<Users size={11} />} label="Unique visitors" value={firebase.unique} accent="text-violet-300" />
              <LiveChip icon={<Zap size={11} />} label="Claw victims" value={caughtCount} accent="text-rose-300" />
            </div>
            {stats && (
              <span className="ml-auto text-[8px] font-mono text-slate-600 flex items-center gap-1.5">
                <GreenPulseDot />
                Updated {formatRelativeEn(stats.generatedAt)} · v{stats.version}
              </span>
            )}
          </div>
        </div>

        {err && (
          <p className="text-[10px] font-mono text-rose-400 p-3 rounded-xl border border-rose-500/20 bg-rose-950/20">{err}</p>
        )}

        {/* Newest member hero */}
        {c?.newestMember && (
          <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-[#0c0d12] to-indigo-950/20 p-5">
            <p className="text-[8px] font-mono uppercase tracking-[0.25em] text-violet-400/80 mb-2">Latest arrival</p>
            <p className="text-base sm:text-lg text-white font-sans leading-snug">
              Our newest member is{' '}
              <span className="font-semibold text-violet-200">{c.newestMember.username}</span>
              {c.newestMember.displayName !== c.newestMember.username && (
                <span className="text-slate-400 text-sm"> ({c.newestMember.displayName})</span>
              )}
            </p>
            <p className="text-[9px] font-mono text-slate-500 mt-2 flex items-center gap-1.5">
              <GreenPulseDot />
              Joined {formatRelativeEn(c.newestMember.joinedAt)} · {formatStatNumber(c.membersJoinedThisWeek)} new this week
            </p>
          </div>
        )}

        {loading && !stats ? (
          <StatsSkeleton />
        ) : stats && (
          <>
            <Section title="Community" icon="👥">
              <StatGrid>
                <StatTile label="Registered members" value={c!.registeredMembers} icon={Users} accent="violet" />
                <StatTile label="Active accounts" value={c!.activeMembers} icon={Activity} accent="emerald" />
                <StatTile label="Online members now" value={c!.membersOnlineNow} icon={Radio} accent="cyan" sub={`${stats.meta.onlineWindowMinutes}m window`} />
                <StatTile label="Active today" value={c!.membersActiveToday} icon={Clock} accent="teal" />
                <StatTile label="Joined this week" value={c!.membersJoinedThisWeek} icon={TrendingUp} accent="sky" />
                <StatTile label="VIP members" value={c!.vipMembers} icon={Crown} accent="amber" />
                <StatTile label="Verified members" value={c!.verifiedMembers} icon={Award} accent="sky" />
                <StatTile label="Total referrals" value={c!.totalReferrals} icon={Sparkles} accent="rose" />
                <StatTile label="Profile views" value={c!.totalProfileViews} icon={Eye} accent="indigo" />
                <StatTile label="Achievements unlocked" value={c!.totalAchievementsUnlocked} icon={Award} accent="amber" sub={`${ACHIEVEMENT_CATALOG.length} available`} />
                <StatTile label="Terminal commands run" value={c!.totalCommandsRun} icon={Terminal} accent="orange" />
                <StatTile label="Member online minutes" value={c!.totalOnlineMinutes} icon={Clock} accent="emerald" />
                <StatTile label="Page visits tracked" value={c!.totalPageVisits} icon={Activity} accent="violet" />
                <StatTile label="Logins today" value={a!.loginsToday} icon={Zap} accent="cyan" />
              </StatGrid>
            </Section>

            <Section title="Member highlights" icon="🏆">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <HighlightCard title="Most profile views" data={c!.topProfileViews} suffix="views" />
                <HighlightCard title="Top referrer" data={c!.topReferrer} suffix="referrals" />
                <HighlightCard title="Top image uploader" data={c!.topUploader} suffix="uploads" />
                <HighlightCard title="Top meme creator" data={c!.topMemeCreator} suffix="memes" />
              </div>
            </Section>

            <Section title="Media & hosting" icon="☁️">
              <StatGrid>
                <StatTile label="Images hosted" value={m!.imagesHosted} icon={ImageIcon} accent="cyan" />
                <StatTile label="Image link views" value={m!.imageViewsTotal} icon={Eye} accent="violet" />
                <StatTile label="Files on disk" value={m!.imageFilesOnDisk} icon={Server} accent="slate" />
                <StatTile label="Storage used" value={formatBytes(m!.imageStorageBytes)} icon={Server} accent="sky" raw />
                <StatTile label="Member uploads total" value={m!.totalMemberUploads} icon={ImageIcon} accent="rose" />
                <StatTile label="Memes created" value={m!.totalMemesCreated} icon={Sparkles} accent="amber" />
              </StatGrid>
              {m!.topImage && (
                <p className="text-[9px] font-mono text-slate-500 mt-2 px-1">
                  Most viewed image: <span className="text-cyan-300">{m.topImage.name}</span> · {formatStatNumber(m.topImage.views)} views
                </p>
              )}
            </Section>

            <Section title="Network & proxies" icon="🗄️">
              <StatGrid>
                <StatTile label="Proxies in database" value={n!.proxiesInDatabase} icon={Globe} accent="indigo" />
                <StatTile label="Working proxies" value={n!.proxiesWorking} icon={Zap} accent="emerald" />
                <StatTile label="Currently offline" value={n!.proxiesOffline} icon={Server} accent="rose" />
                <StatTile label="Ever collected" value={n!.proxiesEverCollected} icon={TrendingUp} accent="violet" />
                <StatTile label="Scraper pool size" value={n!.scraperPoolSize} icon={Radio} accent="cyan" />
                <StatTile label="Healthy sources" value={n!.scraperSourcesOk} icon={Activity} accent="teal" />
                <StatTile label="Checker alive" value={n!.checkerAlive} icon={Eye} accent="sky" />
              </StatGrid>
              {Object.keys(n!.proxyTypesWorking).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                  {Object.entries(n!.proxyTypesWorking).filter(([, v]) => Number(v) > 0).map(([type, count]) => (
                    <span key={type} className="px-2 py-0.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-[8px] font-mono text-indigo-300 uppercase">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Premium vault" icon="👑">
              <StatGrid cols={3}>
                <StatTile label="Premium accounts" value={v!.premiumAccounts} icon={Crown} accent="amber" />
                <StatTile label="Free premium accounts" value={v!.freeAccounts} icon={Sparkles} accent="emerald" />
                <StatTile label="Vault total" value={v!.vaultTotal} icon={Award} accent="violet" />
              </StatGrid>
            </Section>

            <Section title="Content & terminal" icon="📰">
              <StatGrid>
                <StatTile label="News articles" value={ct!.newsArticles} icon={MessageSquare} accent="sky" sub={`feed ${ct!.newsFeedVersion}`} />
                <StatTile label="News views" value={ct!.newsViews} icon={Eye} accent="cyan" />
                <StatTile label="Changelog releases" value={ct!.changelogReleases || CHANGELOG.length} icon={Terminal} accent="indigo" />
                <StatTile label="Changelog views" value={ct!.changelogViews} icon={Eye} accent="violet" />
                <StatTile label="Shoutbox messages" value={ct!.shoutboxMessagesStored} icon={MessageSquare} accent="teal" />
                <StatTile label="Shoutbox sent (tracked)" value={ct!.shoutboxSentByMembers} icon={Radio} accent="emerald" />
                <StatTile label="Analytics events" value={a!.eventsStored} icon={Activity} accent="rose" />
                <StatTile label="Micro-tools available" value={TOOL_VAULT_CATALOG.length} icon={Terminal} accent="orange" />
                <StatTile label="Persona DB entries" value={l!.personaEntries} icon={Users} accent="violet" />
                <StatTile label="Persona countries" value={l!.personaCountries} icon={Globe} accent="sky" />
              </StatGrid>
              {a!.topTabVisited && (
                <p className="text-[9px] font-mono text-slate-500 mt-2 px-1">
                  Most visited tab: <span className="text-cyan-300">{a.topTabVisited.tab}</span> · {formatStatNumber(a.topTabVisited.count)} visits
                </p>
              )}
            </Section>
          </>
        )}
      </div>
    </PageShell>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{icon}</span>
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">{title}</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent" />
      </div>
      {children}
    </div>
  );
}

function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass = cols === 3 ? 'sm:grid-cols-3' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4';
  return <div className={`grid grid-cols-2 ${colClass} gap-2`}>{children}</div>;
}

const ACCENT_MAP: Record<string, string> = {
  violet: 'border-violet-500/20 bg-violet-500/[0.06]',
  emerald: 'border-emerald-500/20 bg-emerald-500/[0.06]',
  cyan: 'border-cyan-500/20 bg-cyan-500/[0.06]',
  teal: 'border-teal-500/20 bg-teal-500/[0.06]',
  sky: 'border-sky-500/20 bg-sky-500/[0.06]',
  amber: 'border-amber-500/20 bg-amber-500/[0.06]',
  rose: 'border-rose-500/20 bg-rose-500/[0.06]',
  indigo: 'border-indigo-500/20 bg-indigo-500/[0.06]',
  orange: 'border-orange-500/20 bg-orange-500/[0.06]',
  slate: 'border-slate-600/30 bg-slate-800/20',
};

function StatTile({
  label, value, icon: Icon, accent, sub, raw,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: keyof typeof ACCENT_MAP;
  sub?: string;
  raw?: boolean;
}) {
  const box = ACCENT_MAP[accent] ?? ACCENT_MAP.slate;
  const text = ACCENT_TEXT[accent] ?? 'text-slate-300';
  const display = raw ? value : typeof value === 'number' ? formatStatNumber(value) : value;
  return (
    <div className={`rounded-xl border p-3 transition hover:scale-[1.01] ${box}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={11} className={text} />
        <span className="text-[7px] font-mono text-slate-600 uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <div className={`text-lg font-mono font-bold tabular-nums ${text}`}>{display}</div>
      {sub && <div className="text-[7px] font-mono text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

const ACCENT_TEXT: Record<string, string> = {
  violet: 'text-violet-300',
  emerald: 'text-emerald-300',
  cyan: 'text-cyan-300',
  teal: 'text-teal-300',
  sky: 'text-sky-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  indigo: 'text-indigo-300',
  orange: 'text-orange-300',
  slate: 'text-slate-300',
};

function HighlightCard({
  title, data, suffix,
}: {
  title: string;
  data: { username: string; displayName: string; value: number } | null;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/25 p-3 hover:border-slate-700 transition">
      <div className="text-[8px] font-mono text-slate-600 uppercase tracking-wide mb-1">{title}</div>
      {data ? (
        <>
          <div className="text-[11px] font-semibold text-slate-200">{data.username}</div>
          <div className="text-[9px] font-mono text-slate-500">{formatStatNumber(data.value)} {suffix}</div>
        </>
      ) : (
        <div className="text-[9px] font-mono text-slate-600">No data yet</div>
      )}
    </div>
  );
}

function LiveChip({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${accent}`}>
      {icon}
      <span className="text-slate-500">{label}</span>
      <span className="font-bold tabular-nums">{formatStatNumber(value)}</span>
    </span>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-slate-800/40 animate-pulse" />
      ))}
    </div>
  );
}