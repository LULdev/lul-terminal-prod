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
  isLoggedIn: boolean;
  onRated?: (avg: number, count: number, userRating: number) => void;
  size?: 'sm' | 'md';
};

export function PasteStarRating({
  pasteId,
  ratingAvg,
  ratingCount,
  userRating,
  isLoggedIn,
  onRated,
  size = 'md',
}: Props) {
  const [avg, setAvg] = useState(ratingAvg);
  const [count, setCount] = useState(ratingCount);
  const [mine, setMine] = useState(userRating ?? 0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAvg(ratingAvg);
    setCount(ratingCount);
    setMine(userRating ?? 0);
  }, [pasteId, ratingAvg, ratingCount, userRating]);

  const iconSize = size === 'sm' ? 14 : 18;
  const display = hover || mine || Math.round(avg);

  const submit = async (stars: number) => {
    if (!isLoggedIn || busy) return;
    setBusy(true);
    try {
      const result = await ratePaste(pasteId, stars);
      setAvg(result.ratingAvg);
      setCount(result.ratingCount);
      setMine(result.userRating);
      onRated?.(result.ratingAvg, result.ratingCount, result.userRating);
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  };

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
                disabled={!isLoggedIn || busy}
                onMouseEnter={() => isLoggedIn && setHover(n)}
                onClick={() => submit(n)}
                className={`p-0.5 rounded transition-transform ${
                  isLoggedIn ? 'hover:scale-110 cursor-pointer' : 'cursor-default opacity-90'
                } ${busy ? 'opacity-50' : ''}`}
                title={isLoggedIn ? `Rate ${n} star${n > 1 ? 's' : ''}` : 'Sign in to rate'}
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
      {!isLoggedIn && (
        <p className="text-[7px] font-mono text-slate-600">Sign in to rate this paste</p>
      )}
      {isLoggedIn && mine > 0 && (
        <p className="text-[7px] font-mono text-amber-400/70">Your rating: {mine}★</p>
      )}
    </div>
  );
}