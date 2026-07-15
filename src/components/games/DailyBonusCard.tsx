/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Gift, Sparkles } from 'lucide-react';
import { claimDailyBonus, type DailyBonusInfo } from '../../lib/games';
import { LulCoinAmount } from './LulCoinAmount';

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function DailyBonusCard({
  bonus,
  compact = false,
  onClaimed,
  onError,
}: {
  bonus: DailyBonusInfo;
  compact?: boolean;
  onClaimed?: (coins: number, amount: number) => void;
  onError?: (message: string) => void;
}) {
  const [remainingMs, setRemainingMs] = useState(bonus.remainingMs);
  const [claiming, setClaiming] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setRemainingMs(bonus.remainingMs);
  }, [bonus.remainingMs, bonus.canClaim]);

  useEffect(() => {
    if (bonus.canClaim) return;
    const tick = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [bonus.canClaim]);

  const canClaim = bonus.canClaim;
  const progress = canClaim
    ? 1
    : 1 - remainingMs / Math.max(1, bonus.cooldownMs);
  const circumference = 2 * Math.PI * 28;

  const handleClaim = useCallback(async () => {
    if (!canClaim || claiming) return;
    setClaiming(true);
    try {
      const res = await claimDailyBonus();
      setPulse(true);
      setTimeout(() => setPulse(false), 1200);
      setRemainingMs(res.remainingMs ?? bonus.cooldownMs);
      onClaimed?.(res.coins, res.bonus);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Bonus unavailable');
    } finally {
      setClaiming(false);
    }
  }, [bonus.cooldownMs, canClaim, claiming, onClaimed, onError]);

  if (compact) {
    return (
      <button
        type="button"
        disabled={!canClaim || claiming}
        onClick={() => void handleClaim()}
        className={`group relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all ${
          canClaim
            ? 'daily-bonus-ready border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-amber-500/10 hover:border-emerald-300/55'
            : 'border-slate-700/60 bg-slate-900/40 opacity-90 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            canClaim ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200' : 'border-slate-700/50 bg-slate-800/50 text-slate-500'
          }`}>
            {canClaim ? <Gift size={16} /> : <Clock size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Daily reload</p>
            <p className={`text-[11px] font-mono font-bold flex items-center gap-1 flex-wrap ${canClaim ? 'text-emerald-200' : 'text-slate-400'}`}>
              {canClaim ? (
                <><LulCoinAmount amount={bonus.amount} variant="earn" size="sm" suffix="LULcoins" /> ready</>
              ) : formatCountdown(remainingMs)}
            </p>
          </div>
          {canClaim && (
            <span className="text-[9px] font-mono uppercase text-emerald-300/80 group-hover:text-emerald-200">Claim</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        canClaim
          ? 'daily-bonus-ready border-emerald-400/35 bg-gradient-to-br from-emerald-950/40 via-[#0c1210] to-amber-950/30'
          : 'border-slate-800/80 bg-black/30'
      } ${pulse ? 'daily-bonus-pulse' : ''}`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 p-4">
        <div className="relative mx-auto sm:mx-0 shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(51,65,85,0.5)" strokeWidth="5" />
            <circle
              cx="36"
              cy="36"
              r="28"
              fill="none"
              stroke={canClaim ? 'rgba(52,211,153,0.85)' : 'rgba(245,158,11,0.55)'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {canClaim ? (
              <Gift size={22} className="text-emerald-300 daily-bonus-icon-bounce" />
            ) : (
              <>
                <Clock size={14} className="text-amber-400/80 mb-0.5" />
                <span className="text-[9px] font-mono font-bold tabular-nums text-amber-200">{formatCountdown(remainingMs)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-1">
            <Sparkles size={12} className="text-amber-400" />
            <h4 className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
              Daily <span className="lul-coin-label lul-coin-label--md">LULcoin</span> Drop
            </h4>
          </div>
          <p className="text-sm font-semibold text-slate-100">
            {canClaim ? (
              <span className="inline-flex items-center gap-1 flex-wrap">
                <LulCoinAmount amount={bonus.amount} variant="earn" size="md" suffix={false} />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-amber-200">coins waiting for you</span>
              </span>
            ) : (
              'Reloading vault…'
            )}
          </p>
          <p className="mt-1 text-[9px] font-mono text-slate-500">
            {canClaim ? '24h cooldown starts after claim' : 'Next claim unlocks when the timer hits zero'}
          </p>
        </div>

        <button
          type="button"
          disabled={!canClaim || claiming}
          onClick={() => void handleClaim()}
          className={`shrink-0 px-5 py-3 rounded-xl border text-[11px] font-mono font-bold uppercase tracking-wider transition-all ${
            canClaim
              ? 'daily-bonus-claim-btn border-emerald-400/50 bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-emerald-100 hover:from-emerald-500/35 hover:to-teal-500/30 hover:shadow-[0_0_20px_rgba(52,211,153,0.25)]'
              : 'border-slate-700/50 bg-slate-800/30 text-slate-500 cursor-not-allowed'
          }`}
        >
          {claiming ? 'Claiming…' : canClaim ? (
            <span className="inline-flex items-center gap-1">Claim <LulCoinAmount amount={bonus.amount} variant="earn" size="xs" suffix={false} /></span>
          ) : 'On cooldown'}
        </button>
      </div>
    </div>
  );
}