/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coins,
  Crown,
  Flame,
  RefreshCw,
  Search,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVisibilityAwarePoll } from '../../hooks/useVisibilityAwarePoll';
import {
  GAME_CATALOG,
  GAME_CATALOG_MAP,
  GAME_CATEGORIES,
  type GameCategory,
  type GameId,
} from '../../lib/gameCatalog';
import {
  fetchGamesHistory,
  fetchGamesLeaderboard,
  fetchGamesState,
  joinGameQueue,
  leaveGameQueue,
  submitGameMove,
  matchOutcomeForUser,
  type AnyMatch,
  type GameLeaderboardSlice,
  type GamesLeaderboard,
  type GamesState,
  type MatchHistoryEntry,
  type RpsMatch,
  type RpsMove,
  type RpsSeriesType,
  type RpsStats,
  type TttMatch,
} from '../../lib/games';
import { Connect4Arena } from '../games/Connect4Arena';
import { DailyBonusCard } from '../games/DailyBonusCard';
import { InstantArena } from '../games/InstantArena';
import { LulCoinAmount } from '../games/LulCoinAmount';
import { LulCoinDisplay } from '../games/LulCoinDisplay';
import { MatchTicker } from '../games/MatchTicker';
import { MinesArena } from '../games/MinesArena';
import { NimArena } from '../games/NimArena';
import { RpsArena } from '../games/RpsArena';
import { RpsGlobalMeta, RpsMoveTendency } from '../games/RpsMoveTendency';
import { TttArena } from '../games/TttArena';
import { Dice100Arena } from '../games/Dice100Arena';
import { CoinEarningsFeed } from '../games/CoinEarningsFeed';
import { GameAchievementBadges } from '../games/GameAchievementBadges';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { PageShell } from './PageShell';

function getGameSlice(state: GamesState | null, gameId: string) {
  return state?.games?.[gameId] ?? state?.[gameId as 'rps' | 'ttt'];
}

function computeArcadeMeta(state: GamesState | null) {
  let variety = 0;
  let total = 0;
  for (const g of GAME_CATALOG) {
    const games = getGameSlice(state, g.id)?.myStats?.games ?? 0;
    if (games >= 1) variety++;
    total += games;
  }
  return { variety, total, maxVariety: GAME_CATALOG.length };
}

function ArcadeVarietyCard({ state }: { state: GamesState | null }) {
  const { variety, total, maxVariety } = computeArcadeMeta(state);
  const varietyPct = Math.min(100, Math.round((variety / maxVariety) * 100));
  const milestones = [
    { at: 5, label: 'Tourist', icon: '🗺️' },
    { at: 10, label: 'Explorer', icon: '🧭' },
    { at: maxVariety, label: 'Completionist', icon: '👑' },
  ];

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/30 via-[#0c0d12] to-indigo-950/25 p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Sparkles size={16} className="text-violet-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono font-semibold text-violet-200">Arcade Variety Progress</p>
          <p className="text-[8px] font-mono text-slate-500 mt-0.5">
            Play different titles to unlock meta achievements
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-mono font-bold text-violet-200 tabular-nums">
            {variety}<span className="text-slate-600 text-sm">/{maxVariety}</span>
          </div>
          <div className="text-[7px] font-mono uppercase text-slate-600">games tried</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-500"
          style={{ width: `${varietyPct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {milestones.map((m) => {
          const done = variety >= m.at;
          return (
            <span
              key={m.at}
              className={`text-[8px] font-mono px-2 py-1 rounded-lg border ${
                done
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                  : 'border-slate-800/80 text-slate-600'
              }`}
            >
              {m.icon} {m.label} · {m.at}
            </span>
          );
        })}
        <span className="text-[8px] font-mono px-2 py-1 rounded-lg border border-slate-800/80 text-slate-600">
          ⚔️ Coin Duelist · 100 ({total >= 100 ? '✓' : `${total}/100`})
        </span>
        <span className="text-[8px] font-mono px-2 py-1 rounded-lg border border-slate-800/80 text-slate-600">
          🏟️ Gladiator · 500 ({total >= 500 ? '✓' : `${total}/500`})
        </span>
      </div>
      <p className="text-[8px] font-mono text-slate-600">
        {total.toLocaleString('en-US')} total matches · per-game Debut / Victor / Fighter achievements on every title
      </p>
    </div>
  );
}

function LeaderMini({
  title,
  icon,
  rows,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  rows: GameLeaderboardSlice['wins'];
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-black/25 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800/60 flex items-center gap-2 text-[9px] font-mono uppercase text-slate-500">
        {icon}
        {title}
      </div>
      <div className="p-2 space-y-1">
        {rows.slice(0, 5).map((r) => (
          <div key={r.rank} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/[0.02]">
            <span className={`text-[9px] font-mono w-5 ${accent}`}>#{r.rank}</span>
            <img src={safeAvatarUrl(r.avatarUrl, r.username)} alt={r.displayName} className="w-6 h-6 rounded-md border border-slate-700/50" />
            <span className="text-[10px] text-slate-300 truncate flex-1">{r.displayName}</span>
            <span className={`text-[10px] font-mono font-bold tabular-nums ${accent}`}>{r.value}</span>
          </div>
        ))}
        {!rows.length && <p className="text-[9px] font-mono text-slate-600 px-2 py-3 text-center">No games yet</p>}
      </div>
    </div>
  );
}

export function GamesPage() {
  const { user, isLoggedIn, loading: authLoading, syncAchievements, refresh } = useAuth();
  const [selectedGame, setSelectedGame] = useState<GameId>('rps');
  const catalog = GAME_CATALOG_MAP[selectedGame];
  const [state, setState] = useState<GamesState | null>(null);
  const [boards, setBoards] = useState<GamesLeaderboard | null>(null);
  const [metaError, setMetaError] = useState('');
  const [pollError, setPollError] = useState('');
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [bet, setBet] = useState(10);
  const [mode, setMode] = useState<'pvp' | 'bot'>('pvp');
  const [seriesType, setSeriesType] = useState<RpsSeriesType>('single');
  const [difficulty, setDifficulty] = useState('normal');
  const [roomCode, setRoomCode] = useState('');
  const [match, setMatch] = useState<AnyMatch | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<GameCategory | 'all'>('all');
  const [gameSearch, setGameSearch] = useState('');
  const [coinFeedTick, setCoinFeedTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actingRef = useRef(false);
  const pendingLoadRef = useRef(false);
  const pendingLoadGameIdRef = useRef<GameId | null>(null);
  const selectedGameRef = useRef<GameId>(selectedGame);
  const initialLoadDoneRef = useRef(false);
  const matchSeqRef = useRef(0);
  const celebratedMatches = useRef(new Set<string>());
  const dismissedMatches = useRef(new Set<string>());
  const prevGameRef = useRef<GameId>(selectedGame);
  const lastSettings = useRef({ bet: 10, mode: 'pvp' as const, seriesType: 'single' as RpsSeriesType, difficulty: 'normal', roomCode: '' });
  const mountedRef = useRef(true);
  const metaGenRef = useRef(0);
  const loadGenRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;

  useEffect(() => {
    void import('../../lib/arcadeCleanup').then((m) => {
      m.registerArcadeSnapshot(state, { waiting, selectedGame });
    });
  }, [state, waiting, selectedGame]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void import('../../lib/arcadeCleanup').then((m) => m.leaveAllArcadeQueuesBestEffort());
    };
  }, []);

  useEffect(() => {
    actingRef.current = acting;
  }, [acting]);

  useEffect(() => {
    selectedGameRef.current = selectedGame;
  }, [selectedGame]);

  const setMatchAuthoritative = useCallback((m: AnyMatch | null) => {
    matchSeqRef.current += 1;
    setMatch(m);
  }, []);

  const applySliceState = useCallback((slice: ReturnType<typeof getGameSlice>, seqBefore?: number) => {
    if (actingRef.current) return;
    if (seqBefore != null && matchSeqRef.current !== seqBefore) return;
    const queued = Boolean(slice?.inQueue);
    let serverMatch = slice?.activeMatch ?? null;
    if (serverMatch?.status === 'done' && dismissedMatches.current.has(serverMatch.id)) {
      serverMatch = null;
    }
    const playing = serverMatch?.status === 'playing';
    if (queued) {
      setWaiting(!playing);
      if (serverMatch?.status === 'done') {
        setMatch(serverMatch);
      } else {
        setMatch(playing ? serverMatch : null);
      }
    } else if (serverMatch) {
      setMatch(serverMatch);
      setWaiting(false);
    } else {
      setMatch(null);
      setWaiting(false);
    }
    if (slice?.queueBet) setBet(slice.queueBet);
    if (slice?.queueRoomCode) setRoomCode(slice.queueRoomCode);
  }, []);

  const celebrateMatchDone = useCallback((m: AnyMatch) => {
    if (celebratedMatches.current.has(m.id)) return;
    celebratedMatches.current.add(m.id);
    void syncAchievements().then(() => {
      if (!mountedRef.current) return;
      setCoinFeedTick((t) => t + 1);
    }).catch(() => {});
    const outcome = matchOutcomeForUser(m, user?.id);
    const parts = [];
    if (m.result?.outcome === 'expired') parts.push('Match expired — refunded');
    else if (m.jackpotHit) parts.push(`🎰 JACKPOT +${m.jackpotAmount}`);
    else if (outcome === 'win') parts.push('Victory!');
    else if (outcome === 'draw') parts.push('Draw — refunded');
    else parts.push('Defeat');
    if (m.streakBonus > 0) parts.push(`+${m.streakBonus} streak`);
    if (mountedRef.current) setMsg(parts.join(' · '));
    if (mountedRef.current) void refresh();
  }, [user?.id, syncAchievements, refresh]);

  const loadMeta = useCallback(async () => {
    const gen = ++metaGenRef.current;
    try {
      const [b, h] = await Promise.all([
        fetchGamesLeaderboard(),
        fetchGamesHistory(20),
      ]);
      if (gen !== metaGenRef.current || !mountedRef.current) return;
      setBoards(b);
      setHistory(h.matches);
      setMetaError('');
    } catch (e) {
      if (gen !== metaGenRef.current || !mountedRef.current) return;
      setMetaError(e instanceof Error ? e.message : 'Failed to load leaderboard data');
    }
  }, []);

  const beginAction = useCallback(() => {
    actingRef.current = true;
    setActing(true);
  }, []);

  const load = useCallback(async (opts?: { gameId?: GameId; applySlice?: boolean }) => {
    const gameId = opts?.gameId ?? selectedGameRef.current;
    const gen = ++loadGenRef.current;
    if (actingRef.current) {
      pendingLoadRef.current = true;
      pendingLoadGameIdRef.current = gameId;
      return;
    }
    pendingLoadRef.current = false;
    pendingLoadGameIdRef.current = null;
    const seqBefore = matchSeqRef.current;
    try {
      const s = await fetchGamesState();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      if (actingRef.current || matchSeqRef.current !== seqBefore) {
        pendingLoadRef.current = true;
        pendingLoadGameIdRef.current = gameId;
        return;
      }
      if (gameId !== selectedGameRef.current) return;
      setState(s);
      if (opts?.applySlice !== false) {
        const slice = s.games?.[gameId] ?? s[gameId as 'rps' | 'ttt'];
        applySliceState(slice, matchSeqRef.current);
      }
      setError('');
    } catch (e) {
      if (gen === loadGenRef.current && mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Load failed');
      }
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [applySliceState]);

  const pollState = useCallback(async (opts?: {
    force?: boolean;
    gameId?: GameId;
    applySlice?: boolean;
  }): Promise<GamesState | null> => {
    if (!opts?.force && actingRef.current) return null;
    const seqBefore = matchSeqRef.current;
    try {
      const s = await fetchGamesState();
      if (!opts?.force && (actingRef.current || matchSeqRef.current !== seqBefore)) return null;
      if (!mountedRef.current) return null;
      setState(s);
      if (opts?.applySlice !== false) {
        const game = opts?.gameId ?? selectedGameRef.current;
        const slice = s.games?.[game] ?? s[game as 'rps' | 'ttt'];
        applySliceState(slice, seqBefore);
      }
      setPollError('');
      return s;
    } catch (e) {
      if (mountedRef.current) setPollError(e instanceof Error ? e.message : 'Sync lost — retry');
      return null;
    }
  }, [applySliceState]);

  const endActionAndSync = useCallback(async (opts?: {
    gameId?: GameId;
    applySlice?: boolean;
  }) => {
    setActing(false);
    actingRef.current = false;
    await pollState({ force: true, gameId: opts?.gameId, applySlice: opts?.applySlice });
    if (opts?.applySlice === false) {
      pendingLoadRef.current = false;
      pendingLoadGameIdRef.current = null;
      return;
    }
    if (pendingLoadRef.current) {
      pendingLoadRef.current = false;
      const gid = pendingLoadGameIdRef.current ?? opts?.gameId ?? selectedGameRef.current;
      pendingLoadGameIdRef.current = null;
      await load({ gameId: gid });
    }
  }, [pollState, load]);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    void load();
    void loadMeta();
  }, [load, loadMeta, authLoading, isLoggedIn]);

  const wasLoggedInRef = useRef(false);
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn && wasLoggedInRef.current) {
      const snap = stateRef.current;
      void (async () => {
        if (waitingRef.current) {
          try { await leaveGameQueue(selectedGameRef.current); } catch { /* best-effort */ }
        }
        if (snap) {
          for (const g of GAME_CATALOG) {
            const slice = getGameSlice(snap, g.id);
            if (slice?.inQueue) {
              try { await leaveGameQueue(g.id); } catch { /* best-effort */ }
            }
          }
        }
      })();
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, authLoading]);

  useEffect(() => {
    if (isLoggedIn) return;
    initialLoadDoneRef.current = false;
    celebratedMatches.current.clear();
    dismissedMatches.current.clear();
    setLoading(false);
    setState(null);
    setBoards(null);
    setMatch(null);
    setWaiting(false);
  }, [isLoggedIn]);

  useVisibilityAwarePoll(() => {
    if (!isLoggedIn || authLoading) return;
    void loadMeta();
  }, 60_000, isLoggedIn && !authLoading);

  useEffect(() => {
    setMsg('');
    if (selectedGame === 'dice100') setMode('bot');
  }, [selectedGame]);

  const selectGame = useCallback(async (id: GameId) => {
    if (acting || id === selectedGame) return;
    beginAction();
    let switchedTo: GameId | undefined;
    try {
      const fresh = (await pollState({ force: true, applySlice: false })) ?? state;
      const curSlice = fresh ? getGameSlice(fresh, selectedGame) : null;
      const playingHere = match?.status === 'playing' || curSlice?.activeMatch?.status === 'playing';
      const queuedHere = waiting || Boolean(curSlice?.inQueue);
      if (playingHere) {
        setError('Finish your current match first');
        return;
      }
      if (queuedHere) {
        setError('Leave your queue first');
        return;
      }
      if (fresh) {
        const blockedElsewhere = GAME_CATALOG.find((g) => {
          if (g.id === id) return false;
          const slice = getGameSlice(fresh, g.id);
          return slice?.activeMatch?.status === 'playing' || slice?.inQueue;
        });
        if (blockedElsewhere) {
          const slice = getGameSlice(fresh, blockedElsewhere.id);
          setError(
            slice?.activeMatch?.status === 'playing'
              ? `Finish your ${blockedElsewhere.shortLabel} match first`
              : `Leave your ${blockedElsewhere.shortLabel} queue first`,
          );
          return;
        }
      }
      const prev = prevGameRef.current;
      if (prev !== id && state) {
        const prevSlice = getGameSlice(state, prev);
        if (prevSlice?.activeMatch?.status === 'done') {
          dismissedMatches.current.add(prevSlice.activeMatch.id);
        }
        if (prevSlice?.inQueue) {
          await leaveGameQueue(prev);
          setCoinFeedTick((t) => t + 1);
        }
      }
      prevGameRef.current = id;
      setMatch(null);
      setWaiting(false);
      setSelectedGame(id);
      switchedTo = id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Switch failed');
    } finally {
      await endActionAndSync(switchedTo ? { gameId: switchedTo } : undefined);
    }
  }, [state, selectedGame, acting, match?.status, waiting, beginAction, endActionAndSync, pollState]);

  useEffect(() => {
    if (match?.status === 'done') celebrateMatchDone(match);
  }, [match?.id, match?.status, celebrateMatchDone]);

  useEffect(() => {
    if (!isLoggedIn || authLoading) {
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = null;
      return;
    }
    let cancelled = false;
    const schedulePoll = () => {
      if (cancelled) return;
      if (pollRef.current) clearTimeout(pollRef.current);
      const snap = stateRef.current;
      const anyPvpPlaying = GAME_CATALOG.some((g) => {
        const slice = getGameSlice(snap, g.id);
        return slice?.activeMatch?.status === 'playing' && slice.activeMatch.mode === 'pvp';
      });
      const anyQueued = GAME_CATALOG.some((g) => Boolean(getGameSlice(snap, g.id)?.inQueue));
      const fastPoll = anyPvpPlaying || waiting || anyQueued;
      pollRef.current = setTimeout(() => {
        if (!cancelled && !document.hidden) void pollState();
        schedulePoll();
      }, fastPoll ? 2000 : 8000);
    };
    schedulePoll();
    const onVisible = () => {
      if (!document.hidden) void pollState();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [waiting, pollState, isLoggedIn, authLoading]);

  const slice = getGameSlice(state, selectedGame);
  const stats = slice?.myStats ?? null;

  const leaveSelectedQueueIfNeeded = useCallback(async () => {
    const queued = waiting || Boolean(getGameSlice(state, selectedGame)?.inQueue);
    if (!queued) return;
    await leaveGameQueue(selectedGame);
    setWaiting(false);
    setCoinFeedTick((t) => t + 1);
  }, [waiting, state, selectedGame]);

  const earnedAchievementIds = useMemo(
    () => new Set((user?.achievements ?? []).map((a) => a.id)),
    [user?.achievements],
  );

  const filteredGames = useMemo(() => {
    const q = gameSearch.trim().toLowerCase();
    return GAME_CATALOG.filter((g) => {
      if (categoryFilter !== 'all' && g.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        g.label.toLowerCase().includes(q)
        || g.shortLabel.toLowerCase().includes(q)
        || g.id.includes(q)
        || g.tagline.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, gameSearch]);

  const queueGame = async (overrides?: Partial<typeof lastSettings.current>) => {
    if (!isLoggedIn) return;
    const fresh = (await pollState({ force: true, applySlice: false })) ?? state;
    if (fresh) {
      const blockedElsewhere = GAME_CATALOG.find((g) => {
        if (g.id === selectedGame) return false;
        const slice = getGameSlice(fresh, g.id);
        return slice?.activeMatch?.status === 'playing' || slice?.inQueue;
      });
      if (blockedElsewhere) {
        const slice = getGameSlice(fresh, blockedElsewhere.id);
        setError(
          slice?.activeMatch?.status === 'playing'
            ? `Finish your ${blockedElsewhere.shortLabel} match first`
            : `Leave your ${blockedElsewhere.shortLabel} queue first`,
        );
        return;
      }
    }
    if (match?.status === 'done' && match.id) {
      dismissedMatches.current.add(match.id);
    }
    // Dice 100 is solo house game — always bot/instant
    const forcedMode = selectedGame === 'dice100' ? 'bot' as const : mode;
    const settings = { bet, mode: forcedMode, seriesType, difficulty, roomCode, ...overrides };
    if (selectedGame === 'dice100') setMode('bot');
    lastSettings.current = settings;
    beginAction();
    setError('');
    setMsg('');
    let authoritativeMatch = false;
    try {
      const body: Record<string, unknown> = {
        bet: settings.bet,
        mode: settings.mode,
        botDifficulty: settings.difficulty,
        roomCode: settings.mode === 'pvp' && settings.roomCode.trim() ? settings.roomCode.trim() : undefined,
      };
      if (selectedGame === 'rps') body.seriesType = settings.seriesType;
      const res = await joinGameQueue(selectedGame, body);
      if (res.match) {
        setMatchAuthoritative(res.match);
        authoritativeMatch = true;
        setWaiting(false);
      } else {
        setWaiting(true);
        setMsg('Searching for opponent…');
      }
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Queue failed');
      setWaiting(false);
    } finally {
      await endActionAndSync({ applySlice: !authoritativeMatch });
    }
  };

  const cancelQueue = async () => {
    beginAction();
    try {
      await leaveGameQueue(selectedGame);
      setWaiting(false);
      setCoinFeedTick((t) => t + 1);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      await endActionAndSync();
    }
  };

  const playMove = async (move: string | number) => {
    if (!match) return;
    beginAction();
    setError('');
    let applySlice = false;
    try {
      const res = await submitGameMove(selectedGame, match.id, move);
      setMatchAuthoritative(res.match);
      setWaiting(false);
      if (res.roundComplete && res.match.status !== 'done') {
        setMsg('Round complete — next round!');
      }
      if (res.unlocks?.length) {
        void syncAchievements();
      }
      void refresh();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Move failed';
      setError(errMsg);
      if (errMsg.includes('expired') || errMsg.includes('not found') || errMsg.includes('Escrow')) {
        setMatch(null);
        setWaiting(false);
        applySlice = true;
        void refresh();
      }
    } finally {
      await endActionAndSync({ gameId: selectedGame, applySlice });
    }
  };

  const minBet = state?.minBet ?? 1;
  const streakBonusAtBet = stats?.nextStreakBonus
    ? Math.floor((stats.nextStreakBonus / minBet) * bet)
    : 0;

  const gameBoard = boards?.[selectedGame] as GameLeaderboardSlice | undefined;
  const sharedArena = {
    isLoggedIn,
    acting,
    waiting,
    bet,
    maxBet: state?.maxBet ?? 500,
    minBet: state?.minBet ?? 1,
    mode,
    difficulty,
    roomCode,
    queueSize: slice?.queueSize ?? 0,
    streak: stats?.streak,
    streakBonusHint: streakBonusAtBet,
    onBetChange: (v) => {
      setBet(v);
      lastSettings.current = { ...lastSettings.current, bet: v };
    },
    onModeChange: (m: 'pvp' | 'bot') => {
      void (async () => {
        beginAction();
        try {
          await leaveSelectedQueueIfNeeded();
          setMode(m);
          lastSettings.current = { ...lastSettings.current, mode: m };
          setMatch(null);
          setWaiting(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Mode change failed');
        } finally {
          await endActionAndSync();
        }
      })();
    },
    onDifficultyChange: (v) => {
      setDifficulty(v);
      lastSettings.current = { ...lastSettings.current, difficulty: v };
    },
    onRoomCodeChange: (v) => {
      setRoomCode(v);
      lastSettings.current = { ...lastSettings.current, roomCode: v };
    },
    onStart: () => void queueGame(),
    onCancel: () => void cancelQueue(),
    onRematch: () => {
      if (match?.status === 'done' && match.id) {
        dismissedMatches.current.add(match.id);
      }
      setMatch(null);
      void queueGame({ bet, mode, seriesType, difficulty, roomCode });
    },
    onPlayAgain: () => {
      if (match?.id) dismissedMatches.current.add(match.id);
      setMatch(null);
      setMsg('');
    },
  };

  const renderArena = () => {
    if (!catalog) return null;
    switch (catalog.arenaType) {
      case 'rps':
        return (
          <RpsArena
            {...sharedArena}
            userId={user?.id}
            match={match as RpsMatch | null}
            seriesType={seriesType}
            myDisplayName={user?.displayName}
            onSeriesChange={(s) => {
              void (async () => {
                beginAction();
                try {
                  await leaveSelectedQueueIfNeeded();
                  setSeriesType(s);
                  lastSettings.current = { ...lastSettings.current, seriesType: s };
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Series change failed');
                } finally {
                  await endActionAndSync();
                }
              })();
            }}
            onMove={(m) => void playMove(m)}
          />
        );
      case 'ttt':
        return (
          <TttArena
            {...sharedArena}
            userId={user?.id}
            match={match as TttMatch | null}
            myDisplayName={user?.displayName}
            onMove={(c) => void playMove(c)}
          />
        );
      case 'instant':
        return (
          <InstantArena
            catalog={catalog}
            {...sharedArena}
            userId={user?.id}
            match={match as import('../../lib/games').InstantMatch | null}
            onMove={(m) => void playMove(m)}
          />
        );
      case 'mines':
        return (
          <MinesArena
            catalog={catalog}
            {...sharedArena}
            userId={user?.id}
            match={match as import('../../lib/games').InstantMatch | null}
            onMove={(c) => void playMove(c)}
          />
        );
      case 'nim':
        return (
          <NimArena
            catalog={catalog}
            {...sharedArena}
            userId={user?.id}
            match={match as import('../../lib/games').NimMatch | null}
            onMove={(m) => void playMove(m)}
          />
        );
      case 'connect4':
        return (
          <Connect4Arena
            catalog={catalog}
            {...sharedArena}
            userId={user?.id}
            match={match as import('../../lib/games').Connect4Match | null}
            onMove={(c) => void playMove(c)}
          />
        );
      case 'dice100':
        return (
          <Dice100Arena
            catalog={catalog}
            isLoggedIn={sharedArena.isLoggedIn}
            userId={user?.id}
            acting={sharedArena.acting}
            waiting={sharedArena.waiting}
            match={match as import('../../lib/games').InstantMatch | null}
            bet={sharedArena.bet}
            maxBet={sharedArena.maxBet}
            minBet={sharedArena.minBet}
            streak={sharedArena.streak}
            streakBonusHint={sharedArena.streakBonusHint}
            onBetChange={sharedArena.onBetChange}
            onStart={sharedArena.onStart}
            onCancel={sharedArena.onCancel}
            onMove={(m) => void playMove(m)}
            onRematch={sharedArena.onRematch}
            onPlayAgain={sharedArena.onPlayAgain}
          />
        );
      default:
        return null;
    }
  };

  return (
    <PageShell
      id="games-module"
      pageId="games"
      icon="🎲"
      title="Games"
      subtitle={`LULcoin arcade · ${GAME_CATALOG.length} multiplayer games`}
      accentClass="text-rose-300"
    >
      <div className="space-y-5 max-w-5xl">
        {loading && !state && (
          <div className="text-center py-6 text-[10px] font-mono text-slate-600 rounded-2xl border border-slate-800/60 bg-black/20">
            <RefreshCw size={14} className="inline animate-spin mr-2" /> Loading arcade…
          </div>
        )}

        {isLoggedIn && <ArcadeVarietyCard state={state} />}

        {/* Game hub — modern overview cards */}
        <section className="games-hub">
          <header className="games-hub__header">
            <div className="min-w-0">
              <p className="games-hub__eyebrow">
                <Swords size={11} aria-hidden />
                Arcade hub · {filteredGames.length}/{GAME_CATALOG.length}
              </p>
              <h2 className="games-hub__title">Pick a game</h2>
              <p className="games-hub__subtitle">
                Browse the roster, read the rules, then queue PvP or BOT for LULcoins.
              </p>
            </div>
            <div className="games-hub__search">
              <Search size={13} className="games-hub__search-icon" aria-hidden />
              <input
                type="search"
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                aria-label="Search games"
                placeholder="Search games…"
                className="games-hub__search-input"
              />
            </div>
          </header>

          <div className="games-hub__filters" role="tablist" aria-label="Game categories">
            {GAME_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={categoryFilter === cat.id}
                aria-pressed={categoryFilter === cat.id}
                title={cat.hint}
                onClick={() => setCategoryFilter(cat.id)}
                className={`games-hub__filter ${categoryFilter === cat.id ? 'games-hub__filter--active' : ''}`}
              >
                <span className="games-hub__filter-label">{cat.label}</span>
                <span className="games-hub__filter-hint">{cat.hint}</span>
              </button>
            ))}
          </div>

          <div className="games-hub__grid arcade-game-grid">
            {filteredGames.map((g) => {
              const played = (getGameSlice(state, g.id)?.myStats?.games ?? 0) >= 1;
              const active = selectedGame === g.id;
              const wins = getGameSlice(state, g.id)?.myStats?.wins ?? 0;
              const gamesPlayed = getGameSlice(state, g.id)?.myStats?.games ?? 0;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={acting}
                  aria-pressed={active}
                  aria-label={`${g.label}${active ? ', selected' : ''}`}
                  onClick={() => void selectGame(g.id as GameId)}
                  className={`games-card ${active ? 'games-card--active' : ''} ${played ? 'games-card--played' : ''}`}
                >
                  <span className="games-card__glow" aria-hidden />
                  <div className="games-card__top">
                    <span className="games-card__icon" aria-hidden>{g.icon}</span>
                    <div className="games-card__badges">
                      <span className={`games-card__cat games-card__cat--${g.category}`}>{g.category}</span>
                      {played && <span className="games-card__played-dot" title="Played" />}
                    </div>
                  </div>
                  <h3 className="games-card__name">{g.label}</h3>
                  <p className="games-card__tagline">{g.tagline}</p>
                  <p className="games-card__desc">{g.description}</p>
                  <div className="games-card__footer">
                    {isLoggedIn ? (
                      <span className="games-card__stats">
                        {gamesPlayed > 0
                          ? `${wins}W · ${gamesPlayed} played`
                          : 'Not played yet'}
                      </span>
                    ) : (
                      <span className="games-card__stats">Sign in to play</span>
                    )}
                    {isLoggedIn && (
                      <GameAchievementBadges gameId={g.id as GameId} earnedIds={earnedAchievementIds} />
                    )}
                  </div>
                  {active && <span className="games-card__selected">Selected</span>}
                </button>
              );
            })}
            {!filteredGames.length && (
              <p className="games-hub__empty">No games match your filter</p>
            )}
          </div>
        </section>

        {catalog && (
          <div className={`games-selected rounded-2xl border p-4 sm:p-5 relative overflow-hidden bg-gradient-to-br via-[#0c0d12] ${catalog.bgClass}`}>
            <div className="games-selected__shine" aria-hidden />
            <div className="relative flex flex-wrap items-start gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="games-selected__icon text-4xl leading-none">{catalog.icon}</span>
                <div className="min-w-0">
                  <div className={`text-base sm:text-lg font-semibold tracking-tight ${catalog.accent}`}>{catalog.label}</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">{catalog.tagline} · Jackpot 0.6%</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-2 max-w-xl">{catalog.description}</p>
                  <ul className="games-selected__rules mt-2.5">
                    {catalog.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 ml-auto">
                {isLoggedIn && state?.myCoins != null && <LulCoinDisplay amount={state.myCoins} size="md" />}
                {state?.jackpot && (
                  <div className="text-right">
                    <div className="lul-coin-label lul-coin-label--sm mb-1">Jackpot Pool</div>
                    <div className="lul-coin-jackpot-pool">
                      🎰 <LulCoinAmount amount={state.jackpot.pool} variant="jackpot" size="xl" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedGame === 'rps' && state?.rps?.globalMoves && (
          <RpsGlobalMeta totals={state.rps.globalMoves.totals} favorite={state.rps.globalMoves.favorite} />
        )}

        {!isLoggedIn && (
          <div className="lul-coin-promo rounded-xl border px-4 py-3 text-[10px] font-mono text-indigo-200">
            Sign in to play — every member starts with <LulCoinAmount amount={1000} variant="balance" size="sm" suffix="LULcoins" />.
          </div>
        )}
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[10px] font-mono text-rose-300">{error}</div>}
        {msg && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-mono text-emerald-300">{msg}</div>}

        {isLoggedIn && state?.dailyBonus && (
          <DailyBonusCard
            bonus={state.dailyBonus}
            onClaimed={(coins, amount) => {
              setMsg(`Daily reload +${amount} LULcoins`);
              void refresh();
              void load();
              setCoinFeedTick((t) => t + 1);
            }}
            onError={(message) => setError(message)}
          />
        )}

        <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4">
          {renderArena()}

          <div className="space-y-3">
            {stats && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Wins', value: stats.wins, icon: <Trophy size={11} />, c: 'text-emerald-400' },
                  { label: 'Losses', value: stats.losses, icon: <Zap size={11} />, c: 'text-rose-400' },
                  { label: 'Games', value: stats.games, icon: <Swords size={11} />, c: 'text-violet-300' },
                  { label: 'Streak', value: stats.streak, icon: <Flame size={11} />, c: 'text-amber-300' },
                  { label: 'Best streak', value: stats.bestStreak, icon: <Crown size={11} />, c: 'text-amber-200' },
                  { label: 'Jackpots', value: stats.jackpotsWon, icon: <Coins size={11} />, c: 'text-amber-400' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-800/80 bg-black/25 px-3 py-2">
                    <div className="flex items-center gap-1 text-[7px] font-mono uppercase text-slate-600">{s.icon}{s.label}</div>
                    <div className={`text-lg font-mono font-bold tabular-nums ${s.c}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
            {selectedGame === 'rps' && stats && 'moves' in stats && (
              <RpsMoveTendency moves={(stats as RpsStats).moves} />
            )}
            {catalog && (
              <div className="rounded-xl border border-slate-800/60 bg-black/20 p-3 text-[8px] font-mono text-slate-600 space-y-1.5">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-[7px]">Rules</p>
                {catalog.rules.map((r) => <p key={r}>✓ {r}</p>)}
                <p>✓ PvP win: 0.6% jackpot · Streak bonus up to 25%</p>
                <p>✓ BOT loss feeds jackpot pool</p>
              </div>
            )}
          </div>
        </div>

        {(metaError || pollError) && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[9px] font-mono text-amber-300/90">{pollError || metaError}</p>
            <button type="button" onClick={() => { setPollError(''); void (pollError ? pollState({ force: true }) : loadMeta()); }} className="text-[8px] font-mono text-amber-400 hover:text-amber-200 underline">Retry</button>
          </div>
        )}

        {gameBoard && 'wins' in gameBoard && (
          <div>
            <h3 className="text-[10px] font-mono uppercase text-slate-500 mb-2 flex items-center gap-2">
              <Trophy size={12} className="text-amber-400" /> {catalog?.shortLabel} Leaderboard
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <LeaderMini title="Wins" icon={<Trophy size={11} className="text-emerald-400" />} rows={gameBoard.wins} accent="text-emerald-400" />
              <LeaderMini title="Losses" icon={<Zap size={11} className="text-rose-400" />} rows={gameBoard.losses} accent="text-rose-400" />
              <LeaderMini title="Games" icon={<Swords size={11} className="text-violet-400" />} rows={gameBoard.games} accent="text-violet-300" />
              <LeaderMini title="Streaks" icon={<Flame size={11} className="text-amber-400" />} rows={gameBoard.streaks} accent="text-amber-300" />
            </div>
          </div>
        )}

        {isLoggedIn && <CoinEarningsFeed refreshKey={coinFeedTick} />}

        <MatchTicker matches={history} />
      </div>
    </PageShell>
  );
}