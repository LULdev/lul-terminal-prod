/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  Eye,
  Lock,
  LogIn,
  RotateCcw,
  Search,
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
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { safePasteAssetUrl } from '../../lib/safePasteUrl';
import { PasteCodeView } from './PasteCodeView';
import { PasteStarRating } from './PasteStarRating';

type Props = { id: string };

export function PasteViewer({ id }: Props) {
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
  const mountedRef = useRef(true);

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

    (async () => {
      try {
        const data = await fetchPaste(id, { credentialed: isLoggedIn });
        if (cancelled) return;
        if ((data.requiresPassword || data.requiresLogin) && !data.content) {
          setPaste(data);
          setViews(data.views ?? 0);
          setRatingAvg(data.ratingAvg ?? 0);
          setRatingCount(data.ratingCount ?? 0);
          setUserRating(data.userRating ?? null);
          return;
        }
        if (!data.content) {
          setError('Paste not found or expired.');
          return;
        }
        setPaste(data);
        // Server already counted this view on GET (including owner's first view)
        setViews(data.views ?? 0);
        setRatingAvg(data.ratingAvg ?? 0);
        setRatingCount(data.ratingCount ?? 0);
        setUserRating(data.userRating ?? null);
        setViewsReady(true);
        // Only show burn warning when the paste was actually burn-after-read and consumed
        if (data.burned && data.burnAfterRead) {
          setError('This paste was burn-after-read and has been consumed.');
        }
        // Soft refresh of count (does not double-count or invent burn state)
        const viewResult = await recordPasteView(id, {
          knownViews: data.views ?? 0,
          burnAfterRead: Boolean(data.burnAfterRead),
        });
        if (cancelled) return;
        if (typeof viewResult.views === 'number') setViews(viewResult.views);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '';
          if (/permission|sign in|not logged/i.test(msg)) {
            setError(msg || 'Sign in required to view this paste.');
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
      const viewResult = await recordPasteView(id);
      if (!mountedRef.current) return;
      setViews(viewResult.views);
      setViewsReady(true);
      if (viewResult.burned || data.burned) {
        setError('This paste was burn-after-read and has been consumed.');
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Invalid password');
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

  const avatarUrl = paste?.username ? safeAvatarUrl(paste.avatarUrl, paste.username) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center">
        <p className="text-[11px] font-mono text-slate-500 animate-pulse">Loading paste…</p>
      </div>
    );
  }

  if (paste?.requiresLogin && !paste.content) {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
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
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
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
      <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-4xl opacity-40">📋</p>
        <p className="text-[12px] font-mono text-red-300/90 text-center max-w-sm">{error || 'Not found'}</p>
      </div>
    );
  }

  if (!paste?.content) {
    return (
      <div className="min-h-screen bg-[#07080c] flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-4xl opacity-40">📋</p>
        <p className="text-[12px] font-mono text-slate-500">Paste not found or expired.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080c] py-6 px-4 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-indigo-500/[0.03] pointer-events-none" />

      <div className="max-w-[min(100%,920px)] mx-auto flex flex-col gap-4 relative z-10">
        {error && (
          <p className="text-[10px] font-mono text-amber-300/90 text-center px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
            {error}
          </p>
        )}
        {/* Header card */}
        <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#12151c]/95 via-[#0c0d12] to-black/50 p-4 sm:p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-2 ring-emerald-500/30 border-2 border-[#0c0d12] shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                  <User size={18} className="text-slate-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">Paste</p>
                <h1 className="text-base sm:text-lg font-semibold text-white truncate">{paste.title}</h1>
                {paste.username ? (
                  <p className="text-[10px] font-mono text-emerald-300/90 mt-1">@{paste.username}</p>
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

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 transition-all duration-500 ${
                  viewsReady ? 'opacity-100' : 'opacity-60'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Eye size={16} className="text-emerald-300" />
                </div>
                <div className="leading-none">
                  <p className="text-[15px] font-mono font-bold text-emerald-200 tabular-nums">{formatPasteViews(views)}</p>
                  <p className="text-[8px] font-mono text-emerald-400/70 uppercase tracking-wider mt-0.5">
                    {views === 1 ? 'view' : 'views'}
                  </p>
                </div>
              </div>

              <PasteStarRating
                pasteId={id}
                ratingAvg={ratingAvg}
                ratingCount={ratingCount}
                userRating={userRating}
                isLoggedIn={Boolean(user)}
                onRated={(avg, count, ur) => {
                  setRatingAvg(avg);
                  setRatingCount(count);
                  setUserRating(ur);
                }}
              />
            </div>
          </div>
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