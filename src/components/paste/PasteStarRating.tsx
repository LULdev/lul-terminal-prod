/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { ratePaste } from '../../lib/paste';

type Props = {
  pasteId: string;
  ratingAvg: number;
  ratingCount: number;
  userRating?: number | null;
  /** When false, stars are display-only until lock expires (from server). */
  canRate?: boolean;
  ratingLockedUntil?: number | null;
  onRated?: (avg: number, count: number, userRating: number, lockedUntil?: number | null) => void;
  size?: 'sm' | 'md';
};

function formatLockRemaining(lockedUntil: number | null | undefined): string {
  if (!lockedUntil) return '';
  const ms = lockedUntil - Date.now();
  if (ms <= 0) return '';
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours >= 24) return '~24h';
  if (hours <= 1) {
    const mins = Math.max(1, Math.ceil(ms / 60_000));
    return `~${mins}m`;
  }
  return `~${hours}h`;
}

export function PasteStarRating({
  pasteId,
  ratingAvg,
  ratingCount,
  userRating,
  canRate = true,
  ratingLockedUntil = null,
  onRated,
  size = 'md',
}: Props) {
  const [avg, setAvg] = useState(ratingAvg);
  const [count, setCount] = useState(ratingCount);
  const [mine, setMine] = useState(userRating ?? 0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | null>(ratingLockedUntil ?? null);
  const [allowRate, setAllowRate] = useState(canRate);

  useEffect(() => {
    setAvg(ratingAvg);
    setCount(ratingCount);
    setMine(userRating ?? 0);
    setLockedUntil(ratingLockedUntil ?? null);
    setAllowRate(canRate);
    setError('');
  }, [pasteId, ratingAvg, ratingCount, userRating, canRate, ratingLockedUntil]);

  // Re-enable stars when 24h lock expires (client-side)
  useEffect(() => {
    if (!lockedUntil) return;
    const ms = lockedUntil - Date.now();
    if (ms <= 0) {
      setAllowRate(true);
      setLockedUntil(null);
      return;
    }
    const t = window.setTimeout(() => {
      setAllowRate(true);
      setLockedUntil(null);
    }, Math.min(ms + 50, 2_147_000_000));
    return () => window.clearTimeout(t);
  }, [lockedUntil]);

  const iconSize = size === 'sm' ? 14 : 18;
  const display = hover || mine || Math.round(avg);
  const interactive = allowRate && !busy;

  const submit = async (stars: number) => {
    if (!allowRate || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await ratePaste(pasteId, stars);
      setAvg(result.ratingAvg);
      setCount(result.ratingCount);
      setMine(result.userRating);
      setAllowRate(result.canRate !== false ? Boolean(result.canRate) : false);
      setLockedUntil(result.lockedUntil ?? null);
      onRated?.(result.ratingAvg, result.ratingCount, result.userRating, result.lockedUntil ?? null);
    } catch (e) {
      const err = e as Error & {
        code?: string;
        userRating?: number;
        lockedUntil?: number;
        ratingAvg?: number;
        ratingCount?: number;
      };
      const msg = err instanceof Error ? err.message : 'Rating failed';
      if (err.code === 'RATE_LOCKED' || /already rated/i.test(msg)) {
        if (typeof err.userRating === 'number') setMine(err.userRating);
        if (typeof err.ratingAvg === 'number') setAvg(err.ratingAvg);
        if (typeof err.ratingCount === 'number') setCount(err.ratingCount);
        if (typeof err.lockedUntil === 'number') {
          setLockedUntil(err.lockedUntil);
          setAllowRate(false);
        }
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const lockHint = formatLockRemaining(lockedUntil);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= (hover || display);
            return (
              <button
                key={n}
                type="button"
                disabled={!interactive}
                onMouseEnter={() => interactive && setHover(n)}
                onClick={() => submit(n)}
                className={`p-0.5 rounded transition-transform ${
                  interactive ? 'hover:scale-110 cursor-pointer' : 'cursor-default opacity-90'
                } ${busy ? 'opacity-50' : ''}`}
                title={
                  interactive
                    ? `Rate ${n} star${n > 1 ? 's' : ''}`
                    : lockHint
                      ? `Rated — next change in ${lockHint}`
                      : mine
                        ? `Your rating: ${mine}★`
                        : 'Rating locked'
                }
              >
                <Star
                  size={iconSize}
                  className={filled ? 'text-amber-400 fill-amber-400/85' : 'text-slate-600'}
                />
              </button>
            );
          })}
        </div>
        <div className="flex flex-col leading-none">
          <span className={`font-mono font-bold tabular-nums text-amber-200 ${size === 'sm' ? 'text-[11px]' : 'text-[13px]'}`}>
            {avg > 0 ? avg.toFixed(1) : '—'}
          </span>
          <span className={`font-mono text-slate-500 ${size === 'sm' ? 'text-[7px]' : 'text-[8px]'}`}>
            {count > 0 ? `${count} rating${count === 1 ? '' : 's'}` : 'No ratings yet'}
          </span>
        </div>
      </div>
      {mine > 0 && !error && (
        <p className="text-[7px] font-mono text-amber-400/70">
          Your rating: {mine}★
          {lockHint ? ` · locked ${lockHint}` : ''}
        </p>
      )}
      {!mine && allowRate && !error && (
        <p className="text-[7px] font-mono text-slate-600">Guests may rate · 1 vote / 24h per network</p>
      )}
      {error && (
        <p className="text-[7px] font-mono text-rose-400" role="alert">{error}</p>
      )}
    </div>
  );
}
