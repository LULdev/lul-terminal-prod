/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActionButton, OutputBox, PageShell, TerminalInput, ToolCard } from './PageShell';
import { randomInt } from '../../utils/generators';

const PORTS = [
  { port: 22, service: 'SSH' },
  { port: 80, service: 'HTTP' },
  { port: 443, service: 'HTTPS' },
  { port: 3000, service: 'Dev Server' },
  { port: 5432, service: 'PostgreSQL' },
  { port: 8080, service: 'Alt HTTP' },
];

export function NetworkProbePage() {
  const [host, setHost] = useState('google.com');
  const [pingOut, setPingOut] = useState('');
  const [traceOut, setTraceOut] = useState('');
  const [portOut, setPortOut] = useState('');
  const [running, setRunning] = useState('');

  const simulatePing = async () => {
    setRunning('ping');
    const lines: string[] = [`PING ${host} — 4 packets transmitted`];
    for (let i = 1; i <= 4; i++) {
      await new Promise((r) => setTimeout(r, 350));
      const ms = randomInt(12, 89);
      lines.push(`Reply from ${host}: seq=${i} time=${ms}ms TTL=56`);
      setPingOut(lines.join('\n'));
    }
    lines.push(`--- ${host} ping statistics ---`);
    lines.push('4 packets transmitted, 4 received, 0% packet loss');
    setPingOut(lines.join('\n'));
    setRunning('');
  };

  const simulateTraceroute = async () => {
    setRunning('trace');
    const hops = [
      '192.168.178.1',
      '10.0.0.1',
      '87.128.44.1',
      '195.219.12.8',
      '142.250.80.46',
    ];
    const lines = [`traceroute to ${host} (142.250.80.46), 5 hops max`];
    for (let i = 0; i < hops.length; i++) {
      await new Promise((r) => setTimeout(r, 400));
      lines.push(` ${i + 1}  ${hops[i]}  ${randomInt(8, 45)}.${randomInt(100, 999)} ms`);
      setTraceOut(lines.join('\n'));
    }
    setRunning('');
  };

  const scanPorts = () => {
    setRunning('ports');
    const results = PORTS.map(({ port, service }) => {
      const open = Math.random() > 0.45;
      return `${port.toString().padEnd(6)} ${service.padEnd(12)} ${open ? 'OPEN' : 'closed'}`;
    });
    setPortOut(['PORT   SERVICE      STATE', '─────────────────────────────', ...results].join('\n'));
    setRunning('');
  };

  return (
    <PageShell
      id="network-module"
      pageId="network"
      icon="📡"
      title="Network Probe"
      subtitle="Ping simulation, traceroute, port scan & host diagnostics — retro network terminal."
      accentClass="text-teal-400"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ToolCard title="Target Host" icon="🎯" accent="teal">
          <TerminalInput value={host} onChange={setHost} placeholder="hostname or IP" />
        </ToolCard>

        <ToolCard title="Probe Actions" icon="⚡" accent="cyan">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={simulatePing} variant="cyan" disabled={running === 'ping'}>ICMP Ping</ActionButton>
            <ActionButton onClick={simulateTraceroute} variant="indigo" disabled={running === 'trace'}>Traceroute</ActionButton>
            <ActionButton onClick={scanPorts} variant="emerald" disabled={running === 'ports'}>Port Scan</ActionButton>
          </div>
          <p className="text-[9px] text-slate-500 mt-2">Simulated output — no real ICMP (browser limitation).</p>
        </ToolCard>

        {pingOut && (
          <ToolCard title="Ping Output" icon="📶" accent="emerald">
            <OutputBox>{pingOut}</OutputBox>
          </ToolCard>
        )}

        {traceOut && (
          <ToolCard title="Traceroute Output" icon="🛤️" accent="indigo">
            <OutputBox>{traceOut}</OutputBox>
          </ToolCard>
        )}

        {portOut && (
          <ToolCard title="Port Scan Results" icon="🚪" accent="amber">
            <OutputBox>{portOut}</OutputBox>
          </ToolCard>
        )}

        <ToolCard title="Network Lore" icon="📖" accent="violet">
          <ul className="text-[10px] text-slate-400 space-y-1.5 font-mono">
            <li>→ Real ICMP pings need native tools (ping, hping)</li>
            <li>→ Port scan here is a demo simulation</li>
            <li>→ For real WHOIS/DNS → Net Toolkit tab</li>
            <li>→ TTL=56 because it looks cool.</li>
          </ul>
        </ToolCard>
      </div>
    </PageShell>
  );
}