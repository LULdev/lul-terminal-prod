/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import { Activity, RefreshCw, Server, Users, Wifi } from 'lucide-react';
import { fetchTerminalStats, type TerminalStats } from '../../lib/adminModules';
import { formatBytes, formatRelativeEn, formatStatNumber } from '../../lib/terminalStats';
import { ToolCard } from '../pages/PageShell';

function PulseStat({ label, value, sub, accent = 'text-slate-200' }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-black/30 px-3 py-2.5">
      <div className="text-[7px] font-mono uppercase text-slate-600 tracking-wider">{label}</div>
      <div className={`text-base font-mono font-bold tabular-nums ${accent}`}>
        {typeof value === 'number' ? formatStatNumber(value) : value}
      </div>
      {sub && <div className="text-[7px] font-mono text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <ToolCard title={title} icon={icon} accent="violet">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{children}</div>
    </ToolCard>
  );
}

export function AdminSystemPulsePanel() {
  const [stats, setStats] = useState<TerminalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (background = false) => {
    const gen = ++loadGenRef.current;
    setError('');
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await fetchTerminalStats();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setStats(next);
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
      setStats(null);
    } finally {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useVisibilityAwarePoll(() => { void load(true); }, 30_000);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono text-slate-500 max-w-xl">
          Live terminal pulse — community, media, network, vault & analytics in real time.
          Auto-refresh every 30s.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-400 hover:text-violet-300"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[9px] font-mono text-rose-300">
          {error}
        </div>
      )}

      {stats && (
        <>
          <div className="flex items-center gap-2 text-[8px] font-mono text-slate-600">
            <Activity size={12} className="text-emerald-400" />
            v{stats.version} · {formatRelativeEn(stats.generatedAt)} · online window {stats.meta.onlineWindowMinutes}m
          </div>

          <Section title="Community" icon="👥">
            <PulseStat label="Registered" value={stats.community.registeredMembers} accent="text-slate-200" />
            <PulseStat label="Online now" value={stats.community.membersOnlineNow} accent="text-emerald-400" />
            <PulseStat label="Active today" value={stats.community.membersActiveToday} accent="text-cyan-300" />
            <PulseStat label="Joined week" value={stats.community.membersJoinedThisWeek} accent="text-violet-300" />
            <PulseStat label="VIP" value={stats.community.vipMembers} accent="text-amber-300" />
            <PulseStat label="Verified" value={stats.community.verifiedMembers} accent="text-sky-300" />
            <PulseStat label="Referrals" value={stats.community.totalReferrals} />
            <PulseStat label="Profile views" value={stats.community.totalProfileViews} />
          </Section>

          <Section title="Media & Content" icon="🖼️">
            <PulseStat label="Images hosted" value={stats.media.imagesHosted} accent="text-teal-300" />
            <PulseStat label="Image views" value={stats.media.imageViewsTotal} />
            <PulseStat label="Storage" value={formatBytes(stats.media.imageStorageBytes)} accent="text-orange-300" />
            <PulseStat label="Memes" value={stats.media.totalMemesCreated} />
            <PulseStat label="News articles" value={stats.content.newsArticles} />
            <PulseStat label="Changelog views" value={stats.content.changelogViews} />
            <PulseStat label="Shoutbox msgs" value={stats.content.shoutboxMessagesStored} accent="text-rose-300" />
            <PulseStat label="Vault total" value={stats.vault.vaultTotal} accent="text-amber-200" />
          </Section>

          <Section title="Network & Labs" icon="🌐">
            <PulseStat label="Proxies DB" value={stats.network.proxiesInDatabase} accent="text-cyan-300" />
            <PulseStat label="Working" value={stats.network.proxiesWorking} accent="text-emerald-400" />
            <PulseStat label="Checker alive" value={stats.network.checkerAlive} />
            <PulseStat label="Scraper pool" value={stats.network.scraperPoolSize} />
            <PulseStat label="Persona entries" value={stats.labs.personaEntries} accent="text-violet-300" />
            <PulseStat label="Events stored" value={stats.analytics.eventsStored} />
            <PulseStat
              label="Top tab"
              value={stats.analytics.topTabVisited?.tab ?? '—'}
              sub={stats.analytics.topTabVisited ? `${stats.analytics.topTabVisited.count} hits` : undefined}
            />
            <PulseStat label="Logins today" value={stats.analytics.loginsToday} accent="text-emerald-300" />
          </Section>

          {(stats.community.newestMember || stats.community.topProfileViews) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {stats.community.newestMember && (
                <div className="rounded-xl border border-slate-800/80 bg-black/25 p-3 flex items-center gap-3">
                  <Users size={16} className="text-violet-400 shrink-0" />
                  <div>
                    <div className="text-[7px] font-mono uppercase text-slate-600">Newest member</div>
                    <div className="text-[10px] font-mono text-slate-200">{stats.community.newestMember.displayName}</div>
                    <div className="text-[8px] font-mono text-slate-600">@{stats.community.newestMember.username}</div>
                  </div>
                </div>
              )}
              {stats.community.topProfileViews && (
                <div className="rounded-xl border border-slate-800/80 bg-black/25 p-3 flex items-center gap-3">
                  <Server size={16} className="text-cyan-400 shrink-0" />
                  <div>
                    <div className="text-[7px] font-mono uppercase text-slate-600">Top profile views</div>
                    <div className="text-[10px] font-mono text-slate-200">{stats.community.topProfileViews.displayName}</div>
                    <div className="text-[8px] font-mono text-emerald-400">{formatStatNumber(stats.community.topProfileViews.value)} views</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {stats.network.lastProxyCheckAt && (
            <div className="text-[8px] font-mono text-slate-600 flex items-center gap-1.5">
              <Wifi size={11} /> Last proxy check: {formatRelativeEn(stats.network.lastProxyCheckAt)}
            </div>
          )}
        </>
      )}
    </div>
  );
}