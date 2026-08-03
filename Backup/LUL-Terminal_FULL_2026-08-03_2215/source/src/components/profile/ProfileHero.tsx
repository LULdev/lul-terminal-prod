/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bot,
  Calendar,
  Check,
  Clock,
  Copy,
  Crown,
  Gamepad2,
  Globe,
  MapPin,
  Share2,
  Shield,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { EarnedAchievement, SocialLink } from '../../data/achievements';
import { SOCIAL_PLATFORMS } from '../../data/achievements';
import { isCoinSensitiveAchievement } from '../../lib/achievementPrivacy';
import { buildProfileUrl } from '../../lib/profileRouting';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import {
  computeArcadeTitle,
  computePersonalityType,
  computeProfileCompletion,
  computeProfileLevel,
  computeSleepStyle,
  computeTenureBadge,
  favoriteGameLabel,
  featuredAchievement,
  formatBirthday,
  formatLastSeen,
  randomFortuneTip,
  resolveCustomization,
} from '../../lib/profileCustomization';
import { computeArcadeSummary } from '../../lib/arcadeStats';
import { ACCENT_THEMES, MOOD_OPTIONS, PROFILE_FRAMES } from '../../types/profileCustomization';
import type { ProfileStats, UserRole } from '../../types/auth';
import { ROLE_LABELS } from '../../types/auth';
import type { ProfileCustomization } from '../../types/profileCustomization';
import { safeHref } from '../../lib/safeHref';
import { safeCoverStyle } from '../../lib/safeCoverStyle';
import { VerifiedBadge } from '../auth/VerifiedBadge';
import { LulCoinDisplay } from '../games/LulCoinDisplay';
import { AdminUsername } from './AdminUsername';
import { LeaderboardBadges } from './LeaderboardBadges';
import './profile.css';

type HeroUser = {
  username: string;
  displayName: string;
  bio: string;
  website: string;
  avatarUrl: string;
  coverUrl: string;
  role: UserRole;
  verified: boolean;
  createdAt: number;
  lastLoginAt?: number | null;
  profileViews: number;
  lulCoins?: number;
  socialLinks: SocialLink[];
  achievements: EarnedAchievement[];
  profileStats?: ProfileStats | null;
  profileCustomization?: ProfileCustomization;
};

const ROLE_BADGE: Record<UserRole, string> = {
  user: 'text-slate-300 border-slate-600/40 bg-slate-800/50',
  vip: 'text-amber-200 border-amber-500/40 bg-amber-500/15',
  admin: 'text-violet-200 border-violet-500/40 bg-violet-500/15',
  bot: 'text-sky-200 border-sky-500/40 bg-sky-500/15',
};

type Props = {
  user: HeroUser;
  isOwn?: boolean;
  showCoins?: boolean;
  onNavigateGames?: () => void;
};

export function ProfileHero({ user, isOwn = false, showCoins = true, onNavigateGames }: Props) {
  const [copied, setCopied] = useState(false);
  const custom = resolveCustomization(user.profileCustomization);
  const theme = ACCENT_THEMES.find((t) => t.id === custom.accentTheme) ?? ACCENT_THEMES[0];
  const frame = PROFILE_FRAMES.find((f) => f.id === custom.profileFrame) ?? PROFILE_FRAMES[0];
  const mood = MOOD_OPTIONS.find((m) => m.id === custom.mood) ?? MOOD_OPTIONS[0];
  const coverStyle = safeCoverStyle(user.coverUrl);
  const earnedIds = new Set((user.achievements ?? []).map((a) => a.id));
  const feat = featuredAchievement(custom, earnedIds);
  const arcade = computeArcadeSummary(user);
  const arcadeTitle = computeArcadeTitle(user);
  const achievementCount = (user.achievements ?? []).length;
  const level = computeProfileLevel(achievementCount);
  const completion = isOwn
    ? computeProfileCompletion(user, custom, { showActivityStats: custom.privacy.showActivityStats })
    : null;
  const tenure = computeTenureBadge(user.createdAt);
  const sleepStyle = computeSleepStyle(user.lastLoginAt);
  const showActivity = custom.privacy.showActivityStats;
  const personality = computePersonalityType(custom, {
    totalGames: showActivity ? arcade.totalGames : 0,
    achievements: achievementCount,
    profileViews: showActivity ? user.profileViews : 0,
  });
  const birthday = formatBirthday(custom.birthdayMonth, custom.birthdayDay);
  const lastSeen = custom._lastSeenAt ?? null;
  const favGame = showActivity ? favoriteGameLabel(custom.favoriteGame) : null;
  const showLastSeen = isOwn || custom.privacy.showLastSeen;
  const profileUrl = buildProfileUrl(user.username);
  const pinned = custom.pinnedSocial
    ? user.socialLinks.find((l) => l.platform === custom.pinnedSocial && l.url?.trim())
    : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const shareProfile = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${user.displayName} on LUL Terminal`, url: profileUrl });
        return;
      } catch { /* fall through */ }
    }
    void copyLink();
  };

  const stats = user.profileStats;
  const online = stats?.isOnline;

  return (
    <section className={`relative overflow-hidden rounded-2xl border border-slate-800/60 bg-[#0c0d12] profile-card-hover`}>
      <div className="h-40 sm:h-52 relative" style={coverStyle}>
        <div className={`profile-hero-mesh bg-gradient-to-br ${theme.gradient}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-[#0c0d12]/50 to-transparent" />
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} to-transparent opacity-50`} />
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-wrap gap-2 justify-end">
        {showCoins && custom.privacy.showCoins && (
          <LulCoinDisplay amount={user.lulCoins ?? 0} size="lg" />
        )}
        <button
          type="button"
          onClick={shareProfile}
          className="profile-glass inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-mono text-slate-300 hover:text-white transition"
        >
          <Share2 size={10} /> Share
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="profile-glass inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-mono text-slate-300 hover:text-white transition"
        >
          {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Link</>}
        </button>
      </div>

      <div className="relative px-4 sm:px-6 pb-5 -mt-16 sm:-mt-20">
        {/* Top-align avatar + identity so name row sits on the same line as the avatar top */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
          <div className={`profile-avatar shrink-0 ${frame.className}`}>
            {/* Animated border only — Anzeigebild stays completely still */}
            <span className="profile-avatar__border" aria-hidden />
            <img
              src={safeAvatarUrl(user.avatarUrl, user.username)}
              alt={user.displayName}
              className="profile-avatar__img"
              draggable={false}
            />
            <span className="profile-avatar__emoji" aria-hidden>{custom.favoriteEmoji}</span>
            {user.role !== 'user' && (
              <span className="profile-avatar__role">
                {user.role === 'admin' && <Shield size={12} className="text-violet-400" />}
                {user.role === 'vip' && <Crown size={12} className="text-amber-400" />}
                {user.role === 'bot' && <Bot size={12} className="text-sky-400" />}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2.5 sm:pt-1">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h2
                className={`profile-display-name text-2xl sm:text-3xl md:text-4xl font-bold truncate tracking-tight ${
                  user.role === 'admin' ? 'profile-display-name--admin' : ''
                }`}
              >
                {user.displayName}
              </h2>
              <VerifiedBadge verified={user.verified} size={22} animated />
              {user.role === 'vip' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/35 bg-amber-500/10 text-[10px] font-mono text-amber-300 uppercase">
                  <Crown size={12} /> VIP
                </span>
              )}
              {user.role === 'bot' && (
                <span className="profile-bot-badge" title="System bot">
                  <Bot size={13} aria-hidden />
                  <span>BOT</span>
                </span>
              )}
              {user.role === 'admin' && (
                <span className="profile-admin-badge" title="Administrator">
                  <Shield size={13} aria-hidden />
                  <span>Admin</span>
                </span>
              )}
              {user.role !== 'user' && user.role !== 'vip' && user.role !== 'bot' && user.role !== 'admin' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-mono uppercase ${ROLE_BADGE[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              )}
            </div>

            {user.role === 'admin' ? (
              <AdminUsername username={user.username} size="lg" />
            ) : (
              <p className="text-sm sm:text-base font-medium text-slate-400 tracking-tight">@{user.username}</p>
            )}

            {(custom.customTitle || custom.tagline) && (
              <p className="text-[11px] text-indigo-200/90 font-medium">
                {custom.customTitle && <span className="text-indigo-300">{custom.customTitle}</span>}
                {custom.customTitle && custom.tagline && <span className="text-slate-600 mx-1.5">·</span>}
                {custom.tagline && <span className="text-slate-400 italic">{custom.tagline}</span>}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[8px] font-mono">
              {custom.pronouns && <span className="profile-glass px-2 py-0.5 rounded-full text-slate-400">{custom.pronouns}</span>}
              {custom.location && custom.privacy.showLocation && (
                <span className="inline-flex items-center gap-1 text-slate-500"><MapPin size={9} /> {custom.location}</span>
              )}
              {custom.timezone && custom.privacy.showLocation && (
                <span className="text-slate-600">{custom.timezone}</span>
              )}
              {showActivity && birthday && <span className="text-slate-500">🎂 {birthday}</span>}
            </div>

            {custom.status.text && (
              <div className="profile-status-pill inline-flex items-center gap-2 px-3 py-1.5 rounded-xl max-w-full">
                <span className="text-base leading-none">{custom.status.emoji}</span>
                <span className="text-[10px] font-mono text-indigo-100 truncate">{custom.status.text}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {showActivity && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-[8px] font-mono text-violet-200">
                  {mood.emoji} {mood.label}
                </span>
              )}
              {showActivity && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-rose-500/25 bg-rose-500/8 text-[8px] font-mono text-rose-200">
                  <Trophy size={9} /> {arcadeTitle}
                </span>
              )}
              {showActivity && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-indigo-500/25 bg-indigo-500/8 text-[8px] font-mono text-indigo-200">
                  Lv.{level.level} {level.label}
                </span>
              )}
              {showActivity && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-700/50 bg-black/20 text-[8px] font-mono text-slate-400">
                  {personality}
                </span>
              )}
              {showActivity && tenure && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-amber-500/25 text-[8px] font-mono text-amber-200">
                  {tenure.emoji} {tenure.label}
                </span>
              )}
              {showActivity && sleepStyle && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-700/50 text-[8px] font-mono text-slate-400">
                  {sleepStyle.emoji} {sleepStyle.label}
                </span>
              )}
              {custom.vibeTag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-cyan-500/25 text-[8px] font-mono text-cyan-200">
                  🎧 {custom.vibeTag}
                </span>
              )}
              {showActivity && favGame && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-emerald-500/25 text-[8px] font-mono text-emerald-200">
                  <Gamepad2 size={9} /> {favGame}
                </span>
              )}
            </div>

            {user.bio && <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">{user.bio}</p>}

            {custom.askMeAbout && (
              <p className="text-[10px] text-slate-500">
                <span className="text-slate-600 font-mono uppercase text-[8px] mr-1.5">Ask me about</span>
                {custom.askMeAbout}
              </p>
            )}

            {custom.funFact && (
              <p className="profile-fortune text-[10px] font-mono text-amber-200/80 px-3 py-2 rounded-lg max-w-xl">
                🎲 Fun fact: {custom.funFact}
              </p>
            )}

            <p className="text-[9px] font-mono text-slate-600 italic">
              🔮 {randomFortuneTip(user.username)}
            </p>

            <LeaderboardBadges
              earned={user.achievements ?? []}
              showActivityStats={showActivity}
              showCoins={showCoins}
              inline
            />

            <div className="flex flex-wrap gap-1.5">
              {user.website && safeHref(user.website.startsWith('http') ? user.website : `https://${user.website}`) && (
                <a href={safeHref(user.website.startsWith('http') ? user.website : `https://${user.website}`)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700/60 bg-black/30 text-[9px] font-mono text-indigo-400 hover:text-indigo-300 transition">
                  <Globe size={10} /> {user.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {user.socialLinks.filter((l) => l.url?.trim()).map((l) => {
                const plat = SOCIAL_PLATFORMS.find((p) => p.id === l.platform);
                const pinned = l.platform === custom.pinnedSocial;
                const linkHref = safeHref(l.url.startsWith('http') ? l.url : `https://${l.url}`);
                if (!linkHref) return null;
                return (
                  <a
                    key={l.platform}
                    href={linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-mono transition ${
                      pinned
                        ? 'border-teal-500/40 bg-teal-500/10 text-teal-200'
                        : 'border-slate-700/60 bg-black/30 text-slate-400 hover:text-teal-300'
                    }`}
                  >
                    <span>{plat?.icon ?? '🔗'}</span>
                    {plat?.label ?? l.platform}
                    {pinned && <span className="text-[7px] text-teal-400">★</span>}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {showActivity && (
          <>
            <div className="mt-3 h-1 rounded-full bg-slate-800/60 overflow-hidden max-w-xs">
              <div className="profile-level-bar h-full rounded-full" style={{ width: `${level.progress}%` }} />
            </div>
            <p className="text-[7px] font-mono text-slate-600 mt-0.5">
              {achievementCount} trophies · next level at {level.nextAt}
            </p>
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {showActivity && (
            <MetaChip icon={<Calendar size={9} />} label="Joined" value={formatDate(user.createdAt)} />
          )}
          {showLastSeen && lastSeen != null && (
            <MetaChip icon={<Clock size={9} />} label="Last seen" value={formatLastSeen(lastSeen)} />
          )}
          {showActivity && (
            <MetaChip icon={<Sparkles size={9} />} label="Views" value={String(user.profileViews)} />
          )}
          {showActivity && showLastSeen && (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[8px] font-mono ${
                online ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300' : 'border-slate-700/50 text-slate-500'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          )}
          {showActivity && stats?.rank && (
            <MetaChip icon={<Trophy size={9} />} label="Rank" value={stats.rank} />
          )}
          {onNavigateGames && (
            <button
              type="button"
              onClick={onNavigateGames}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[8px] font-mono text-rose-200 hover:bg-rose-500/20 transition"
            >
              <Gamepad2 size={10} /> Play games
            </button>
          )}
        </div>

        {showActivity && feat && (showCoins || !isCoinSensitiveAchievement(feat.id)) && (
          <div className="mt-4 profile-glass rounded-xl px-3 py-2.5 flex items-center gap-3">
            <span className="text-2xl">{feat.icon}</span>
            <div className="min-w-0">
              <div className="text-[7px] font-mono uppercase text-amber-400/80 tracking-wider">Featured trophy</div>
              <div className="text-[11px] font-semibold text-amber-100 truncate">{feat.name}</div>
              <div className="text-[8px] font-mono text-slate-500 truncate">{feat.description}</div>
            </div>
          </div>
        )}

        {isOwn && completion && (
          <div className="mt-4 profile-glass rounded-xl px-3 py-2.5">
            <div className="flex justify-between text-[8px] font-mono mb-1.5">
              <span className="text-slate-500 flex items-center gap-1"><Sparkles size={10} /> Profile completion</span>
              <span className="text-indigo-300 font-bold">{completion.percent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
              <div className="profile-level-bar h-full rounded-full transition-all duration-500" style={{ width: `${completion.percent}%` }} />
            </div>
            {completion.missing.length > 0 && completion.percent < 100 && (
              <p className="mt-1.5 text-[7px] font-mono text-slate-600">
                Next: {completion.missing.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function formatDate(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function MetaChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-800/80 bg-black/25 text-[8px] font-mono">
      <span className="text-slate-600">{icon}</span>
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-300 font-semibold">{value}</span>
    </span>
  );
}