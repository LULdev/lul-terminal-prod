/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Eye,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Newspaper,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { profileViewsMilestone } from '../../lib/profileCustomization';
import type { ProfileStats, ReportedNotWorkingAccount } from '../../types/auth';

type Props = {
  profileViews: number;
  imagesUploaded: number;
  pastesCreated?: number;
  pasteViewsTotal?: number;
  memesCreated: number;
  changelogReads?: number;
  newsReads?: number;
  referralsCount: number;
  email?: string;
  showEmail?: boolean;
  profileStats?: ProfileStats | null;
  reportedAccounts?: ReportedNotWorkingAccount[];
  isPublic?: boolean;
  showModeration?: boolean;
};

function formatDate(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProfileOverviewTab({
  profileViews,
  imagesUploaded,
  pastesCreated = 0,
  pasteViewsTotal = 0,
  memesCreated,
  changelogReads = 0,
  newsReads = 0,
  referralsCount,
  email,
  showEmail,
  profileStats,
  reportedAccounts = [],
  isPublic = false,
  showModeration = false,
}: Props) {
  const [vaultOpen, setVaultOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const viewsMilestone = profileViewsMilestone(profileViews);
  const s = profileStats ?? {
    premiumAccounts: 0,
    freeAccounts: 0,
    abuseWarnings: 0,
    shoutboxMessages: 0,
    isOnline: false,
    onlineMinutes: 0,
    rank: 'USER',
  };

  const statCards = [
    { icon: <Eye size={12} />, label: 'Profile views', value: profileViews, accent: 'text-indigo-300', sub: `Next milestone: ${viewsMilestone.next}` },
    { icon: <ImageIcon size={12} />, label: 'Uploads', value: imagesUploaded, accent: 'text-sky-300' },
    { icon: <FileText size={12} />, label: 'Pastes', value: pastesCreated, accent: 'text-teal-300', sub: `${pasteViewsTotal} views` },
    { icon: <Sparkles size={12} />, label: 'Memes', value: memesCreated, accent: 'text-violet-300' },
    { icon: <FileText size={12} />, label: 'Changelog', value: changelogReads, accent: 'text-slate-300' },
    { icon: <Newspaper size={12} />, label: 'News', value: newsReads, accent: 'text-slate-300' },
    { icon: <Users size={12} />, label: 'Referrals', value: referralsCount, accent: 'text-emerald-300' },
    { icon: <MessageSquare size={12} />, label: 'Shoutbox', value: s.shoutboxMessages, accent: 'text-cyan-300' },
  ];

  return (
    <div className="space-y-3">
      <div className="profile-glass rounded-2xl p-4">
        <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">Activity snapshot</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {statCards.map((c) => (
            <div key={c.label} className="profile-card-hover rounded-xl border border-slate-800/60 bg-black/20 px-3 py-2.5">
              <div className="flex items-center gap-1 text-slate-600 mb-1">{c.icon}<span className="text-[7px] font-mono uppercase">{c.label}</span></div>
              <div className={`text-lg font-mono font-bold tabular-nums ${c.accent}`}>{c.value}</div>
              {c.sub && <div className="text-[7px] font-mono text-slate-600 mt-0.5">{c.sub}</div>}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[7px] font-mono text-slate-600 mb-1">
            <span>Profile views milestone</span>
            <span>{profileViews} / {viewsMilestone.next}</span>
          </div>
          <div className="h-1 rounded-full bg-slate-800/80 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500/70" style={{ width: `${viewsMilestone.progress}%` }} />
          </div>
        </div>
        {showEmail && email && (
          <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-800/80 bg-black/20 text-[9px] font-mono text-slate-400">
            <Mail size={10} /> {email}
          </div>
        )}
      </div>

      <Collapsible
        open={vaultOpen}
        onToggle={() => setVaultOpen((v) => !v)}
        title="Premium Vault"
        icon={<Send size={12} className="text-emerald-400" />}
        accent="emerald"
      >
        <div className="grid grid-cols-2 gap-2">
          <VaultTile label="Premium" value={s.premiumAccounts} emoji="✅" color="text-emerald-300" />
          <VaultTile label="Free" value={s.freeAccounts} emoji="💩" color="text-lime-300" />
        </div>
      </Collapsible>

      {showModeration && (
        <Collapsible
          open={activityOpen}
          onToggle={() => setActivityOpen((v) => !v)}
          title="Moderation & presence"
          icon={<AlertTriangle size={12} className="text-rose-400" />}
          accent="rose"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
              <div className="text-[7px] font-mono uppercase text-slate-500">Warnings</div>
              <div className="text-lg font-mono font-bold text-rose-400">{s.abuseWarnings}</div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/15 px-3 py-2">
              <div className="text-[7px] font-mono uppercase text-slate-500">Online time</div>
              <div className="text-lg font-mono font-bold text-cyan-300">{formatMinutes(s.onlineMinutes)}</div>
            </div>
          </div>
        </Collapsible>
      )}

      {reportedAccounts.length > 0 && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-4">
          <h4 className="text-[10px] font-mono font-bold uppercase text-rose-300 mb-2">Reported not working</h4>
          <div className="space-y-1.5">
            {reportedAccounts.map((a) => (
              <div key={a.accountId} className="flex justify-between gap-2 rounded-lg border border-rose-500/10 bg-black/20 px-2.5 py-2 text-[9px] font-mono">
                <span className="text-slate-300 truncate">{a.service}</span>
                <span className="text-slate-600 shrink-0">{formatDate(a.acceptedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VaultTile({ label, value, emoji, color }: { label: string; value: number; emoji: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-black/20 px-3 py-2 flex justify-between items-center">
      <span className="text-[9px] font-mono text-slate-500">{label}</span>
      <span className={`text-sm font-mono font-bold ${color}`}>{value} {emoji}</span>
    </div>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Collapsible({
  open,
  onToggle,
  title,
  icon,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  icon: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="profile-glass rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/[0.02] transition"
      >
        <span className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase text-slate-400">
          {icon} {title}
        </span>
        <ChevronDown size={14} className={`text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}