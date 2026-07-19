/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TerminalHeader } from './components/TerminalHeader';
import { GrabZone } from './components/GrabZone';

import { 
  Terminal, 
  Shield, 
  Sparkles, 
} from 'lucide-react';

import { useFirebaseCaughtCount } from './hooks/useFirebaseCaughtCount';
import { DASHBOARD_MENU_ITEM, LAB_MENU_ITEMS, MAIN_MENU_ITEMS, TabId } from './config/menuItems';
import { DEFAULT_PUBLIC_TABS } from './config/accessControl';
import { usePageVisibility } from './context/PageVisibilityContext';
import { parseProfileRoute, profilePath, syncUrlForTab } from './lib/profileRouting';
import { parsePasteViewerId } from './lib/paste';
import { captureReferralFromUrl } from './lib/referral';
import { ChangelogPanel } from './components/changelog/ChangelogPanel';
import { markChangelogVisited, notifyFeedRead, useFeedUnread } from './hooks/useFeedUnread';
import { APP_VERSION } from './config/version';
import { markLocalChangelogRead } from './lib/changelogUnread';
import { markLocalNewsRead } from './lib/newsUnread';
import { SidebarNav } from './components/layout/SidebarNav';
import { TerminalDiagnosticsPane } from './components/diagnostics/TerminalDiagnosticsPane';
import { SystemFooterBar } from './components/diagnostics/SystemFooterBar';
import { terminalAppend } from './lib/terminalLogBridge';
import { AuthModal } from './components/auth/AuthModal';
import { FeatureLoginGate } from './components/auth/FeatureLoginGate';
import { PasteViewer } from './components/paste/PasteViewer';

import { useAuth } from './context/AuthContext';
import {
  NewsPanel,
  AdminDashboardPage,
  ChaosGeneratorPage,
  ColorLabPage,
  FAQPage,
  FreePremiumAccountsPage,
  GamesPage,
  IdentityForgePage,
  ImageHostingPage,
  InviteFriendsPage,
  LeaderboardPage,
  MemeGeneratorPage,
  MyActivityPage,
  NetToolkitPage,
  PastePage,
  ProfilePage,
  ProxyDatabasePage,
  StatusPage,
  TabPageFallback,
  TerminalStatsPage,
  TextLabPage,
  ToolVaultPage,
  UserDashboardPage,
} from './components/pages/lazyPages';
import * as authApi from './lib/auth';
import {
  setAchievementProof,
  requestAchievementProofRemint,
  takeAchievementProof,
  takeAchievementProofRemintRequest,
} from './lib/achievementProof';
import { trackEvent } from './lib/analytics';
import { collectVisitorContext, visitorContextToMeta } from './lib/visitorContext';

const DESIGN_WIDTH = 1366;
const DESIGN_HEIGHT = 768;
const VIEWPORT_PADDING = 8;
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.85;
const GRAB_HOLD_MS = 7500;

const ALL_TAB_IDS = new Set<TabId>([
  'dashboard', 'stats', 'status', 'leaderboard', 'games', 'news', 'fun', 'faq', 'invite', 'changelog', 'memegen', 'imagehost', 'paste',
  'proxydatabase', 'premiumaccounts', 'tools', 'identity', 'textlab', 'colorlab',
  'meme', 'toolvault', 'profile', 'activity', 'admin',
]);

const initialProfileRoute = typeof window !== 'undefined' ? parseProfileRoute() : null;

function readDeepLinkParams() {
  if (typeof window === 'undefined') return { tab: null as TabId | null, category: null as string | null, account: null as string | null };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as TabId | null;
  return {
    tab: tab && ALL_TAB_IDS.has(tab) ? tab : null,
    category: params.get('category'),
    account: params.get('account'),
  };
}

function resolveGuestSafeTab(tab: TabId | null | undefined, isPublic: (t: TabId) => boolean): TabId {
  if (!tab || !isPublic(tab)) return 'changelog';
  return tab;
}

const initialDeepLink = typeof window !== 'undefined' ? readDeepLinkParams() : { tab: null, category: null, account: null };
const initialPasteViewerId = typeof window !== 'undefined' ? parsePasteViewerId() : null;

export default function App() {
  const {
    user, isLoggedIn, isAdmin, loading: authLoading, openAuth, openLoginGate, syncAchievements, authSuccessTick,
    pendingTabAfterLogin, clearPendingTabAfterLogin, patchUser, handleUnlocks,
  } = useAuth();
  const { requiresLogin, isPublicTab, loading: visibilityLoading, showDiagnosticsPane } = usePageVisibility();
  const { newsFeedVersion } = useFeedUnread();

  const canAccessTab = useCallback((tab: TabId, loggedIn: boolean, admin: boolean) => {
    if (tab === 'admin') return admin;
    if (loggedIn) return true;
    return isPublicTab(tab);
  }, [isPublicTab]);

  /** Deep-link paste share (/p/:id) — shown inside the full App shell. */
  const [pasteViewerId, setPasteViewerId] = useState<string | null>(initialPasteViewerId);

  // Navigation active tab matching the design HTML options
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (initialPasteViewerId) return 'paste';
    const initial = initialProfileRoute?.tab ?? initialDeepLink.tab ?? 'changelog';
    if (initial === 'profile' && initialProfileRoute?.username) return 'profile';
    return initial;
  });
  const [profileUsername, setProfileUsername] = useState<string | null>(initialProfileRoute?.username ?? null);
  const [premiumDeepLink, setPremiumDeepLink] = useState(initialDeepLink);
  const [newsPanelMounted, setNewsPanelMounted] = useState(
    () => (initialProfileRoute?.tab ?? initialDeepLink.tab ?? 'changelog') === 'news',
  );

  /** Safe tab for render — avoids blank pane between session loss and redirect effect. */
  const renderTab = useMemo(() => {
    if (authLoading || visibilityLoading) return resolveGuestSafeTab(activeTab, isPublicTab);
    if (!canAccessTab(activeTab, isLoggedIn, isAdmin)) return resolveGuestSafeTab(null, isPublicTab);
    if (!isLoggedIn && requiresLogin(activeTab)) return resolveGuestSafeTab(null, isPublicTab);
    return activeTab;
  }, [authLoading, visibilityLoading, activeTab, isLoggedIn, isAdmin, canAccessTab, requiresLogin, isPublicTab]);

  useEffect(() => {
    if (renderTab === 'news') setNewsPanelMounted(true);
  }, [renderTab]);

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  useEffect(() => {
    if (pasteViewerId) {
      const path = `/p/${pasteViewerId}`;
      const url = `${window.location.origin}${path}`;
      const canonical = document.querySelector('link[rel="canonical"]');
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (canonical) canonical.setAttribute('href', url);
      if (ogUrl) ogUrl.setAttribute('content', url);
      // PasteViewer sets document.title when content loads
      return;
    }
    const menu = [DASHBOARD_MENU_ITEM, ...MAIN_MENU_ITEMS, ...LAB_MENU_ITEMS].find((m) => m.id === renderTab);
    const suffix = renderTab === 'profile' && profileUsername ? ` · @${profileUsername}` : '';
    document.title = menu ? `${menu.label}${suffix} · LUL Terminal` : 'LUL Terminal';
    const canonical = document.querySelector('link[rel="canonical"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const path = renderTab === 'profile' && profileUsername
      ? profilePath(profileUsername)
      : renderTab === 'changelog'
        ? '/'
        : `/?tab=${encodeURIComponent(renderTab)}`;
    const url = `${window.location.origin}${path}`;
    if (canonical) canonical.setAttribute('href', url);
    if (ogUrl) ogUrl.setAttribute('content', url);
    return () => { document.title = 'LUL Terminal'; };
  }, [renderTab, profileUsername, pasteViewerId]);

  const sessionTrackedRef = useRef(false);
  const visitorCtxRef = useRef<ReturnType<typeof collectVisitorContext> | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (sessionTrackedRef.current) return;
    sessionTrackedRef.current = true;
    visitorCtxRef.current = collectVisitorContext(isLoggedIn);
    trackEvent('session_start', { meta: visitorContextToMeta(visitorCtxRef.current) }).catch(() => {});
  }, [isLoggedIn, authLoading]);

  const [profileTabReadyTick, setProfileTabReadyTick] = useState(0);
  const lastTrackedTabRef = useRef<TabId | null>(null);
  const tabEnteredAtRef = useRef(Date.now());
  const tabTrackGenRef = useRef(0);
  const tabTrackForceRef = useRef(false);
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;
  useEffect(() => {
    if (authLoading || visibilityLoading) return;
    if (pendingTabAfterLogin) return;
    if (activeTab !== renderTab) return;
    if (!isLoggedIn) return;
    const trackedTab = renderTab;
    const trackGen = ++tabTrackGenRef.current;

    void (async () => {
      const prevTab = lastTrackedTabRef.current;
      if (prevTab !== null && prevTab !== trackedTab) {
        const dwellSec = Math.round((Date.now() - tabEnteredAtRef.current) / 1000);
        if (dwellSec >= 2 && isLoggedInRef.current) {
          await trackEvent('tab_dwell', { tab: prevTab, meta: { dwellSec } }).catch(() => {});
        }
      }
      if (trackGen !== tabTrackGenRef.current) return;

      const forceTrack = tabTrackForceRef.current || takeAchievementProofRemintRequest();
      if (tabTrackForceRef.current) tabTrackForceRef.current = false;
      if (!forceTrack && lastTrackedTabRef.current === trackedTab) return;

      const type = trackedTab === 'faq' ? 'faq_visit' : 'tab_visit';
      const baseMeta = visitorCtxRef.current ? visitorContextToMeta(visitorCtxRef.current) : {};
      try {
        const r = await trackEvent(type, {
          tab: trackedTab,
          meta: baseMeta,
        });
        if (trackGen !== tabTrackGenRef.current || !isLoggedInRef.current) return;
        if (r?.ok === false) {
          if (forceTrack) requestAchievementProofRemint();
          return;
        }
        lastTrackedTabRef.current = trackedTab;
        tabEnteredAtRef.current = Date.now();
        if (r?.proof && r.proof.tab === trackedTab) setAchievementProof(r.proof);
        if (trackedTab === 'profile') setProfileTabReadyTick((t) => t + 1);
        if (r?.user) {
          patchUser((prev) => {
            if (!prev) return r.user!;
            const incoming = r.user!;
            const prevAt = Number(prev.updatedAt) || 0;
            const incAt = Number(incoming.updatedAt) || 0;
            if (incAt < prevAt) {
              return {
                ...prev,
                changelogLastReadVersion: incoming.changelogLastReadVersion ?? prev.changelogLastReadVersion,
                newsLastReadVersion: incoming.newsLastReadVersion ?? prev.newsLastReadVersion,
              };
            }
            return { ...prev, ...incoming };
          });
          if (trackedTab === 'changelog' && r.user.changelogLastReadVersion === APP_VERSION) {
            markLocalChangelogRead();
            notifyFeedRead('changelog');
          } else if (
            trackedTab === 'news'
            && newsFeedVersion !== '0.0.0'
            && r.user.newsLastReadVersion === newsFeedVersion
          ) {
            markLocalNewsRead(newsFeedVersion);
            notifyFeedRead('news');
          }
        }
      } catch {
        if (trackGen !== tabTrackGenRef.current || !isLoggedInRef.current) return;
        if (forceTrack) requestAchievementProofRemint();
      }
    })();
  }, [activeTab, renderTab, authLoading, visibilityLoading, pendingTabAfterLogin, patchUser, isLoggedIn, newsFeedVersion]);

  useEffect(() => {
    if (authSuccessTick < 1 || !isLoggedIn || authLoading) return;
    tabTrackForceRef.current = true;
    lastTrackedTabRef.current = null;
    changelogVisitSynced.current = false;
    visitorCtxRef.current = collectVisitorContext(true);
    trackEvent('session_start', { meta: visitorContextToMeta(visitorCtxRef.current) }).catch(() => {});
  }, [authSuccessTick, isLoggedIn, authLoading]);

  const wasLoggedInForDwellRef = useRef(isLoggedIn);
  useEffect(() => {
    if (wasLoggedInForDwellRef.current && !isLoggedIn && !authLoading) {
      const prevTab = lastTrackedTabRef.current;
      if (prevTab !== null) {
        const dwellSec = Math.round((Date.now() - tabEnteredAtRef.current) / 1000);
        if (dwellSec >= 2) {
          void trackEvent('tab_dwell', { tab: prevTab, meta: { dwellSec } }).catch(() => {});
        }
      }
    }
    wasLoggedInForDwellRef.current = isLoggedIn;
  }, [isLoggedIn, authLoading]);

  useEffect(() => {
    if (renderTab !== 'profile') setProfileTabReadyTick(0);
  }, [renderTab]);

  useEffect(() => {
    if (renderTab !== 'profile' || !profileUsername) return;
    lastTrackedTabRef.current = null;
    setProfileTabReadyTick(0);
  }, [profileUsername, renderTab]);

  const changelogVisitSynced = useRef(false);
  useEffect(() => {
    if (renderTab !== 'changelog' || changelogVisitSynced.current) return;
    changelogVisitSynced.current = true;
    markChangelogVisited(isLoggedIn);
  }, [renderTab, isLoggedIn]);

  // Cursor coordinate tracking (relative to viewport)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cursorGrabbed, setCursorGrabbed] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [clawThreatLevel, setClawThreatLevel] = useState<0 | 1 | 2>(0);
  const trapButtonRef = useRef<HTMLButtonElement>(null);
  const grabReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCursorGrabbed = useRef(false);
  const { caughtCount, recordCatch } = useFirebaseCaughtCount();

  // Unrecognized command shake animation trigger state
  const [isShaking, setIsShaking] = useState(false);

  // Interactive CLI custom theme color accent state
  const [themeColor, setThemeColor] = useState<'indigo' | 'emerald' | 'amber' | 'cyan' | 'rose'>('indigo');

  // Audio output state toggle
  const [isMuted, setIsMuted] = useState(false);

  // Synthesizer custom audio themes state
  const [synthTheme, setSynthTheme] = useState<'clean-sine' | 'retro-8bit' | 'bit-crushed'>('clean-sine');

  // Matrix stream full screen overlay visibility state
  const [isMatrixOverlayActive, setIsMatrixOverlayActive] = useState(false);

  const [bsodActive, setBsodActive] = useState(false);
  const [selfDestructCountdown, setSelfDestructCountdown] = useState(-1);

  // HUD tracking state for the Sidebar display
  const [hudState, setHudState] = useState<{
    state: string;
    rotation: number;
    isExtended: boolean;
  }>({
    state: 'waiting',
    rotation: 0,
    isExtended: false
  });

  // CRT scanlines active state
  const [isCrtEnabled, setIsCrtEnabled] = useState(false);

  const [scale, setScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Web Audio Synth buzzer with custom audio themes
  const playBeep = useCallback((freq: number, duration: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine') => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (synthTheme === 'clean-sine') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      } else if (synthTheme === 'retro-8bit') {
        // High fidelity retro 8-bit pulse with arpeggio effect
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.setValueAtTime(freq * 1.25, ctx.currentTime + duration * 0.25);
        osc.frequency.setValueAtTime(freq * 1.5, ctx.currentTime + duration * 0.5);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.setValueAtTime(0.14, ctx.currentTime + duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      } else if (synthTheme === 'bit-crushed') {
        // Bit-crushed feel using rigid staircase frequency modulation
        osc.type = 'sawtooth';
        const steps = 6;
        for (let i = 0; i < steps; i++) {
          const stepTime = ctx.currentTime + (duration / steps) * i;
          const stepFreq = Math.floor(freq * (1 + (i % 2 === 0 ? 0.2 : -0.15)) / 30) * 30;
          osc.frequency.setValueAtTime(stepFreq, stepTime);
        }
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      } else {
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }, [isMuted, synthTheme]);

  useEffect(() => () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
  }, []);

  useEffect(() => {
    if (authLoading || visibilityLoading) return;
    // Public paste share links must not be redirected by members-only Paste tab
    if (pasteViewerId) return;
    if (!canAccessTab(activeTab, isLoggedIn, isAdmin)) {
      const safe = resolveGuestSafeTab(null, isPublicTab);
      setActiveTab(safe);
      setProfileUsername(null);
      syncUrlForTab(safe);
      return;
    }
    if (!isLoggedIn && requiresLogin(activeTab)) {
      const safe = resolveGuestSafeTab(null, isPublicTab);
      setActiveTab(safe);
      setProfileUsername(null);
      syncUrlForTab(safe);
    }
  }, [authLoading, visibilityLoading, isLoggedIn, isAdmin, activeTab, requiresLogin, canAccessTab, isPublicTab, pasteViewerId]);

  useEffect(() => {
    if (isLoggedIn) return;
    lastTrackedTabRef.current = null;
    changelogVisitSynced.current = false;
  }, [isLoggedIn]);

  useEffect(() => {
    if (activeTab !== 'premiumaccounts') return;
    setPremiumDeepLink(readDeepLinkParams());
  }, [activeTab]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const updateScale = () => {
      const { width, height } = el.getBoundingClientRect();
      const scaleX = (width - VIEWPORT_PADDING) / DESIGN_WIDTH;
      const scaleY = (height - VIEWPORT_PADDING) / DESIGN_HEIGHT;
      const fitScale = Math.min(scaleX, scaleY);
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale));
      setScale(nextScale);
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(el);
    window.addEventListener('resize', updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  // Tracking mouse position for fun tab only, throttled via requestAnimationFrame
  useEffect(() => {
    if (renderTab !== 'fun') return;

    let rafId = 0;
    let latest = { x: 0, y: 0 };
    const setFromEvent = (e: MouseEvent) => {
      latest = { x: e.clientX, y: e.clientY };
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          setMousePos(latest);
          rafId = 0;
        });
      }
    };
    window.addEventListener('mousemove', setFromEvent);
    return () => {
      window.removeEventListener('mousemove', setFromEvent);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [renderTab]);

  // Self-destruct countdown tick timer
  useEffect(() => {
    if (selfDestructCountdown < 0) return;
    
    const cdTimer = setTimeout(() => {
      if (selfDestructCountdown > 1) {
        setSelfDestructCountdown(prev => prev - 1);
        terminalAppend(`🚨 SELF-DESTRUCT IN T-MINUS ${selfDestructCountdown - 1} SECONDS...`, 'alert');
        playBeep(440, 0.25, 'sawtooth');
      } else if (selfDestructCountdown === 1) {
        setSelfDestructCountdown(-1);
        terminalAppend('❌ SELF-DESTRUCT ABORTED: Runtime exception in self_destruct.sh line 42: "operator is too cool to die". System cooling down...', 'success');
        playBeep(880, 0.6, 'sine');
      }
    }, 1000);

    return () => clearTimeout(cdTimer);
  }, [selfDestructCountdown, playBeep]);

  const handleLowBattery = useCallback((level: number) => {
    terminalAppend(
      `⚠️ CRITICAL: Auxiliary battery low (${level}% remaining). Mainframe grid power recommended.`,
      'alert',
    );
  }, []);

  const handleBatteryCycle = useCallback((message: string, type: 'warn' | 'success') => {
    terminalAppend(message, type);
  }, []);

  const handleCursorGrabbed = useCallback(() => {
    if (cursorGrabbed || gameOver) return;

    setCursorGrabbed(true);
    recordCatch();
    if (isLoggedInRef.current) {
      const proof = takeAchievementProof('fun');
      if (proof) {
        authApi.recordAchievementEvent('claw_victim', proof)
          .then((data) => {
            handleUnlocks(data.newUnlocks ?? [], data.unlockRewards);
            if (data.user) patchUser(data.user);
          })
          .catch((e) => {
            requestAchievementProofRemint();
            terminalAppend(
              e instanceof Error ? `⚠️ Claw achievement failed: ${e.message}` : '⚠️ Claw achievement failed',
              'warn',
            );
          });
      } else {
        terminalAppend('⚠️ Achievement proof expired — revisit Fun tab to earn claw credit.', 'warn');
      }
    }
    terminalAppend('🎯 CURSOR SNATCHED! Gravity core localized. Escape probability: < 0.1%', 'alert');
    playBeep(440, 0.4, 'triangle');
    setTimeout(() => playBeep(220, 0.4, 'sawtooth'), 150);

    if (grabReleaseTimer.current) clearTimeout(grabReleaseTimer.current);
    grabReleaseTimer.current = setTimeout(() => {
      setCursorGrabbed(false);
      terminalAppend('💨 Brief quantum leakage detected — claw re-arming...', 'warn');
      playBeep(600, 0.25, 'sine');
    }, GRAB_HOLD_MS);
  }, [cursorGrabbed, gameOver, recordCatch, handleUnlocks, patchUser, playBeep]);

  useEffect(() => {
    if (renderTab !== 'fun') {
      setClawThreatLevel(0);
    }
  }, [renderTab]);

  useEffect(() => {
    const wasGrabbed = prevCursorGrabbed.current;
    prevCursorGrabbed.current = cursorGrabbed;
    if (wasGrabbed && !cursorGrabbed && clawThreatLevel >= 1 && renderTab === 'fun' && !gameOver) {
      const regrabTimer = setTimeout(() => handleCursorGrabbed(), 1000);
      return () => clearTimeout(regrabTimer);
    }
  }, [cursorGrabbed, clawThreatLevel, renderTab, gameOver, handleCursorGrabbed]);

  useEffect(() => {
    return () => {
      if (grabReleaseTimer.current) clearTimeout(grabReleaseTimer.current);
    };
  }, []);

  const handleButtonClicked = () => {
    if (cursorGrabbed) return;
    setGameOver(true);
    terminalAppend('🎉 TRAP BUTTON clicked! System over-excitation triggered!', 'success');
    playBeep(520, 0.15, 'sine');
    setTimeout(() => playBeep(650, 0.15, 'sine'), 100);
    setTimeout(() => playBeep(780, 0.3, 'sine'), 200);

    setTimeout(() => {
      setGameOver(false);
      terminalAppend('⚙️ System cooled down. Gravity grids restored. (The claw remembers.)', 'info');
    }, 8000);
  };

  const pendingPopRef = useRef(false);

  const applyPopstateNavigation = useCallback(() => {
    if (authLoading || visibilityLoading) {
      pendingPopRef.current = true;
      return;
    }
    const pasteId = parsePasteViewerId();
    if (pasteId) {
      setPasteViewerId(pasteId);
      setActiveTab('paste');
      setProfileUsername(null);
      return;
    }
    setPasteViewerId(null);
    const route = parseProfileRoute();
    if (route) {
      if (!isLoggedIn && !isPublicTab('profile')) {
        openLoginGate('profile', { profileUsername: route.username });
        setActiveTab('changelog');
        setProfileUsername(null);
        syncUrlForTab('changelog');
        return;
      }
      setActiveTab('profile');
      setProfileUsername(route.username);
      syncUrlForTab('profile', route.username);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabId | null;
    if (tab && ALL_TAB_IDS.has(tab)) {
      if (tab === 'admin' && !isAdmin) {
        setActiveTab(isLoggedIn ? 'dashboard' : 'changelog');
        syncUrlForTab(isLoggedIn ? 'dashboard' : 'changelog');
      } else if (!isLoggedIn && (requiresLogin(tab) || !isPublicTab(tab))) {
        openLoginGate(tab);
        setActiveTab('changelog');
        setProfileUsername(null);
        syncUrlForTab('changelog');
      } else {
        setActiveTab(tab);
        syncUrlForTab(tab);
      }
      setProfileUsername(null);
      return;
    }
    const fallback = isLoggedIn ? 'dashboard' : 'changelog';
    setActiveTab(fallback);
    setProfileUsername(null);
    syncUrlForTab(fallback);
  }, [authLoading, visibilityLoading, isLoggedIn, isAdmin, isPublicTab, openLoginGate, requiresLogin]);

  useEffect(() => {
    const onPop = () => applyPopstateNavigation();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyPopstateNavigation]);

  useEffect(() => {
    if (authLoading || visibilityLoading || !pendingPopRef.current) return;
    pendingPopRef.current = false;
    applyPopstateNavigation();
  }, [authLoading, visibilityLoading, applyPopstateNavigation]);

  const didBootstrapAuthTab = useRef(false);
  useEffect(() => {
    if (authLoading || !isLoggedIn || didBootstrapAuthTab.current) return;
    if (initialProfileRoute || initialDeepLink.tab || initialPasteViewerId) return;
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path.startsWith('/p/') || path.startsWith('/profile/')) return;
    didBootstrapAuthTab.current = true;
    setActiveTab('dashboard');
    setProfileUsername(null);
    syncUrlForTab('dashboard');
  }, [authLoading, isLoggedIn]);

  useEffect(() => {
    if (authSuccessTick < 1) return;
    if (pendingTabAfterLogin) {
      setPasteViewerId(null);
      const { tab, profileUsername: pun } = pendingTabAfterLogin;
      clearPendingTabAfterLogin();
      if (!canAccessTab(tab, true, isAdmin)) {
        setActiveTab('dashboard');
        setProfileUsername(null);
        syncUrlForTab('dashboard');
        return;
      }
      setActiveTab(tab);
      if (tab === 'profile' && pun) {
        setProfileUsername(pun);
        syncUrlForTab(tab, pun);
      } else {
        setProfileUsername(null);
        syncUrlForTab(tab);
      }
      return;
    }
    // Stay on /p/:id after login so private pastes can open for the owner
    if (pasteViewerId) return;
    if (canAccessTab(activeTab, true, isAdmin)) {
      if (activeTab === 'profile' && profileUsername) {
        syncUrlForTab(activeTab, profileUsername);
      } else {
        syncUrlForTab(activeTab);
      }
      return;
    }
    setActiveTab('dashboard');
    setProfileUsername(null);
    syncUrlForTab('dashboard');
  }, [authSuccessTick, pendingTabAfterLogin, clearPendingTabAfterLogin, canAccessTab, isAdmin, activeTab, profileUsername, pasteViewerId]);

  useEffect(() => {
    if (authLoading || visibilityLoading || isLoggedIn) return;
    const deepTab = initialDeepLink.tab;
    if (deepTab && requiresLogin(deepTab)) {
      openLoginGate(deepTab);
    }
  }, [authLoading, visibilityLoading, isLoggedIn, openLoginGate, requiresLogin]);

  const lastSyncedTabRef = useRef<TabId | null>(null);

  const handleTabClick = useCallback((tab: TabId, opts?: { profileUsername?: string }) => {
    if (authLoading || visibilityLoading) return;
    if (tab === 'admin' && !isAdmin) {
      playBeep(520, 0.06, 'sine');
      return;
    }
    if (!isLoggedIn && (requiresLogin(tab) || !isPublicTab(tab))) {
      openLoginGate(tab, opts);
      playBeep(520, 0.06, 'sine');
      return;
    }
    // Leaving a /p/:id deep-link: drop viewer and use normal tab URLs
    setPasteViewerId(null);
    const isSameTab = tab === activeTab && tab !== 'profile' && !pasteViewerId;
    setActiveTab(tab);
    if (tab === 'profile') {
      const uname = opts?.profileUsername ?? profileUsername;
      setProfileUsername(uname);
      if (uname) syncUrlForTab(tab, uname);
    } else {
      setProfileUsername(null);
      syncUrlForTab(tab);
    }
    if (isLoggedIn && !isSameTab && lastSyncedTabRef.current !== tab) {
      lastSyncedTabRef.current = tab;
    }
    playBeep(740, 0.08, 'sine');
  }, [activeTab, isLoggedIn, isAdmin, isPublicTab, requiresLogin, openLoginGate, profileUsername, playBeep, authLoading, visibilityLoading, pasteViewerId]);


  return (
    <>
    <FeatureLoginGate />
    <AuthModal />
    <div 
      className={`crt-screen ${isCrtEnabled ? 'crt-effect' : ''} flex flex-col h-dvh max-h-dvh w-full bg-[#1b1f2b] text-slate-300 font-mono overflow-hidden select-none ${cursorGrabbed ? 'custom-cursor-grabbed' : ''} ${isShaking ? 'screen-shake-effect' : ''}`}
      id="main-crt-wrapper"
    >
      <div className="crt-flicker flex flex-col h-full w-full min-h-0 min-w-0" id="flicker-wrapper">
        
        {/* TOP TERMINAL HEADER - Fully aligned with Professional Polish template style */}
        <TerminalHeader />

        {/* Dynamic and responsive window center content area */}
        <main ref={viewportRef} className="flex-1 min-h-0 min-w-0 flex items-center justify-center relative overflow-hidden bg-[#11131b]" id="applet-viewport">
          
          <div
            className="relative shrink-0"
            style={{
              width: DESIGN_WIDTH * scale,
              height: DESIGN_HEIGHT * scale,
            }}
            id="scaled-terminal-wrapper"
          >
          <div 
            className="terminal-window w-[1366px] h-[768px] flex overflow-hidden border border-slate-800/40 shadow-2xl absolute top-0 left-0 bg-[#0b0c10] text-[11px]"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            id="scaled-terminal-sandbox"
          >
            {/* Ambient visual tech decor dots */}
            <div className="absolute inset-0 bg-[radial-gradient(#4f5060_0.4px,transparent_0.4px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

            <SidebarNav
              activeTab={renderTab}
              onTabClick={handleTabClick}
              hudPanel={
                renderTab === 'fun' ? (
                  <div
                    className="mt-6 mb-4 mx-1 bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-lg font-mono text-[10px] leading-relaxed select-none text-slate-400 shadow-md"
                    id="debug-hud-panel"
                  >
                    <span className="text-emerald-400 font-bold block mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                      ■ TARGET TRACKING HUD
                    </span>
                    <div className="space-y-1">
                      <div>STATE: <span className="text-blue-400 font-bold uppercase">{hudState.state}</span></div>
                      <div>VECTOR ROTATION: <span className="text-yellow-400">{hudState.rotation}°</span></div>
                      <div>ARM REACH: <span className="text-pink-400">{hudState.isExtended ? 'MAX' : 'NORMAL'}</span></div>
                      <div>CAUGHT COUNT: <span className="text-red-400 font-bold">{caughtCount}</span></div>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-2 font-sans italic leading-tight">
                      Hover custom trigger below to lure entity
                    </div>
                  </div>
                ) : null
              }
            />

            {/* DYNAMIC CONTENT AREA (Fluid Middle Column) */}
            <section className="flex-1 min-h-0 p-6 flex flex-col bg-[#11131b] text-slate-300 relative border-r border-slate-800/40 overflow-hidden" id="editorial-left-pane">
              {pasteViewerId ? (
                <PasteViewer id={pasteViewerId} embedded />
              ) : (
              <Suspense fallback={<TabPageFallback />}>
              {renderTab === 'dashboard' && (
                <UserDashboardPage onNavigate={handleTabClick} />
              )}
              {renderTab === 'stats' && <TerminalStatsPage />}
              {renderTab === 'status' && <StatusPage />}
              {renderTab === 'leaderboard' && <LeaderboardPage onNavigate={handleTabClick} />}
              {renderTab === 'games' && <GamesPage />}
              {renderTab === 'faq' && <FAQPage />}
              {renderTab === 'invite' && <InviteFriendsPage />}

              {renderTab === 'changelog' && <ChangelogPanel isActive />}

              {/* TAB CONTAINER 2: Fun & Trap View (Preserving your interactive Hello layout with coordinates & trap button!) */}
              {renderTab === 'fun' && (
                <div className="flex-1 flex flex-col justify-between" id="fun-module">
                  <div id="greeting-text-block">
                    <div className="flex items-center gap-3 mb-4" id="greeting-header">
                      <span className="bg-amber-500/10 text-amber-400 p-2 rounded-lg border border-amber-500/20">
                        <Terminal className="w-5 h-5 animate-pulse" />
                      </span>
                      <div>
                        <h1 className="text-xl font-bold text-slate-100 font-sans" id="main-greeting">
                          Hello! 👋
                        </h1>
                        <p className="text-[11px] text-amber-400/80 font-mono mt-0.5">user@lul_terminal:~$ ./welcome.sh</p>
                      </div>
                    </div>

                    <div className="space-y-3.5 text-slate-400 text-xs pr-2" id="welcome-message-content">
                      <h2 className="text-sm font-semibold text-slate-300 font-sans">
                        Welcome to the internet.
                      </h2>
                      <p className="leading-relaxed">
                        This is a classic website. There are absolutely <strong>no tricky traps</strong>, 
                        artificial tracking gravity, or weird physics anomalies here!
                      </p>
                      <p className="leading-relaxed">
                        Feel free to explore other columns, check diagnostic pings, or click that big polished button down there?
                      </p>
                    </div>

                    {/* Proximity field tracer warn card */}
                    <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3.5 mt-5 flex items-start gap-2.5" id="warning-notice">
                      <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">SENSOR WARN LOG</span>
                        <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                          Quantum field anomalies are detected localized under the cursor. Please manipulate indices with absolute caution.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reaction key triggers */}
                  <div className="relative flex items-center gap-5 pt-4 border-t border-slate-800/40" id="interact-action-row">
                    {clawThreatLevel >= 2 && !gameOver && (
                      <div
                        className="absolute inset-0 z-30 rounded cursor-none"
                        onClick={(e) => e.preventDefault()}
                        id="trap-button-shield"
                        aria-hidden="true"
                      />
                    )}
                    <button
                      ref={trapButtonRef}
                      className="trap-button relative z-10"
                      onClick={handleButtonClicked}
                      disabled={cursorGrabbed || clawThreatLevel >= 2 || gameOver}
                      id="action-trap-button"
                    >
                      {gameOver && "Nice one! 🎉"}
                      {cursorGrabbed && "GOTCHA! 😈"}
                      {!gameOver && !cursorGrabbed && "Button! 🖲️"}
                    </button>

                    <div className="flex flex-col font-mono" id="button-helper-tooltip">
                      <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> TRAP STATUS
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        {gameOver ? 'COOLDOWN: 8.0s' : cursorGrabbed ? 'TRAPPED — HOLD STILL' : clawThreatLevel >= 2 ? 'GRAB INCOMING' : clawThreatLevel >= 1 ? 'STALKING' : 'AWAITING TRIGGER'}
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {newsPanelMounted ? (
                <div
                  className={`absolute inset-0 flex flex-col min-h-0 overflow-hidden ${
                    renderTab === 'news' ? 'z-10 visible' : 'z-0 invisible pointer-events-none'
                  }`}
                  aria-hidden={renderTab !== 'news'}
                >
                  <NewsPanel
                    isActive={renderTab === 'news'}
                    liveFeedVersion={newsFeedVersion}
                    onNavigateTab={handleTabClick}
                  />
                </div>
              ) : null}

              {renderTab === 'tools' && <NetToolkitPage />}
              {renderTab === 'identity' && <IdentityForgePage />}
              {renderTab === 'textlab' && <TextLabPage />}
              {renderTab === 'colorlab' && <ColorLabPage />}
              {renderTab === 'meme' && <ChaosGeneratorPage />}
              {renderTab === 'toolvault' && <ToolVaultPage />}
              {renderTab === 'memegen' && <MemeGeneratorPage />}
              {renderTab === 'imagehost' && <ImageHostingPage />}
              {renderTab === 'paste' && <PastePage />}
              {renderTab === 'proxydatabase' && <ProxyDatabasePage />}
              {renderTab === 'premiumaccounts' && (
                <FreePremiumAccountsPage
                  initialCategory={premiumDeepLink.category}
                  highlightAccountId={premiumDeepLink.account}
                />
              )}
              {renderTab === 'profile' && (
                <ProfilePage
                  routeUsername={profileUsername ?? undefined}
                  profileTabReadyTick={profileTabReadyTick}
                  onNavigateTab={(tab) => handleTabClick(tab as TabId)}
                />
              )}
              {renderTab === 'activity' && <MyActivityPage />}
              {renderTab === 'admin' && <AdminDashboardPage />}

              </Suspense>
              )}
            </section>

            {showDiagnosticsPane && (
              <TerminalDiagnosticsPane
                renderTab={renderTab}
                themeColor={themeColor}
                setThemeColor={setThemeColor}
                isLoggedIn={isLoggedIn}
                openAuth={openAuth}
                isMuted={isMuted}
                setIsMuted={setIsMuted}
                isMatrixOverlayActive={isMatrixOverlayActive}
                setIsMatrixOverlayActive={setIsMatrixOverlayActive}
                isCrtEnabled={isCrtEnabled}
                setIsCrtEnabled={setIsCrtEnabled}
                setBsodActive={setBsodActive}
                setSelfDestructCountdown={setSelfDestructCountdown}
                selfDestructCountdown={selfDestructCountdown}
                setIsShaking={setIsShaking}
                playBeep={playBeep}
                syncAchievements={syncAchievements}
                synthTheme={synthTheme}
                onNavigateProfile={(username) => handleTabClick('profile', { profileUsername: username })}
                onChangeSynthTheme={(theme) => {
                  setSynthTheme(theme);
                  if (!isMuted) playBeep(600, 0.1, theme === 'clean-sine' ? 'sine' : theme === 'retro-8bit' ? 'square' : 'sawtooth');
                  terminalAppend(`🔊 Audio Synthesizer Theme set to ${theme.toUpperCase()}.`, 'success');
                }}
              />
            )}

            {/* Mount custom tracking physical claw inside sandbox bounds! */}
            {renderTab === 'fun' && (
              <div className="grab-zone-wrapper">
                <GrabZone 
                  cursorGrabbed={cursorGrabbed}
                  gameOver={gameOver}
                  onCursorGrabbed={handleCursorGrabbed}
                  mousePos={mousePos}
                  trapButtonRef={trapButtonRef}
                  onThreatLevel={setClawThreatLevel}
                  onMetricsUpdate={(state, rotation, isExtended) => {
                    setHudState((prev) => {
                      if (
                        prev.state === state &&
                        prev.rotation === rotation &&
                        prev.isExtended === isExtended
                      ) {
                        return prev;
                      }
                      return { state, rotation, isExtended };
                    });
                  }}
                />
              </div>
            )}

          </div>
          </div>

        </main>

        <SystemFooterBar
          onLowBattery={handleLowBattery}
          onBatteryCycle={handleBatteryCycle}
          playBeep={playBeep}
        />

      </div>

      {/* Decorative Custom overlay showing captured monster action alert on full screen */}
      {cursorGrabbed && (
        <div 
          className="absolute inset-0 bg-red-950/20 backdrop-blur-[2px] z-[100] flex items-center justify-center animate-fade-in select-none pointer-events-auto cursor-none"
          id="grabbed-screen-overlay"
        >
          <div className="bg-[#0b0c10]/95 border border-red-500/40 p-7 rounded-xl shadow-2xl max-w-sm text-center flex flex-col items-center gap-3.5 animate-scale-up">
            <span className="text-3xl">😈</span>
            <span className="text-red-400 font-mono text-base font-extrabold tracking-widest animate-pulse">
              GOTCHA! CURSOR CAPTURED
            </span>
            <p className="text-[10px] text-slate-400 font-mono leading-relaxed max-w-xs">
              Primary cursor signals are currently held secure in organic carbon claw mesh. Stabilizing...
            </p>
            <div className="w-full bg-slate-900 rounded-full overflow-hidden mt-0.5 h-1">
              <div className="h-full bg-red-500 animate-[loading_7.5s_linear_infinite]" />
            </div>
          </div>
        </div>
      )}

      {/* Full screen red pulse warning overlay for self-destruct */}
      {selfDestructCountdown > 0 && (
        <div className="absolute inset-0 bg-red-950/25 border-4 border-red-600 animate-[pulse_1s_infinite] pointer-events-none z-[200] flex items-center justify-center">
          <div className="bg-[#0b0c10]/95 border border-red-500 p-8 rounded-xl shadow-2xl text-center flex flex-col items-center gap-4 select-none pointer-events-auto">
            <span className="text-5xl animate-bounce">🚨</span>
            <span className="text-red-500 font-mono text-xl font-black tracking-widest animate-pulse">
              SYSTEM SELF-DESTRUCT ACTIVE
            </span>
            <span className="text-slate-100 font-mono text-4xl font-extrabold bg-red-950/50 px-6 py-2 rounded-lg border border-red-900 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse">
              T-MINUS {selfDestructCountdown}s
            </span>
            <p className="text-[10px] text-slate-400 font-mono leading-relaxed max-w-xs mt-1">
              Core containment field decoupling. Complete system grid collapse imminent. Operator authorization required to abort.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelfDestructCountdown(-1);
                terminalAppend('❌ SELF-DESTRUCT ABORTED: Operator manually engaged the override failsafe switch.', 'success');
                playBeep(880, 0.4, 'sine');
              }}
              className="px-5 py-2.5 bg-red-950 hover:bg-red-900 border border-red-600 text-red-200 text-xs font-bold font-mono tracking-widest rounded transition-all mt-1 cursor-pointer"
            >
              ENGAGE OVERRIDE [ABORT]
            </button>
          </div>
        </div>
      )}

      {/* Full screen Blue Screen of Death (BSOD) diagnostic crash overlay */}
      {bsodActive && (
        <div 
          className="absolute inset-0 bg-[#0000aa] text-white p-12 font-mono text-sm leading-relaxed z-[1000] flex flex-col justify-between select-text"
          onClick={() => {
            setBsodActive(false);
            terminalAppend('🔄 Warm reboot complete. CRT scanlines re-synchronized.', 'success');
            playBeep(880, 0.3, 'sine');
          }}
        >
          <div className="space-y-4 max-w-3xl">
            <div className="bg-white text-[#0000aa] px-4 py-1.5 font-bold uppercase tracking-widest inline-block select-none">
              LUL OS System Failure
            </div>
            <p className="text-[#00ffff] font-bold">*** STOP: 0x000000D1 (0x0000000C, 0x00000002, 0x00000000, 0xF86B5A89)</p>
            <p className="text-[#a5b4fc] font-bold">DRIVER_IRQL_NOT_LESS_OR_EQUAL (lasagna_auth.dll)</p>
            <p className="text-slate-200">
              A fatal exception has occurred at memory index 0x7FFF32C0. The grid system was over-caffeinated and could not verify the lasagna database integrity constraints.
            </p>
            <div className="border-t border-slate-500/50 pt-4 space-y-2">
              <p>* Check to make sure any new hardware or lasagna recipes are properly cooked.</p>
              <p>* If this is a new installation, ask your AI pair programmer why they wrote this code.</p>
              <p>* Disable memory caching for Fred/Bls/Bea modules in UEFI setup.</p>
            </div>
            <p className="text-slate-300 text-xs animate-pulse select-none mt-2">
              Technical Information:
              <br />
              Address 0xF86B5A89 base at 0xF86B0000, DateStamp 60a4f89d - lasagna_auth.dll
            </p>
          </div>
          <div className="text-[#00ffff] text-xs font-bold tracking-widest animate-pulse text-center uppercase select-none mt-4 cursor-pointer">
            Click anywhere on screen to execute reboot and restore grid...
          </div>
        </div>
      )}
    </div>
    </>
  );
}
