/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Crown,
  Eraser,
  Eye,
  Lock,
  LogIn,
  RotateCcw,
  Search,
  Shield,
  User,
} from 'lucide-react';
import {
  buildPasteUrl,
  copyToClipboard,
  dedupePasteLines,
  expiryLabel,
  fetchPaste,
  recordPasteView,
  findPasteSearchMatches,
  formatPasteBytes,
  formatPasteDate,
  formatPasteViews,
  pollPasteMeta,
  unlockPaste,
  type PasteRecord,
} from '../../lib/paste';
import { languageLabel } from '../../data/pasteLanguages';
import { useAuth } from '../../context/AuthContext';
import { fetchPublicProfile } from '../../lib/auth';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { safePasteAssetUrl } from '../../lib/safePasteUrl';
import { AdminUsername } from '../profile/AdminUsername';
import { VerifiedBadge } from '../auth/VerifiedBadge';
import type { UserRole } from '../../types/auth';
import { PasteCodeView } from './PasteCodeView';
import { PasteStarRating } from './PasteStarRating';

const AUTHOR_RING: Record<string, string> = {
  user: 'ring-slate-600/70',
  vip: 'ring-amber-500/50',
  admin: 'ring-violet-500/55',
  bot: 'ring-cyan-500/45',
};

type AuthorDisplay = {
  username: string;
  avatarUrl: string | null | undefined;
  role: UserRole | null;
  verified: boolean;
};

type Props = {
  id: string;
  /** When true, fill the App shell content pane (no full-viewport chrome). */
  embedded?: boolean;
};

function normalizeRole(raw: unknown): UserRole | null {
  const r = String(raw ?? '').toLowerCase();
  if (r === 'admin' || r === 'vip' || r === 'bot' || r === 'user') return r;
  return null;
}

export function PasteViewer({ id, embedded = false }: Props) {
  const { user, isLoggedIn, openAuth } = useAuth();
  const [paste, setPaste] = useState<PasteRecord | null>(null);
  const [views, setViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [viewsReady, setViewsReady] = useState(false);

  const [search, setSearch] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [dedupeActive, setDedupeActive] = useState(false);
  const [dedupeRemoved, setDedupeRemoved] = useState(0);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [canRate, setCanRate] = useState(true);
  const [ratingLockedUntil, setRatingLockedUntil] = useState<number | null>(null);
  /** Live author profile (same source as profile page) when paste meta is incomplete. */
  const [authorOverlay, setAuthorOverlay] = useState<AuthorDisplay | null>(null);
  const mountedRef = useRef(true);

  const shellClass = embedded
    ? 'h-full min-h-0 overflow-y-auto bg-[#07080c] relative'
    : 'min-h-screen bg-[#07080c] relative overflow-hidden';
  const padClass = embedded ? 'py-3 px-1 sm:px-2' : 'py-6 px-4 sm:px-8';

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const originalContent = paste?.content ?? '';
  const deduped = useMemo(
    () => (dedupeActive ? dedupePasteLines(originalContent) : null),
    [dedupeActive, originalContent],
  );
  const displayContent = deduped?.content ?? originalContent;

  const searchResult = useMemo(
    () => findPasteSearchMatches(displayContent, search),
    [displayContent, search],
  );
  const matchLines = useMemo(() => new Set(searchResult.lineNumbers), [searchResult.lineNumbers]);
  const activeLine = searchResult.lineNumbers.length
    ? searchResult.lineNumbers[matchIndex % searchResult.lineNumbers.length]
    : null;

  useEffect(() => {
    setMatchIndex(0);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setViewsReady(false);
    setDedupeActive(false);
    setDedupeRemoved(0);
    setSearch('');
    setAuthorOverlay(null);

    (async () => {
      try {
        // Always credentialed when session may exist so private pastes + author resolve correctly
        const data = await fetchPaste(id, { credentialed: true });
        if (cancelled) return;
        if ((data.requiresPassword || data.requiresLogin) && !data.content) {
          setPaste(data);
          setViews(data.views ?? 0);
          setRatingAvg(data.ratingAvg ?? 0);
          setRatingCount(data.ratingCount ?? 0);
          setUserRating(data.userRating ?? null);
          setCanRate(data.canRate !== false);
          setRatingLockedUntil(data.ratingLockedUntil ?? null);
          return;
        }
        if (!data.content) {
          setError('Paste not found or expired.');
          return;
        }
        setPaste(data);
        setViews(data.views ?? 0);
        setRatingAvg(data.ratingAvg ?? 0);
        setRatingCount(data.ratingCount ?? 0);
        setUserRating(data.userRating ?? null);
        setCanRate(data.canRate !== false);
        setRatingLockedUntil(data.ratingLockedUntil ?? null);
        // Only show burn warning when the paste was actually burn-after-read and consumed
        if (data.burned && data.burnAfterRead) {
          setError('This paste was burn-after-read and has been consumed.');
        }
        // Explicit POST /view — ensures owner/self first view is counted even if GET path skipped it
        const viewResult = await recordPasteView(id, {
          knownViews: data.views ?? 0,
          burnAfterRead: Boolean(data.burnAfterRead),
        });
        if (cancelled) return;
        if (typeof viewResult.views === 'number') setViews(viewResult.views);
        setViewsReady(true);
        if (viewResult.burned && data.burnAfterRead) {
          setError('This paste was burn-after-read and has been consumed.');
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '';
          if (/permission denied/i.test(msg)) {
            // Should not happen for public share links after gate fix — try to explain
            setError('Could not open this paste. If it is public, refresh or try again.');
          } else if (/sign in|not logged|requires login/i.test(msg)) {
            setError('Sign in required to view this private paste.');
          } else if (/not found|expired/i.test(msg)) {
            setError('Paste not found or expired.');
          } else if (/too many|429|rate/i.test(msg)) {
            setError('Too many requests — wait a moment and refresh.');
          } else if (msg) {
            setError(msg);
          } else {
            setError('Could not load paste — is the server running?');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, isLoggedIn, user?.id]);

  useEffect(() => {
    if (!paste?.content || paste.burned) return;
    return pollPasteMeta(id, (meta) => {
      setViews(meta.views ?? 0);
      setRatingAvg(meta.ratingAvg ?? 0);
      setRatingCount(meta.ratingCount ?? 0);
      setViewsReady(true);
    });
  }, [id, paste?.content, paste?.burned]);

  useEffect(() => {
    if (paste?.title && paste.content) {
      document.title = `${paste.title} · ${formatPasteViews(views)} views`;
    }
    return () => { document.title = 'LUL Terminal'; };
  }, [paste?.title, paste?.content, views]);

  const onUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setError('');
    try {
      const data = await unlockPaste(id, password);
      if (!mountedRef.current) return;
      setPaste(data);
      setViews(data.views ?? 0);
      setRatingAvg(data.ratingAvg ?? 0);
      setRatingCount(data.ratingCount ?? 0);
      setUserRating(data.userRating ?? null);
      setCanRate(data.canRate !== false);
      setRatingLockedUntil(data.ratingLockedUntil ?? null);
      setViewsReady(true);
      if (data.burned && data.burnAfterRead) {
        setError('This paste was burn-after-read and has been consumed.');
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Invalid password';
        setError(/not found/i.test(msg) ? 'Wrong password or paste not found' : msg);
      }
    } finally {
      if (mountedRef.current) setUnlocking(false);
    }
  };

  const toggleDedupe = () => {
    if (dedupeActive) {
      setDedupeActive(false);
      setDedupeRemoved(0);
      return;
    }
    const result = dedupePasteLines(originalContent);
    setDedupeRemoved(result.removed);
    setDedupeActive(true);
  };

  // Resolve author the same way the profile page does (live avatar, role, verified)
  useEffect(() => {
    const uname = paste?.username?.trim();
    if (!uname) {
      setAuthorOverlay(null);
      return;
    }
    let cancelled = false;
    const isOwn = Boolean(user && user.username.toLowerCase() === uname.toLowerCase());

    // Own paste: session user is the source of truth (matches profile picture after upload)
    if (isOwn && user) {
      setAuthorOverlay({
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: normalizeRole(user.role),
        verified: Boolean(user.verified),
      });
      return;
    }

    // Other authors: public profile API (same payload as /profile/:user)
    (async () => {
      try {
        const profile = await fetchPublicProfile(uname);
        if (cancelled || !mountedRef.current) return;
        setAuthorOverlay({
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          role: normalizeRole(profile.role),
          verified: Boolean(profile.verified),
        });
      } catch {
        // Fall back to paste API fields via useMemo
        if (!cancelled && mountedRef.current && (paste.authorRole || paste.avatarUrl || paste.authorVerified)) {
          setAuthorOverlay({
            username: uname,
            avatarUrl: paste.avatarUrl,
            role: normalizeRole(paste.authorRole),
            verified: Boolean(paste.authorVerified),
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [paste?.username, paste?.authorRole, paste?.avatarUrl, paste?.authorVerified, user?.id, user?.username, user?.avatarUrl, user?.role, user?.verified]);

  const author = useMemo((): AuthorDisplay | null => {
    if (!paste?.username) return null;
    const fromPasteRole = normalizeRole(paste.authorRole);
    const fromOverlay = authorOverlay;
    const fromSession =
      user && user.username.toLowerCase() === paste.username.toLowerCase()
        ? {
            username: user.username,
            avatarUrl: user.avatarUrl,
            role: normalizeRole(user.role),
            verified: Boolean(user.verified),
          }
        : null;

    // Prefer live profile overlay → session owner → paste API fields
    const role = fromOverlay?.role ?? fromSession?.role ?? fromPasteRole;
    const verified = fromOverlay?.verified
      ?? fromSession?.verified
      ?? Boolean(paste.authorVerified);
    const avatarUrl = fromOverlay?.avatarUrl
      ?? fromSession?.avatarUrl
      ?? paste.avatarUrl
      ?? null;
    const username = fromOverlay?.username ?? fromSession?.username ?? paste.username;
    return { username, avatarUrl, role, verified };
  }, [paste, authorOverlay, user]);

  const authorRole = author?.role ?? null;
  const avatarUrl = author
    ? safeAvatarUrl(author.avatarUrl ?? undefined, author.username)
    : null;
  const avatarRing = AUTHOR_RING[authorRole ?? 'user'] ?? AUTHOR_RING.user;
  const isAdminAuthor = authorRole === 'admin';
  const isVerifiedAuthor = Boolean(author?.verified);

  if (loading) {
    return (
      <div className={`${shellClass} flex items-center justify-center`}>
        <p className="text-[11px] font-mono text-slate-500 animate-pulse">Loading paste…</p>
      </div>
    );
  }

  if (paste?.requiresLogin && !paste.content) {
    return (
      <div className={`${shellClass} flex items-center justify-center p-4 sm:p-8`}>
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.04] via-transparent to-indigo-500/[0.03] pointer-events-none" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-violet-500/25 bg-[#0c0d12]/95 p-5 shadow-2xl text-center">
          <div className="w-11 h-11 mx-auto rounded-lg border border-violet-500/30 bg-violet-500/10 flex items-center justify-center mb-3">
            <Lock className="text-violet-300" size={18} />
          </div>
          <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-1">Private paste</p>
          <h1 className="text-sm font-semibold text-white mb-2">{paste.title}</h1>
          <p className="text-[10px] font-mono text-slate-400 leading-relaxed mb-4">
            This paste is private — only the author can view it. Sign in with your account to open it.
          </p>
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="inline-flex items-center justify-center gap-1.5 w-full text-[10px] font-mono font-bold border px-3 py-2 rounded transition bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border-violet-500/30"
          >
            <LogIn size={12} /> Sign in
          </button>
        </div>
      </div>
    );
  }

  if (paste?.requiresPassword && !paste.content) {
    return (
      <div className={`${shellClass} flex items-center justify-center p-4 sm:p-8`}>
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] via-transparent to-indigo-500/[0.03] pointer-events-none" />
        <form
          onSubmit={onUnlock}
          className="relative z-10 w-full max-w-md rounded-2xl border border-amber-500/25 bg-[#0c0d12]/95 p-5 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-center">
              <Lock className="text-amber-300" size={18} />
            </div>
            <div>
              <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Password protected</p>
              <h1 className="text-sm font-semibold text-white">{paste.title}</h1>
              <p className="text-[8px] font-mono text-amber-300/80 mt-0.5">{formatPasteViews(paste.views ?? 0)} views so far</p>
            </div>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full bg-[#0b0c10] border border-slate-800 text-[10px] font-mono rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-amber-500/60 mb-3"
            autoFocus
          />
          {error && <p className="text-[10px] font-mono text-rose-400 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={unlocking || !password}
            className="w-full text-[10px] font-mono font-bold border px-3 py-2 rounded transition disabled:opacity-40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
          >
            {unlocking ? 'Unlocking…' : 'Unlock paste'}
          </button>
        </form>
      </div>
    );
  }

  if (error && !paste?.content) {
    return (
      <div className={`${shellClass} flex flex-col items-center justify-center gap-3 p-6`}>
        <p className="text-4xl opacity-40">📋</p>
        <p className="text-[12px] font-mono text-red-300/90 text-center max-w-sm">{error || 'Not found'}</p>
      </div>
    );
  }

  if (!paste?.content) {
    return (
      <div className={`${shellClass} flex flex-col items-center justify-center gap-3 p-6`}>
        <p className="text-4xl opacity-40">📋</p>
        <p className="text-[12px] font-mono text-slate-500">Paste not found or expired.</p>
      </div>
    );
  }

  return (
    <div className={`${shellClass} ${padClass}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-indigo-500/[0.03] pointer-events-none" />

      <div className="max-w-[min(100%,920px)] mx-auto flex flex-col gap-4 relative z-10">
        {error && (
          <p className="text-[10px] font-mono text-amber-300/90 text-center px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
            {error}
          </p>
        )}
        {/* Header card — avatar, title, author, meta only */}
        <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#12151c]/95 via-[#0c0d12] to-black/50 p-4 sm:p-5 shadow-xl">
          <div className="flex items-start gap-3 min-w-0">
            {avatarUrl ? (
              <img
                key={avatarUrl}
                src={avatarUrl}
                alt={author?.username ? `@${author.username}` : 'Author'}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ${avatarRing} border-2 border-[#0c0d12] shrink-0 bg-slate-900 shadow-lg`}
                loading="lazy"
              />
            ) : (
              <div className={`w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0 ring-2 ${avatarRing}`}>
                <User size={18} className="text-slate-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">Paste</p>
              <h1 className="text-base sm:text-lg font-semibold text-white truncate">{paste.title}</h1>
              {author ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 min-w-0">
                  {isAdminAuthor ? (
                    <AdminUsername username={author.username} size="md" className="shrink-0" />
                  ) : authorRole === 'bot' ? (
                    <span className="bot-username-style text-[13px] shrink-0">@{author.username}</span>
                  ) : (
                    <span
                      className={`profile-display-name text-[13px] sm:text-sm font-semibold truncate shrink-0 ${
                        authorRole === 'vip' ? 'text-amber-200' : ''
                      } ${isAdminAuthor ? 'profile-display-name--admin' : ''}`}
                    >
                      @{author.username}
                    </span>
                  )}
                  {isVerifiedAuthor && (
                    <VerifiedBadge verified size={16} showLabel animated />
                  )}
                  {isAdminAuthor && (
                    <span className="profile-admin-badge" title="Administrator">
                      <Shield size={12} aria-hidden />
                      <span>Admin</span>
                    </span>
                  )}
                  {authorRole === 'vip' && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-amber-500/35 bg-amber-500/10 text-[8px] font-mono text-amber-300 uppercase tracking-wide">
                      <Crown size={10} aria-hidden />
                      VIP
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[10px] font-mono text-slate-500 mt-1">Anonymous</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2 text-[8px] font-mono text-slate-500">
                <span className="px-2 py-0.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">
                  {languageLabel(paste.language)}
                </span>
                <span>{formatPasteBytes(paste.size)}</span>
                <span>{formatPasteDate(paste.createdAt)}</span>
                <span>{expiryLabel(paste.expiresAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Views + rating — box below author card */}
        <div className="rounded-xl border border-slate-800/80 bg-black/40 px-3 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center gap-3 sm:gap-5">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 transition-opacity duration-500 ${
              viewsReady ? 'opacity-100' : 'opacity-60'
            }`}
            title={`${formatPasteViews(views)} views`}
          >
            <Eye size={12} className="text-emerald-400/90 shrink-0" />
            <span className="text-[11px] font-mono font-semibold text-emerald-200/95 tabular-nums leading-none">
              {formatPasteViews(views)}
            </span>
            <span className="text-[7px] font-mono text-emerald-500/70 uppercase tracking-wide leading-none">
              {views === 1 ? 'view' : 'views'}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800/80 hidden sm:block" aria-hidden />

          <PasteStarRating
            pasteId={id}
            ratingAvg={ratingAvg}
            ratingCount={ratingCount}
            userRating={userRating}
            canRate={canRate}
            ratingLockedUntil={ratingLockedUntil}
            size="sm"
            onRated={(avg, count, ur, lockedUntil) => {
              setRatingAvg(avg);
              setRatingCount(count);
              setUserRating(ur);
              setCanRate(false);
              setRatingLockedUntil(lockedUntil ?? Date.now() + 24 * 60 * 60 * 1000);
            }}
          />
        </div>

        {/* Toolbar */}
        <div className="rounded-xl border border-slate-800/80 bg-black/40 p-3 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[160px] relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in paste…"
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0b0c10] border border-slate-800 text-[10px] font-mono text-slate-300 focus:border-amber-500/40 focus:outline-none"
            />
          </div>
          {search.trim() && (
            <>
              <span className="text-[9px] font-mono text-amber-300/80 tabular-nums">
                {searchResult.matchCount} hit{searchResult.matchCount === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setMatchIndex((i) => (searchResult.lineNumbers.length ? (i - 1 + searchResult.lineNumbers.length) % searchResult.lineNumbers.length : 0))}
                disabled={!searchResult.lineNumbers.length}
                className="p-2 rounded-lg border border-slate-800 text-slate-500 hover:text-amber-300 disabled:opacity-40"
                title="Previous match"
              >
                <ChevronUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => setMatchIndex((i) => (searchResult.lineNumbers.length ? (i + 1) % searchResult.lineNumbers.length : 0))}
                disabled={!searchResult.lineNumbers.length}
                className="p-2 rounded-lg border border-slate-800 text-slate-500 hover:text-amber-300 disabled:opacity-40"
                title="Next match"
              >
                <ChevronDown size={12} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleDedupe}
            className={`flex items-center gap-1.5 text-[9px] font-mono px-3 py-2 rounded-lg border transition ${
              dedupeActive
                ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30'
            }`}
          >
            {dedupeActive ? <RotateCcw size={12} /> : <Eraser size={12} />}
            {dedupeActive ? `Restore (${dedupeRemoved} removed)` : 'Remove duplicates'}
          </button>
          {dedupeActive && dedupeRemoved > 0 && (
            <button
              type="button"
              onClick={() => copyToClipboard(displayContent)}
              className="flex items-center gap-1.5 text-[9px] font-mono px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-emerald-300"
            >
              <Copy size={12} /> Copy cleaned
            </button>
          )}
        </div>

        {dedupeActive && dedupeRemoved > 0 && (
          <p className="text-[9px] font-mono text-cyan-400/80 px-1">
            Showing deduplicated view — {dedupeRemoved} duplicate line{dedupeRemoved === 1 ? '' : 's'} removed (first occurrence kept).
          </p>
        )}

        <div className="rounded-2xl border border-slate-800 bg-[#12151c] overflow-hidden shadow-2xl shadow-black/50">
          <PasteCodeView
            content={displayContent}
            language={paste.language}
            maxHeight="min(72vh, 640px)"
            showHeader={false}
            views={views}
            searchQuery={search}
            activeLine={activeLine}
            matchLines={matchLines}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(buildPasteUrl(id))}
            className="text-[9px] font-mono px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition"
          >
            Copy link
          </button>
          {safePasteAssetUrl(paste.rawUrl) && (
            <a
              href={safePasteAssetUrl(paste.rawUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition"
            >
              Raw text ↗
            </a>
          )}
          <a href="/" className="text-[9px] font-mono px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-300/80 hover:bg-indigo-500/10 transition">
            LUL Terminal →
          </a>
        </div>
      </div>
    </div>
  );
}