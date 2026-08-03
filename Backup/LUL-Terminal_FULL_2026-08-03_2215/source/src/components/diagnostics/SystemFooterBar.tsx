/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

type SystemFooterBarProps = {
  onLowBattery: (level: number) => void;
  onBatteryCycle: (message: string, type: 'warn' | 'success') => void;
  playBeep: (freq: number, duration: number, type: OscillatorType) => void;
};

function formatSessionTime(totalSecs: number) {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return [
    hrs > 0 ? String(hrs).padStart(2, '0') : null,
    String(mins).padStart(2, '0'),
    String(secs).padStart(2, '0'),
  ].filter(Boolean).join(':');
}

export function SystemFooterBar({ onLowBattery, onBatteryCycle, playBeep }: SystemFooterBarProps) {
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [systemLoad, setSystemLoad] = useState(14.8);
  const [batteryDrainOffset, setBatteryDrainOffset] = useState(0);
  const [hasWarnedBattery, setHasWarnedBattery] = useState(false);

  const batteryLevel = Math.max(
    0,
    parseFloat((100 - sessionSeconds / 36.0 - batteryDrainOffset).toFixed(1)),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      setSystemLoad(parseFloat((5 + Math.random() * 40).toFixed(1)));
    };
    tick();
    const timer = setInterval(tick, 2000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    if (batteryLevel <= 20 && !hasWarnedBattery) {
      onLowBattery(batteryLevel);
      playBeep(330, 0.5, 'square');
      setHasWarnedBattery(true);
    }
  }, [batteryLevel, hasWarnedBattery, onLowBattery, playBeep]);

  const cycleBatteryLevel = () => {
    if (batteryLevel > 25) {
      const neededOffset = 100 - sessionSeconds / 36.0 - 15;
      setBatteryDrainOffset(neededOffset);
      onBatteryCycle('⚡ Discharge trigger: Forced system battery down to 15%.', 'warn');
      playBeep(450, 0.15, 'sawtooth');
    } else if (batteryLevel > 5) {
      const neededOffset = 100 - sessionSeconds / 36.0 - 5;
      setBatteryDrainOffset(neededOffset);
      onBatteryCycle('⚡ Discharge trigger: Forced system battery down to 5%.', 'warn');
      playBeep(350, 0.15, 'sawtooth');
    } else {
      setBatteryDrainOffset(0);
      setHasWarnedBattery(false);
      onBatteryCycle('🔌 Grid connected: Battery power level restored to 100%.', 'success');
      playBeep(880, 0.25, 'sine');
    }
  };

  return (
    <footer
      className="h-7 bg-[#020617] border-t border-slate-800/50 px-4 flex items-center justify-between text-[11px] text-slate-500 uppercase tracking-widest font-mono select-none"
      id="system-footer-rail"
    >
      <div className="flex items-center gap-3" id="system-footer-left">
        <span className="text-indigo-400">SYSTEM LOAD: {systemLoad}%</span>
        <span className="text-slate-800">|</span>
        <button
          onClick={cycleBatteryLevel}
          className={`flex items-center gap-1 hover:text-white transition-all font-bold cursor-pointer ${
            batteryLevel <= 20 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
          }`}
          title="Virtual battery level (Click to manually discharge/recharge for testing!)"
          id="system-battery-btn"
        >
          🔋 {batteryLevel}% {batteryLevel <= 20 ? 'LOW' : 'OK'}
        </button>
        <span className="text-slate-800">|</span>
        <span>Status: {batteryLevel <= 20 ? 'Warning' : 'Optimal'}</span>
      </div>
      <span>Made with ❤️ by LUL</span>
      <div className="flex items-center gap-4" id="system-footer-right">
        <span className="text-[#a5b4fc] font-bold">SESSION: {formatSessionTime(sessionSeconds)}</span>
        <span className="text-slate-800">|</span>
        <span className="flex items-center gap-1.5" id="footer-connection-laser">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Link Established
        </span>
      </div>
    </footer>
  );
}