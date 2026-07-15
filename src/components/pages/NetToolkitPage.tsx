/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, OutputBox, PageShell, TerminalInput, TerminalTextarea, ToolCard } from './PageShell';
import { generateFakeName, removeDuplicateLines } from '../../utils/generators';

export function NetToolkitPage() {
  const [domain, setDomain] = useState('example.com');
  const [ip, setIp] = useState('');
  const [whoisOut, setWhoisOut] = useState('');
  const [dnsOut, setDnsOut] = useState('');
  const [ipOut, setIpOut] = useState('');
  const [dedupIn, setDedupIn] = useState('alpha\nbeta\nalpha\ngamma\nbeta');
  const [dedupOut, setDedupOut] = useState('');
  const [fakeName, setFakeName] = useState(generateFakeName());
  const [loading, setLoading] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const lookupWhois = async () => {
    setLoading('whois');
    setWhoisOut('Querying RDAP registry…');
    try {
      const res = await fetch(`https://rdap.org/domain/${domain.trim().toLowerCase()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const lines = [
        `DOMAIN: ${data.ldhName ?? domain}`,
        `STATUS: ${(data.status ?? []).join(', ') || 'unknown'}`,
        `CREATED: ${data.events?.find((e: { eventAction: string }) => e.eventAction === 'registration')?.eventDate ?? 'n/a'}`,
        `REGISTRAR: ${data.entities?.[0]?.vcardArray?.[1]?.find((v: unknown[]) => v[0] === 'fn')?.[3] ?? 'n/a'}`,
        `NAMESERVERS: ${(data.nameservers ?? []).map((n: { ldhName: string }) => n.ldhName).join(', ') || 'n/a'}`,
      ];
      if (mountedRef.current) setWhoisOut(lines.join('\n'));
    } catch (err) {
      if (mountedRef.current) {
        setWhoisOut(`WHOIS lookup failed: ${err instanceof Error ? err.message : 'unknown error'}\nTip: Check domain spelling or try again later.`);
      }
    } finally {
      if (mountedRef.current) setLoading('');
    }
  };

  const lookupDns = async () => {
    setLoading('dns');
    setDnsOut('Resolving via Google Public DNS…');
    try {
      const q = domain.trim().toLowerCase();
      const types = ['A', 'AAAA', 'MX', 'NS', 'TXT'];
      const chunks: string[] = [];
      for (const type of types) {
        const res = await fetch(`https://dns.google/resolve?name=${q}&type=${type}`);
        const data = await res.json();
        const answers = (data.Answer ?? []).map((a: { type: number; data: string }) => `  [${type}] ${a.data}`).join('\n');
        chunks.push(`${type}:\n${answers || '  (no records)'}`);
      }
      if (mountedRef.current) setDnsOut(chunks.join('\n\n'));
    } catch (err) {
      if (mountedRef.current) setDnsOut(`DNS lookup failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      if (mountedRef.current) setLoading('');
    }
  };

  const lookupIp = async () => {
    setLoading('ip');
    setIpOut('Tracing route to target…');
    try {
      const target = ip.trim() || '';
      const url = target ? `https://ipapi.co/${target}/json/` : 'https://ipapi.co/json/';
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.reason ?? 'lookup error');
      if (mountedRef.current) {
        setIpOut([
          `IP: ${data.ip}`,
          `CITY: ${data.city}, ${data.region}`,
          `COUNTRY: ${data.country_name} (${data.country_code})`,
          `ISP: ${data.org ?? data.asn ?? 'n/a'}`,
          `TZ: ${data.timezone ?? 'n/a'}`,
          `LAT/LON: ${data.latitude}, ${data.longitude}`,
        ].join('\n'));
      }
    } catch (err) {
      if (mountedRef.current) setIpOut(`IP lookup failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      if (mountedRef.current) setLoading('');
    }
  };

  return (
    <PageShell
      id="tools-module"
      pageId="tools"
      icon="🛠️"
      title="Net Toolkit"
      subtitle="Online tools: WHOIS, DNS, IP lookup, deduplicator & fake names — all in terminal style."
      accentClass="text-cyan-400"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ToolCard title="Domain WHOIS (RDAP)" icon="🌐" accent="cyan">
          <TerminalInput value={domain} onChange={setDomain} placeholder="example.com" />
          <div className="mt-2 flex gap-2">
            <ActionButton onClick={lookupWhois} variant="cyan" disabled={loading === 'whois'}>Lookup WHOIS</ActionButton>
          </div>
          {whoisOut && <OutputBox>{whoisOut}</OutputBox>}
        </ToolCard>

        <ToolCard title="DNS Resolver" icon="📛" accent="indigo">
          <TerminalInput value={domain} onChange={setDomain} placeholder="example.com" />
          <div className="mt-2">
            <ActionButton onClick={lookupDns} variant="indigo" disabled={loading === 'dns'}>Resolve A/AAAA/MX/NS/TXT</ActionButton>
          </div>
          {dnsOut && <OutputBox>{dnsOut}</OutputBox>}
        </ToolCard>

        <ToolCard title="IP Geolocation" icon="📍" accent="teal">
          <TerminalInput value={ip} onChange={setIp} placeholder="Empty = your IP" />
          <div className="mt-2">
            <ActionButton onClick={lookupIp} variant="emerald" disabled={loading === 'ip'}>Trace IP</ActionButton>
          </div>
          {ipOut && <OutputBox>{ipOut}</OutputBox>}
        </ToolCard>

        <ToolCard title="Deduplicator" icon="🧹" accent="emerald">
          <TerminalTextarea value={dedupIn} onChange={setDedupIn} placeholder="Enter lines…" rows={4} />
          <div className="mt-2">
            <ActionButton onClick={() => setDedupOut(removeDuplicateLines(dedupIn))} variant="emerald">Dedup Lines</ActionButton>
          </div>
          {dedupOut && <OutputBox>{dedupOut}</OutputBox>}
        </ToolCard>

        <ToolCard title="Fake name generator" icon="🎭" accent="violet">
          <p className="text-[10px] text-slate-500 mb-2">Generates plausible test personas for demos & QA.</p>
          <OutputBox>{fakeName.full}</OutputBox>
          <div className="mt-2">
            <ActionButton onClick={() => setFakeName(generateFakeName())} variant="amber">New name</ActionButton>
          </div>
        </ToolCard>

        <ToolCard title="Quick Reference" icon="📋" accent="amber">
          <ul className="text-[10px] text-slate-400 space-y-1.5 font-mono leading-relaxed">
            <li>→ WHOIS via RDAP.org (public registry data)</li>
            <li>→ DNS via Google Public DNS JSON API</li>
            <li>→ IP geo via ipapi.co (watch rate limits)</li>
            <li>→ Dedup removes identical lines (trim-based)</li>
            <li>→ Fake names: local only, no API call</li>
          </ul>
        </ToolCard>
      </div>
    </PageShell>
  );
}