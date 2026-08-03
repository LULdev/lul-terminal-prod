/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { AUTO_INTERVAL_MESSAGES } from '../../data/autoConsoleMessages';

type AppendLogFn = (msg: string, type?: 'info' | 'warn' | 'success' | 'alert') => void;

type SystemTelemetrySectionProps = {
  expanded: boolean;
  onToggle: () => void;
  themeHexColor: string;
  appendLogRef: React.MutableRefObject<AppendLogFn>;
};

function buildInitialLoadHistory() {
  const data: { time: string; load: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 2000);
    const randomLoad = 5 + Math.random() * 40;
    data.push({
      time: time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      load: parseFloat(randomLoad.toFixed(1)),
    });
  }
  return data;
}

export function SystemTelemetrySection({
  expanded,
  onToggle,
  themeHexColor,
  appendLogRef,
}: SystemTelemetrySectionProps) {
  const [systemLoad, setSystemLoad] = useState(14.8);
  const [ramUsage, setRamUsage] = useState(4.24);
  const [cpuTemp, setCpuTemp] = useState(48.5);
  const [networkPing, setNetworkPing] = useState(24);
  const [networkTraffic, setNetworkTraffic] = useState({ rx: 3.4, tx: 0.8 });
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [loadHistory, setLoadHistory] = useState(buildInitialLoadHistory);

  const intervalTick = useRef(0);
  const autoRotateIndex = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setSessionSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!expanded) return;

    const tick = () => {
      if (document.hidden) return;

      intervalTick.current += 1;

      const randomLoad = 5 + Math.random() * 40;
      const formattedLoad = parseFloat(randomLoad.toFixed(1));
      setSystemLoad(formattedLoad);
      setRamUsage(4.1 + Math.random() * 0.8);
      setCpuTemp(40 + randomLoad * 0.4 + Math.random() * 3);
      setNetworkPing(18 + Math.floor(Math.random() * 12));
      setNetworkTraffic({
        rx: 0.5 + Math.random() * 15.0,
        tx: 0.1 + Math.random() * 2.0,
      });

      const rotating = AUTO_INTERVAL_MESSAGES;
      if (rotating.length > 0 && intervalTick.current % 30 === 0) {
        const entry = rotating[autoRotateIndex.current % rotating.length];
        autoRotateIndex.current += 1;
        appendLogRef.current(entry.message, entry.type);
      }

      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setLoadHistory((prev) => {
        const nextHistory = [...prev, { time: timeStr, load: formattedLoad }];
        return nextHistory.slice(-30);
      });
    };

    tick();
    const timer = setInterval(tick, 2000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [appendLogRef, expanded]);

  return (
    <div className="flex flex-col shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left py-1.5 px-2 bg-[#11131c]/80 hover:bg-[#161a25]/80 border border-slate-800/80 text-[9px] font-mono font-bold tracking-widest text-[#a5b4fc] flex justify-between items-center rounded select-none animate-fade-in"
      >
        <span>📊 SYSTEM TELEMETRY & CPU</span>
        <span className="text-[7px] text-slate-500">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="bg-black/40 p-2.5 rounded border border-slate-800/80" id="system-load-chart-container">
            <div className="flex justify-between items-center mb-1 text-[8px] font-mono tracking-wider text-indigo-400 font-bold select-none">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse" />
                ■ CPU SYSTEM LOAD TELEMETRY (60S)
              </span>
              <span className="text-emerald-400">{systemLoad}%</span>
            </div>
            <div className="h-[55px] w-full" id="telemetry-chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loadHistory} margin={{ top: 2, right: 2, left: -20, bottom: 2 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 50]} hide />
                  <Tooltip
                    contentStyle={{
                      background: '#090a0f',
                      borderColor: '#312e81',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      lineHeight: '1.2',
                    }}
                    labelStyle={{ color: '#818cf8' }}
                    itemStyle={{ color: '#a5b4fc', padding: 0 }}
                    cursor={{ stroke: '#312e81', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="load"
                    stroke={themeHexColor}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1" id="telemetry-grid">
            <div
              className="bg-black/45 px-1.5 py-1 rounded border border-slate-800/60 font-mono text-[7px] leading-none flex flex-col gap-0.5 min-w-0"
              id="telemetry-ram-card"
            >
              <div className="flex justify-between gap-0.5 text-slate-500 truncate">
                <span className="truncate">■ RAM</span>
                <span className="text-indigo-400 font-bold shrink-0">{ramUsage.toFixed(1)}G</span>
              </div>
              <div className="w-full bg-slate-950 h-0.5 rounded-full overflow-hidden border border-slate-900/40">
                <div
                  className="bg-indigo-500 h-full transition-all duration-500"
                  style={{ width: `${(ramUsage / 8.0) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[6px] text-slate-600">
                <span>{((ramUsage / 8.0) * 100).toFixed(0)}%</span>
                <span>/8G</span>
              </div>
            </div>

            <div
              className="bg-black/45 px-1.5 py-1 rounded border border-slate-800/60 font-mono text-[7px] leading-none flex flex-col gap-0.5 min-w-0"
              id="telemetry-temp-card"
            >
              <div className="flex justify-between gap-0.5 text-slate-500 truncate">
                <span className="truncate">■ TEMP</span>
                <span
                  className={`${cpuTemp > 60 ? 'text-rose-400' : 'text-amber-400'} font-bold shrink-0`}
                >
                  {cpuTemp.toFixed(0)}°
                </span>
              </div>
              <div className="w-full bg-slate-950 h-0.5 rounded-full overflow-hidden border border-slate-900/40">
                <div
                  className={`h-full transition-all duration-500 ${cpuTemp > 60 ? 'bg-rose-500' : 'bg-amber-500'}`}
                  style={{ width: `${(cpuTemp / 100) * 100}%` }}
                />
              </div>
              <div className="text-[6px] text-slate-600 truncate">
                {cpuTemp > 60 ? 'HOT' : 'OK'}
              </div>
            </div>

            <div
              className="bg-black/45 px-1.5 py-1 rounded border border-slate-800/60 font-mono text-[7px] leading-none flex flex-col gap-0.5 min-w-0"
              id="telemetry-network-card"
            >
              <div className="flex justify-between gap-0.5 text-slate-500 truncate">
                <span className="truncate">■ NET</span>
                <span className="text-cyan-400 font-bold shrink-0">{networkPing}ms</span>
              </div>
              <div className="flex justify-between text-[6px] text-slate-500 gap-0.5 truncate">
                <span className="text-emerald-400/90 truncate">↓{networkTraffic.rx.toFixed(1)}</span>
                <span className="text-cyan-400/90 truncate">↑{networkTraffic.tx.toFixed(1)}</span>
              </div>
            </div>

            <div
              className="bg-black/45 px-1.5 py-1 rounded border border-slate-800/60 font-mono text-[7px] leading-none flex flex-col gap-0.5 min-w-0"
              id="telemetry-sandbox-card"
            >
              <div className="flex justify-between gap-0.5 text-slate-500 truncate">
                <span className="truncate">■ BOX</span>
                <span className="text-emerald-400 font-bold shrink-0">OK</span>
              </div>
              <div className="flex items-center gap-0.5 text-[6px] text-slate-500">
                <span className="w-1 h-1 bg-emerald-500 rounded-full shrink-0" />
                <span className="truncate">SHIELD</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-1.5 bg-black/30 border border-slate-800/40 rounded flex justify-between items-center font-mono text-[7px] text-slate-500 shrink-0">
        <span className="flex items-center gap-1 animate-pulse">
          <span>🔄 SYSTEM COOLING FAN:</span>
          <span className="text-emerald-400 font-bold">
            {Math.floor(2000 + systemLoad * 40)} RPM {['|', '/', '-', '\\'][sessionSeconds % 4]}
          </span>
        </span>
        <span>GC BUFFER: INACTIVE</span>
      </div>
    </div>
  );
}