/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Archive, Check, Crown, Gamepad2, LogOut, Settings, Sparkles, Trophy, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as authApi from '../../lib/auth';
import { LOGOUT_ARCADE_BLOCKED } from '../../lib/authMessages';
import { filterAchievementsForPrivacyPreview } from '../../lib/achievementPrivacy';
import { resolveCustomization } from '../../lib/profileCustomization';
import { SOCIAL_PLATFORMS, type SocialLink } from '../../data/achievements';
import type { PublicProfile } from '../../types/auth';
import { DEFAULT_PROFILE_CUSTOMIZATION, type ProfileCustomization } from '../../types/profileCustomization';
import { ActionButton, PageShell } from './PageShell';
import { AchievementShowcase } from '../profile/AchievementShowcase';
import { ArcadeStatsPanel } from '../profile/ArcadeStatsPanel';
import { LeaderboardBadges } from '../profile/LeaderboardBadges';
import { UnlockedAwards } from '../profile/UnlockedAwards';
import { ProfileHero } from '../profile/ProfileHero';
import { ProfileOverviewTab } from '../profile/ProfileOverviewTab';
import { ProfileSettingsTab } from '../profile/ProfileSettingsTab';
import { DailyBonusCard } from '../games/DailyBonusCard';
import { LulCoinAmount } from '../games/LulCoinAmount';
import { CoinEarningsFeed } from '../games/CoinEarningsFeed';
import {
  fetchGamesLeaderboard,
  fetchGamesStateRead,
  type DailyBonusInfo,
  type GamesLeaderboard,
  type GamesState,
} from '../../lib/games';
import '../profile/profile.css';

type ProfilePageProps = {
  routeUsername?: string;
  /** Increments after profile tab_visit analytics completes (logged-in viewers). */
  profileTabReadyTick?: number;
  onNavigateTab?: (tab: string) => void;
};

type ProfileTab = 'overview' | 'arcade' | 'trophies' | 'vault' | 'settings';

const TABS: { id: ProfileTab; label: string; icon: React.ReactNode; ownOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: <User size={12} /> },
  { id: 'arcade', label: 'Arcade', icon: <Gamepad2 size={12} /> },
  { id: 'trophies', label: 'Trophies', icon: <Trophy size={12} /> },
  { id: 'vault', label: 'Vault', icon: <Archive size={12} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={12} />, ownOnly: true },
];

export function ProfilePage({ routeUsername, profileTabReadyTick = 0, onNavigateTab }: ProfilePageProps) {
  const { user, refresh, logout, openAuth, isLoggedIn, loading: authLoading, permissions, handleUnlocks } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [customization, setCustomization] = useState<ProfileCustomization>(DEFAULT_PROFILE_CUSTOMIZATION);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<React.ReactNode>('');

  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');
  const [profileTabFallback, setProfileTabFallback] = useState(false);
  const [dailyBonus, setDailyBonus] = useState<DailyBonusInfo | null>(null);
  const [gamesState, setGamesState] = useState<GamesState | null>(null);
  const [gamesLeaderboard, setGamesLeaderboard] = useState<GamesLeaderboard | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  const arcadeLoadGenRef = useRef(0);
  const [gamesError, setGamesError] = useState('');
  const [coinFeedTick, setCoinFeedTick] = useState(0);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewAchievements = useMemo(() => {
    if (!user || routeUsername?.toLowerCase() !== user.username?.toLowerCase()) return [];
    return filterAchievementsForPrivacyPreview(user.achievements ?? [], {
      showActivityStats: customization.privacy.showActivityStats,
      showCoins: customization.privacy.showCoins,
    });
  }, [user, routeUsername, customization.privacy.showActivityStats, customization.privacy.showCoins]);

  const flashSuccess = useCallback((message: React.ReactNode) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccess(message);
    successTimerRef.current = setTimeout(() => {
      setSuccess('');
      successTimerRef.current = null;
    }, 3000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const isOwnProfile = Boolean(
    isLoggedIn && user && routeUsername
    && user.username.toLowerCase() === routeUsername.toLowerCase(),
  );

  React.useEffect(() => {
    if (!user || !isOwnProfile) return;
    setDisplayName(user.displayName);
    setBio(user.bio);
    setWebsite(user.website ?? '');
    setEmail(user.email);
    setAvatarUrl(user.avatarUrl);
    setCoverUrl(user.coverUrl);
    setSocialLinks(user.socialLinks ?? []);
    setCustomization(resolveCustomization(user.profileCustomization));
  }, [user?.id, user?.updatedAt, isOwnProfile]);

  React.useEffect(() => {
    if (!isLoggedIn || isOwnProfile || !routeUsername || profileTabReadyTick > 0) {
      setProfileTabFallback(false);
      return;
    }
    const t = setTimeout(() => setProfileTabFallback(true), 10_000);
    return () => clearTimeout(t);
  }, [isLoggedIn, isOwnProfile, routeUsername, profileTabReadyTick]);

  React.useEffect(() => {
    if (!routeUsername || isOwnProfile) {
      setPublicProfile(null);
      setPublicError('');
      return;
    }
    if (isLoggedIn && !profileTabReadyTick && !profileTabFallback) {
      setPublicLoading(true);
      setPublicError('');
      return;
    }
    let cancelled = false;
    setPublicLoading(true);
    setPublicError('');
    const load = isLoggedIn && (profileTabReadyTick > 0 || profileTabFallback)
      ? authApi.recordProfileView(routeUsername, {
          skipDwell: profileTabReadyTick > 0 || profileTabFallback,
        })
      : authApi.fetchPublicProfile(routeUsername).then((profile) => ({ user: profile, credited: false as const }));
    load
      .then(({ user: profile, credited }) => {
        if (!cancelled) {
          setPublicProfile(profile);
        }
      })
      .catch((e) => {
        if (!cancelled) setPublicError(e instanceof Error ? e.message : 'Profile not found');
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });
    return () => { cancelled = true; };
  }, [routeUsername, isOwnProfile, isLoggedIn, profileTabReadyTick, profileTabFallback]);

  React.useEffect(() => {
    if (!isOwnProfile || !isLoggedIn || authLoading || !customization.privacy.showCoins) {
      setDailyBonus(null);
      return;
    }
    if (activeTab === 'arcade' && customization.privacy.showActivityStats) return;
    let cancelled = false;
    fetchGamesStateRead()
      .then((s) => {
        if (!cancelled) setDailyBonus(s.dailyBonus);
      })
      .catch(() => {
        if (!cancelled) setDailyBonus(null);
      });
    return () => { cancelled = true; };
  }, [isOwnProfile, isLoggedIn, authLoading, customization.privacy.showCoins, activeTab, customization.privacy.showActivityStats]);

  React.useEffect(() => {
    if (!isOwnProfile || !isLoggedIn || authLoading || activeTab !== 'arcade' || !customization.privacy.showActivityStats) return;
    const gen = ++arcadeLoadGenRef.current;
    setGamesLoading(true);
    setGamesError('');
    Promise.all([fetchGamesStateRead(), fetchGamesLeaderboard()])
      .then(([s, lb]) => {
        if (gen !== arcadeLoadGenRef.current) return;
        setGamesState(s);
        setGamesLeaderboard(lb);
        if (customization.privacy.showCoins) setDailyBonus(s.dailyBonus);
      })
      .catch((e) => {
        if (gen !== arcadeLoadGenRef.current) return;
        setGamesError(e instanceof Error ? e.message : 'Failed to load arcade stats');
        setGamesState(null);
        setGamesLeaderboard(null);
      })
      .finally(() => {
        if (gen === arcadeLoadGenRef.current) setGamesLoading(false);
      });
  }, [isOwnProfile, isLoggedIn, authLoading, activeTab, customization.privacy.showActivityStats, customization.privacy.showCoins]);

  React.useEffect(() => {
    if (!isOwnProfile || !isLoggedIn || authLoading || activeTab !== 'arcade' || !customization.privacy.showActivityStats) return;
    if (coinFeedTick === 0) return;
    const gen = ++arcadeLoadGenRef.current;
    fetchGamesStateRead()
      .then((s) => { if (gen === arcadeLoadGenRef.current) setGamesState(s); })
      .catch(() => { if (gen === arcadeLoadGenRef.current) setGamesState(null); });
  }, [coinFeedTick, isOwnProfile, isLoggedIn, authLoading, activeTab, customization.privacy.showActivityStats]);

  if (!routeUsername) {
    return (
      <PageShell id="profile-module" pageId="profile" icon="👤" title="Profile" subtitle="Profile URL: /profile/username" accentClass="text-indigo-400">
        <div className="flex items-center justify-center min-h-[280px] text-center">
          <p className="text-[10px] font-mono text-slate-500">No username in the URL.</p>
        </div>
      </PageShell>
    );
  }

  if (!isOwnProfile) {
    return (
      <PublicProfileView
        username={routeUsername}
        profile={publicProfile}
        loading={publicLoading}
        error={publicError}
        isLoggedIn={isLoggedIn}
        onLogin={() => openAuth('login')}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    const emailChanged = email.trim().toLowerCase() !== user.email.trim().toLowerCase();
    if (emailChanged && !currentPassword) {
      setError('Current password required to change email');
      setSaving(false);
      return;
    }
    try {
      const result = await authApi.updateProfile({
        displayName,
        bio,
        website,
        email,
        avatarUrl,
        coverUrl,
        socialLinks: socialLinks.filter((l) => l.url.trim()),
        profileCustomization: customization,
        ...((password || emailChanged) ? { currentPassword } : {}),
        ...(password ? { password } : {}),
      });
      handleUnlocks(result.newUnlocks ?? [], result.unlockRewards);
      setCustomization(resolveCustomization(result.user.profileCustomization));
      await refresh();
      setPassword('');
      setCurrentPassword('');
      flashSuccess(<span className="inline-flex items-center gap-1"><Check size={11} /> Profile saved</span>);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    setError('');
    try {
      const result = await authApi.uploadAvatar(file);
      setAvatarUrl(result.user.avatarUrl);
      handleUnlocks(result.newUnlocks ?? [], result.unlockRewards);
      await refresh();
      flashSuccess('Avatar uploaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <PageShell id="profile-module" pageId="profile" icon="👤" title="Profile" subtitle={`@${user.username}`} accentClass="text-indigo-400">
      <div className="max-w-5xl mx-auto space-y-4 profile-scroll-area max-h-[calc(100dvh-8rem)] pr-1">
        <ProfileHero
          user={{
            ...user,
            displayName: displayName || user.displayName,
            bio,
            website,
            avatarUrl: avatarUrl || user.avatarUrl,
            coverUrl,
            socialLinks,
            profileCustomization: customization,
          }}
          isOwn
          showCoins={customization.privacy.showCoins}
          onNavigateGames={onNavigateTab ? () => onNavigateTab('games') : undefined}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            <nav className="profile-glass rounded-2xl p-2 space-y-0.5" aria-label="Profile sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  aria-current={activeTab === t.id ? 'page' : undefined}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-mono transition ${
                    activeTab === t.id ? 'profile-tab-active' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </nav>

            {dailyBonus && customization.privacy.showCoins && (
              <DailyBonusCard
                bonus={dailyBonus}
                compact
                onClaimed={(coins, amount) => {
                  void refresh();
                  setCoinFeedTick((t) => t + 1);
                  flashSuccess(
                    customization.privacy.showCoins
                      ? (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          <LulCoinAmount amount={amount} variant="earn" size="xs" suffix="LULcoins" />
                          — <LulCoinAmount amount={coins} variant="balance" size="xs" suffix={false} />
                        </span>
                      )
                      : 'Daily reload claimed',
                  );
                }}
                onError={(message) => setError(message)}
              />
            )}

            <div className="profile-glass rounded-xl p-3 space-y-2">
              <div className="text-[8px] font-mono uppercase text-slate-600 flex items-center gap-1"><Sparkles size={10} /> Perks</div>
              <PermRow label="Premium view" active={permissions.premiumView} />
              <PermRow label="Submit accounts" active={permissions.premiumSubmit} />
              <PermRow label="Verified" active={permissions.isVerified} />
              <PermRow label="Admin" active={permissions.admin} />
            </div>

            {user.role === 'vip' && (
              <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 to-[#0c0d12] p-3">
                <div className="flex items-center gap-2 text-amber-300 text-[10px] font-semibold"><Crown size={13} /> VIP active</div>
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                const ok = await logout();
                if (!ok) setError(LOGOUT_ARCADE_BLOCKED);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-800 bg-[#161a24] text-[10px] font-mono text-slate-400 hover:text-slate-200 transition"
            >
              <LogOut size={12} /> Sign out
            </button>
          </aside>

          <main className="min-w-0 space-y-3">
            {(error || success) && (
              <div className="space-y-2">
                {error && (
                  <div className="profile-glass rounded-xl px-3 py-2 text-[10px] font-mono text-rose-400">{error}</div>
                )}
                {success && activeTab !== 'settings' && (
                  <div className="profile-glass rounded-xl px-3 py-2 text-[10px] font-mono text-emerald-400">{success}</div>
                )}
              </div>
            )}
            {activeTab === 'overview' && customization.privacy.showActivityStats && (
              <ProfileOverviewTab
                profileViews={user.profileViews ?? 0}
                imagesUploaded={user.imagesUploaded ?? 0}
                pastesCreated={user.pastesCreated}
                pasteViewsTotal={user.pasteViewsTotal}
                memesCreated={user.memesCreated ?? 0}
                changelogReads={user.changelogReads}
                newsReads={user.newsReads}
                referralsCount={user.referralsCount ?? 0}
                email={email}
                showEmail={customization.privacy.showEmail}
                profileStats={user.profileStats}
                reportedAccounts={user.reportedNotWorkingAccounts}
                showModeration
              />
            )}

            {activeTab === 'overview' && !customization.privacy.showActivityStats && (
              <div className="profile-glass rounded-2xl p-6 text-center text-[10px] font-mono text-slate-500">
                Activity stats are hidden from your public profile — this is what visitors see on Overview.
              </div>
            )}

            {activeTab === 'arcade' && customization.privacy.showActivityStats && gamesLoading && (
              <div className="profile-glass rounded-2xl p-8 text-center text-[10px] font-mono text-slate-500 animate-pulse">
                Loading arcade stats…
              </div>
            )}

            {activeTab === 'arcade' && customization.privacy.showActivityStats && gamesError && !gamesLoading && (
              <div className="profile-glass rounded-2xl p-4 text-center space-y-2">
                <p className="text-[10px] font-mono text-rose-400">{gamesError}</p>
                <button
                  type="button"
                  onClick={() => {
                    const gen = ++arcadeLoadGenRef.current;
                    setGamesError('');
                    setGamesLoading(true);
                    Promise.all([fetchGamesStateRead(), fetchGamesLeaderboard()])
                      .then(([s, lb]) => {
                        if (gen !== arcadeLoadGenRef.current) return;
                        setGamesState(s);
                        setGamesLeaderboard(lb);
                      })
                      .catch((e) => {
                        if (gen !== arcadeLoadGenRef.current) return;
                        setGamesError(e instanceof Error ? e.message : 'Failed to load arcade stats');
                        setGamesState(null);
                        setGamesLeaderboard(null);
                      })
                      .finally(() => {
                        if (gen === arcadeLoadGenRef.current) setGamesLoading(false);
                      });
                  }}
                  className="text-[9px] font-mono text-indigo-400 hover:text-indigo-300 underline"
                >
                  Retry
                </button>
              </div>
            )}

            {activeTab === 'arcade' && customization.privacy.showActivityStats && !gamesLoading && !gamesError && (
              <>
                <ArcadeStatsPanel
                  source={user}
                  username={user.username}
                  achievements={user.achievements ?? []}
                  gamesState={gamesState}
                  leaderboard={gamesLeaderboard}
                  showCoins={customization.privacy.showCoins}
                  showActivityStats={customization.privacy.showActivityStats}
                />
                {customization.privacy.showCoins && <CoinEarningsFeed refreshKey={coinFeedTick} />}
              </>
            )}

            {activeTab === 'arcade' && !customization.privacy.showActivityStats && (
              <div className="profile-glass rounded-2xl p-6 text-center text-[10px] font-mono text-slate-500">
                Arcade career stats are hidden from your public profile — this is what visitors see on Arcade.
              </div>
            )}

            {activeTab === 'trophies' && (
              <div className="space-y-2">
                {!customization.privacy.showActivityStats && (
                  <div className="profile-glass rounded-xl px-3 py-2 text-center text-[9px] font-mono text-slate-500">
                    Arcade & coin trophies are hidden from your public profile — preview below.
                  </div>
                )}
                <LeaderboardBadges
                  earned={previewAchievements}
                  showActivityStats={customization.privacy.showActivityStats}
                  showCoins={customization.privacy.showCoins}
                />
                <UnlockedAwards earned={previewAchievements} />
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="space-y-2">
                {!customization.privacy.showActivityStats && (
                  <div className="profile-glass rounded-xl px-3 py-2 text-center text-[9px] font-mono text-slate-500">
                    Arcade & coin trophies are hidden from your public profile — preview below.
                  </div>
                )}
                <AchievementShowcase earned={previewAchievements} />
              </div>
            )}

            {activeTab === 'settings' && (
              <ProfileSettingsTab
                username={user.username}
                displayName={displayName}
                bio={bio}
                website={website}
                email={email}
                password={password}
                currentPassword={currentPassword}
                avatarUrl={avatarUrl}
                coverUrl={coverUrl}
                socialLinks={socialLinks}
                customization={customization}
                achievements={user.achievements ?? []}
                avatarUploading={avatarUploading}
                saving={saving}
                error={error}
                success={success}
                onDisplayName={setDisplayName}
                onBio={setBio}
                onWebsite={setWebsite}
                onEmail={setEmail}
                onPassword={setPassword}
                onCurrentPassword={setCurrentPassword}
                onAvatarUrl={setAvatarUrl}
                onCoverUrl={setCoverUrl}
                onSocialLinks={setSocialLinks}
                onCustomization={setCustomization}
                onUploadAvatar={uploadAvatar}
                emailChanged={email.trim().toLowerCase() !== user.email.trim().toLowerCase()}
                onSave={save}
                onDeleteAccount={async (password) => {
                  await authApi.deleteAccount(password);
                  const ok = await logout();
                  if (!ok) {
                    const { invalidateSession } = await import('../../lib/sessionEvents');
                    invalidateSession();
                  }
                }}
              />
            )}
          </main>
        </div>
      </div>
    </PageShell>
  );
}

function PublicProfileView({
  username,
  profile,
  loading,
  error,
  isLoggedIn,
  onLogin,
  onNavigateTab,
}: {
  username: string;
  profile: PublicProfile | null;
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onNavigateTab?: (tab: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const custom = useMemo(
    () => (profile ? resolveCustomization(profile.profileCustomization) : null),
    [profile],
  );
  const publicAchievements = useMemo(() => {
    if (!profile || !custom) return [];
    return filterAchievementsForPrivacyPreview(profile.achievements ?? [], {
      showActivityStats: custom.privacy.showActivityStats,
      showCoins: custom.privacy.showCoins,
    });
  }, [profile, custom]);

  React.useEffect(() => {
    setActiveTab('overview');
  }, [username]);

  React.useEffect(() => {
    if (!custom) return;
    if (activeTab === 'arcade' && !custom.privacy.showActivityStats) {
      setActiveTab('overview');
    }
  }, [custom, activeTab]);

  if (loading) {
    return (
      <PageShell id="profile-module" pageId="profile" icon="👤" title="Profile" subtitle={`@${username}`} accentClass="text-indigo-400">
        <div className="flex items-center justify-center min-h-[280px] text-[10px] font-mono text-slate-500 animate-pulse">
          Loading profile…
        </div>
      </PageShell>
    );
  }

  if (error || !profile || !custom) {
    return (
      <PageShell id="profile-module" pageId="profile" icon="👤" title="Profile" subtitle={`@${username}`} accentClass="text-indigo-400">
        <div className="flex items-center justify-center min-h-[280px] text-center">
          <p className="text-[11px] font-mono text-rose-400 mb-2">{error || 'Profile not found'}</p>
          <p className="text-[9px] font-mono text-slate-600">/profile/{username}</p>
        </div>
      </PageShell>
    );
  }

  const publicTabs = TABS.filter(
    (t) => !t.ownOnly && (t.id !== 'arcade' || custom.privacy.showActivityStats),
  );

  return (
    <PageShell id="profile-module" pageId="profile" icon="👤" title="Profile" subtitle={`@${profile.username}`} accentClass="text-indigo-400">
      <div className="max-w-4xl mx-auto space-y-4 profile-scroll-area max-h-[calc(100dvh-8rem)] pr-1">
        <ProfileHero
          user={{ ...profile, achievements: publicAchievements }}
          showCoins={custom.privacy.showCoins}
          onNavigateGames={onNavigateTab ? () => onNavigateTab('games') : undefined}
        />

        <nav className="flex flex-wrap gap-1 profile-glass rounded-2xl p-2" aria-label="Profile sections">
          {publicTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono transition ${
                activeTab === t.id ? 'profile-tab-active' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && custom.privacy.showActivityStats && (
          <ProfileOverviewTab
            profileViews={profile.profileViews ?? 0}
            imagesUploaded={profile.imagesUploaded ?? 0}
            pastesCreated={profile.pastesCreated}
            pasteViewsTotal={profile.pasteViewsTotal}
            memesCreated={profile.memesCreated ?? 0}
            changelogReads={profile.changelogReads}
            newsReads={profile.newsReads}
            referralsCount={profile.referralsCount ?? 0}
            email={profile.email}
            showEmail={custom.privacy.showEmail && Boolean(profile.email)}
            profileStats={profile.profileStats}
            reportedAccounts={[]}
            isPublic
          />
        )}

        {activeTab === 'overview' && !custom.privacy.showActivityStats && (
          <div className="profile-glass rounded-2xl p-6 text-center text-[10px] font-mono text-slate-500">
            Activity stats are private.
          </div>
        )}

        {activeTab === 'arcade' && (
          <ArcadeStatsPanel
            source={profile}
            username={profile.username}
            achievements={publicAchievements}
            showCoins={custom.privacy.showCoins}
          />
        )}

        {activeTab === 'trophies' && (
          <div className="space-y-2">
            <LeaderboardBadges
              earned={publicAchievements}
              showActivityStats={custom.privacy.showActivityStats}
              showCoins={custom.privacy.showCoins}
            />
            <UnlockedAwards earned={publicAchievements} />
          </div>
        )}

        {activeTab === 'vault' && (
          <AchievementShowcase earned={publicAchievements} />
        )}

        {!isLoggedIn && (
          <div className="profile-glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[10px] font-mono text-slate-500">Want your own status, mood & theme?</p>
            <ActionButton onClick={onLogin} variant="indigo">Sign in</ActionButton>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function PermRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-mono text-slate-500">{label}</span>
      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${active ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-600 border-slate-700/50'}`}>
        {active ? 'On' : '—'}
      </span>
    </div>
  );
}