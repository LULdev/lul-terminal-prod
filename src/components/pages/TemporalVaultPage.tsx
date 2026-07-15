/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ActionButton, OutputBox, PageShell, TerminalInput, ToolCard } from './PageShell';

const ZONES = [
  { city: 'Hamburg', tz: 'Europe/Berlin' },
  { city: 'London', tz: 'Europe/London' },
  { city: 'New York', tz: 'America/New_York' },
  { city: 'Tokyo', tz: 'Asia/Tokyo' },
  { city: 'Sydney', tz: 'Australia/Sydney' },
  { city: 'Los Angeles', tz: 'America/Los_Angeles' },
];

function formatInZone(tz: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).format(new Date());
}

function explainCron(expr: string) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return 'Invalid cron — need 5 fields: min hour dom month dow';
  const [min, hour, dom, month, dow] = parts;
  const hints: string[] = [];
  if (min === '*') hints.push('every minute');
  else if (min.startsWith('*/')) hints.push(`every ${min.slice(2)} minutes`);
  else hints.push(`at minute ${min}`);
  if (hour === '*') hints.push('every hour');
  else hints.push(`hour ${hour}`);
  if (dom !== '*') hints.push(`day-of-month ${dom}`);
  if (month !== '*') hints.push(`month ${month}`);
  if (dow !== '*') hints.push(`weekday ${dow}`);
  return hints.join(' · ');
}

export function TemporalVaultPage() {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [unixInput, setUnixInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [converted, setConverted] = useState('');
  const [cronExpr, setCronExpr] = useState('0 8 * * 1-5');

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const unixToDate = () => {
    const ts = parseInt(unixInput, 10);
    if (Number.isNaN(ts)) {
      setConverted('Invalid unix timestamp.');
      return;
    }
    setConverted(new Date(ts * 1000).toISOString().replace('T', ' ').replace('Z', ' UTC'));
  };

  const dateToUnix = () => {
    const ts = Date.parse(dateInput);
    if (Number.isNaN(ts)) {
      setConverted('Invalid date string.');
      return;
    }
    setConverted(`Unix: ${Math.floor(ts / 1000)}`);
  };

  return (
    <PageShell
      id="timevault-module"
      pageId="timevault"
      icon="⏱️"
      title="Temporal Vault"
      subtitle="Unix timestamps, world clock, cron decoder & time paradoxes — for scheduler nerds."
      accentClass="text-cyan-400"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ToolCard title="Live Unix Clock" icon="⏰" accent="cyan">
          <div className="text-2xl font-mono font-bold text-cyan-300 tracking-wider">{now}</div>
          <p className="text-[10px] text-slate-500 mt-1">{new Date(now * 1000).toISOString()}</p>
          <ActionButton onClick={() => { setUnixInput(String(now)); setConverted(''); }} variant="cyan">Copy to Converter</ActionButton>
        </ToolCard>

        <ToolCard title="Unix → Human" icon="🔄" accent="indigo">
          <TerminalInput value={unixInput} onChange={setUnixInput} placeholder="1700000000" />
          <div className="mt-2">
            <ActionButton onClick={unixToDate} variant="indigo">Convert</ActionButton>
          </div>
          {converted && unixInput && <OutputBox>{converted}</OutputBox>}
        </ToolCard>

        <ToolCard title="Human → Unix" icon="📅" accent="emerald">
          <TerminalInput value={dateInput} onChange={setDateInput} placeholder="2026-07-02T15:00:00" />
          <div className="mt-2">
            <ActionButton onClick={dateToUnix} variant="emerald">Convert</ActionButton>
          </div>
        </ToolCard>

        <ToolCard title="World Clock Grid" icon="🌍" accent="teal">
          <div className="space-y-1.5">
            {ZONES.map((z) => (
              <div key={z.tz} className="flex justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800/40 pb-1">
                <span>{z.city}</span>
                <span className="text-teal-400 font-bold">{formatInZone(z.tz)}</span>
              </div>
            ))}
          </div>
        </ToolCard>

        <ToolCard title="Cron Expression Decoder" icon="⚙️" accent="amber">
          <TerminalInput value={cronExpr} onChange={setCronExpr} placeholder="0 8 * * 1-5" />
          <OutputBox>{explainCron(cronExpr)}</OutputBox>
          <p className="text-[9px] text-slate-500 mt-2">Beispiel: 0 8 * * 1-5 = Werktags um 08:00</p>
        </ToolCard>
      </div>
    </PageShell>
  );
}