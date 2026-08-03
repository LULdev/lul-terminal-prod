/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import { APP_VERSION } from '../config/version';
import { useFirebaseStats } from '../hooks/useFirebaseStats';
import { useRegisteredUserCount } from '../hooks/useRegisteredUserCount';
import { useImageHostingStats } from '../hooks/useImageHostingStats';
import { usePasteStats } from '../hooks/usePasteStats';
import { useProxyDatabaseCount } from '../hooks/useProxyDatabaseCount';
import { usePremiumAccountCounts } from '../hooks/usePremiumAccountCounts';
import { setLiveStats } from '../lib/liveStatsStore';
import { VipBadge } from './auth/VipGate';
import { GreenPulseDot } from './ui/GreenPulseDot';

export const TerminalHeader = memo(function TerminalHeader() {
  const firebaseStats = useFirebaseStats();
  const registeredUsers = useRegisteredUserCount();
  const { imagesHosted } = useImageHostingStats();
  const { pastesCreated } = usePasteStats();
  const proxiesInDb = useProxyDatabaseCount();
  const { premium: premiumAccounts, free: freeAccounts } = usePremiumAccountCounts();

  const stats = useMemo(
    () => ({
      ...firebaseStats,
      registered: registeredUsers,
      imagesUploaded: imagesHosted,
      pastesCreated,
      proxiesInDb,
      premiumAccounts,
      freeAccounts,
    }),
    [firebaseStats, registeredUsers, imagesHosted, pastesCreated, proxiesInDb, premiumAccounts, freeAccounts],
  );

  useEffect(() => {
    setLiveStats(stats);
  }, [stats]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatNumber = (val: number) => {
    return val.toLocaleString('en-US');
  };

  return (
    <header 
      className="flex items-center justify-between min-h-[76px] h-[76px] px-8 bg-gradient-to-br from-[#111827] to-[#020617] border-b border-slate-700/50 shadow-2xl z-50 font-mono w-full select-none text-[16px] leading-normal" 
      id="terminal-header"
    >
      <div className="flex items-center gap-5 shrink-0" id="header-system-info">
        <div className="flex gap-2.5" id="control-dots">
          <div className="w-[18px] h-[18px] rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" id="dot-red" />
          <div className="w-[18px] h-[18px] rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" id="dot-yellow" />
          <div className="w-[18px] h-[18px] rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" id="dot-green" />
        </div>
        <span className="text-[#a5b4fc] font-bold tracking-[0.18em] text-[20px] ml-1" id="terminal-brand-title">LUL TERMINAL</span>
        <span className="text-slate-400 text-[15px] font-medium" id="terminal-version-tag">v{APP_VERSION}</span>
        <VipBadge />
      </div>

      <div className="flex items-center gap-8 bg-black/40 px-6 py-2.5 rounded-lg border border-slate-800/50" id="header-visitors-badge">
        <div className="text-[15px] tracking-normal" id="stats-online-container">
          <span className="text-slate-400 uppercase font-semibold">ONLINE:</span>
          <span className="text-green-400 font-bold ml-2 text-[17px] drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" id="stats-online-count">
            {formatNumber(stats.online)}
          </span>
        </div>
        <div className="text-[15px] tracking-normal" id="stats-hits-container">
          <span className="text-slate-400 uppercase font-semibold">HITS:</span>
          <span className="text-slate-100 font-bold ml-2 text-[17px]" id="stats-hits-count">
            {formatNumber(stats.hits)}
          </span>
        </div>
        <div className="text-[15px] tracking-normal" id="stats-unique-container">
          <span className="text-slate-400 uppercase font-semibold">UNIQUE:</span>
          <span className="text-slate-100 font-bold ml-2 text-[17px]" id="stats-unique-count">
            {formatNumber(stats.unique)}
          </span>
        </div>
        <div className="text-[15px] tracking-normal" id="stats-registered-container">
          <span className="text-slate-400 uppercase font-semibold">USERS:</span>
          <span className="text-violet-300 font-bold ml-2 text-[17px] drop-shadow-[0_0_8px_rgba(167,139,250,0.45)]" id="stats-registered-count">
            {formatNumber(stats.registered)}
          </span>
        </div>
        <div className="text-[15px] tracking-normal" id="stats-images-container">
          <span className="text-slate-400 uppercase font-semibold">IMAGES:</span>
          <span className="text-cyan-300 font-bold ml-2 text-[17px] drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]" id="stats-images-count">
            {formatNumber(stats.imagesUploaded)}
          </span>
        </div>
        <div className="text-[15px] tracking-normal" id="stats-pastes-container">
          <span className="text-slate-400 uppercase font-semibold">PASTES:</span>
          <span className="text-emerald-300 font-bold ml-2 text-[17px] drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]" id="stats-pastes-count">
            {formatNumber(stats.pastesCreated)}
          </span>
        </div>
        <div className="text-[15px] tracking-normal" id="stats-proxies-container">
          <span className="text-slate-400 uppercase font-semibold">PROXIES:</span>
          <span className="text-indigo-300 font-bold ml-2 text-[17px] drop-shadow-[0_0_8px_rgba(129,140,248,0.45)]" id="stats-proxies-count">
            {formatNumber(stats.proxiesInDb)}
          </span>
        </div>
        <div className="text-[15px] tracking-normal" id="stats-accounts-container">
          <span className="text-slate-400 uppercase font-semibold">ACCOUNTS:</span>
          <span className="text-amber-300 font-bold ml-2 text-[17px] drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]" id="stats-premium-count">
            {formatNumber(stats.premiumAccounts)}
          </span>
          <span className="text-slate-500 font-bold mx-1">/</span>
          <span className="text-lime-300 font-bold text-[17px] drop-shadow-[0_0_8px_rgba(132,204,22,0.45)]" id="stats-free-count">
            {formatNumber(stats.freeAccounts)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0" id="header-system-clock">
        <GreenPulseDot size="md" />
        <span className="text-green-400 font-bold text-[15px] tracking-normal drop-shadow-[0_0_5px_rgba(34,197,94,0.4)] tabular-nums whitespace-nowrap" id="live-time-ticker">
          {formatDateTime(now)}
        </span>
      </div>
    </header>
  );
});