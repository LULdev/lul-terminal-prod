/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActionButton, OutputBox, PageShell, ToolCard } from './PageShell';
import { buildPersona, Persona, PersonaAddressRecord } from '../../utils/generators';
import { PERSONA_STATS } from '../../data/personaData';

type CountryOption = { country: string; count: number };

const COUNTRY_FLAGS: Record<string, string> = {
  Germany: '🇩🇪',
  USA: '🇺🇸',
  'United Kingdom': '🇬🇧',
  France: '🇫🇷',
  Netherlands: '🇳🇱',
  Switzerland: '🇨🇭',
  Austria: '🇦🇹',
  Spain: '🇪🇸',
  Italy: '🇮🇹',
  Canada: '🇨🇦',
};

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className={
        className
        ?? 'shrink-0 text-[8px] font-mono px-1 py-0.5 rounded border border-violet-800/40 text-violet-400/70 hover:text-violet-300 hover:border-violet-600/50 transition'
      }
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

function PersonaField({
  label,
  value,
  mono,
  span,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  span?: boolean;
}) {
  const text = String(value);
  return (
    <div className={`flex flex-col gap-0.5 ${span ? 'col-span-2 sm:col-span-3 lg:col-span-4' : ''}`}>
      <span className="text-[9px] uppercase tracking-wider text-violet-400/80">{label}</span>
      <div className="flex items-start gap-1 min-w-0">
        <span className={`flex-1 text-[10px] text-slate-300 break-all ${mono ? 'font-mono' : ''}`}>{text}</span>
        <CopyButton value={text} />
      </div>
    </div>
  );
}

function SocialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-slate-600 shrink-0 w-4">{label}</span>
      <span className="flex-1 text-[10px] font-mono text-slate-400 truncate">{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

function PersonaCard({ persona }: { persona: Persona }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-start">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <img
            src={persona.avatar}
            alt=""
            className="w-14 h-14 rounded-lg border border-violet-800/40 bg-slate-900"
          />
          <CopyButton
            value={persona.avatar}
            className="text-[8px] font-mono px-1 py-0.5 rounded border border-violet-800/40 text-violet-400/70 hover:text-violet-300 transition"
          />
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5">
          <PersonaField label="Name" value={persona.name} />
          <PersonaField label="Age" value={persona.age} />
          <PersonaField label="Username" value={persona.username} mono />
          <PersonaField label="Handle" value={persona.handle} mono />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2.5">
        <PersonaField label="Email" value={persona.email} mono />
        <PersonaField label="Phone" value={persona.phone} mono />
        <PersonaField label="Job" value={persona.job} />
        <PersonaField label="Company" value={persona.company} />
        <PersonaField label="Venue" value={persona.venue} />
        <PersonaField label="Street" value={persona.street} />
        <PersonaField label="ZIP" value={persona.zip} mono />
        <PersonaField label="City" value={persona.city} />
        <PersonaField label="Country" value={persona.country} />
        <PersonaField label="Address" value={persona.address} span mono />
        <PersonaField label="Timezone" value={persona.timezone} mono />
        <PersonaField label="Password" value={persona.password} mono />
      </div>

      <div className="pt-2 border-t border-slate-800/60">
        <span className="text-[9px] uppercase tracking-wider text-violet-400/80">Social</span>
        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5">
          <SocialRow label="𝕏" value={persona.social.twitter} />
          <SocialRow label="GH" value={persona.social.github} />
          <SocialRow label="IN" value={persona.social.linkedin} />
          <SocialRow label="IG" value={persona.social.instagram} />
          <SocialRow label="DC" value={persona.social.discord} />
        </div>
      </div>

      <div className="pt-1 border-t border-slate-800/60">
        <PersonaField label="Bio" value={persona.bio} />
      </div>
    </div>
  );
}

function StatsBadge({ dbTotal }: { dbTotal: number }) {
  const items = [
    { k: 'DB', v: `${dbTotal} real` },
    { k: 'Countries', v: PERSONA_STATS.dbCountries },
    { k: 'Names', v: `${PERSONA_STATS.firstNames}×${PERSONA_STATS.lastNames}` },
    { k: 'Jobs', v: PERSONA_STATS.jobs },
    { k: 'Avatars', v: PERSONA_STATS.avatarStyles },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ k, v }) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-950/40 border border-violet-800/30 text-[9px] font-mono text-violet-300/90"
        >
          <span className="text-violet-500/70">{k}</span>
          <span>{v}</span>
        </span>
      ))}
    </div>
  );
}

function CountrySelector({
  countries,
  selected,
  onSelect,
}: {
  countries: CountryOption[];
  selected: string;
  onSelect: (country: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {countries.map(({ country, count }) => {
        const active = country === selected;
        return (
          <button
            key={country}
            type="button"
            onClick={() => onSelect(country)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-mono transition ${
              active
                ? 'bg-violet-900/50 border-violet-500/60 text-violet-200'
                : 'bg-black/20 border-slate-800/60 text-slate-400 hover:text-violet-300 hover:border-violet-800/40'
            }`}
          >
            <span>{COUNTRY_FLAGS[country] ?? '🌍'}</span>
            <span>{country}</span>
            <span className="opacity-50">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

async function fetchRandomAddress(country: string): Promise<PersonaAddressRecord> {
  const res = await fetch(`/api/persona-db/random?country=${encodeURIComponent(country)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.entry;
}

export function IdentityForgePage() {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('Germany');
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const forge = useCallback(async (country: string) => {
    setLoading(true);
    setError('');
    try {
      const entry = await fetchRandomAddress(country);
      setPersona(buildPersona(entry));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load address');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/persona-db/countries');
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${r.status}`);
        }
        const data = await r.json();
        const list: CountryOption[] = data.countries ?? [];
        if (cancelled) return;
        setCountries(list);
        const country = list.find((c) => c.country === 'Germany')?.country ?? list[0]?.country ?? 'Germany';
        setSelectedCountry(country);
        await forge(country);
      } catch {
        if (!cancelled) setError('Could not load country list');
      }
    })();
    return () => { cancelled = true; };
  }, [forge]);

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    forge(country);
  };

  const dbTotal = countries.reduce((sum, c) => sum + c.count, 0) || PERSONA_STATS.dbAddresses;

  return (
    <PageShell
      id="identity-module"
      pageId="identity"
      icon="🎭"
      title="Identity Forge"
      subtitle="Fake personas with real addresses from the database — for demos, QA, and creative projects."
      accentClass="text-violet-400"
    >
      <div className="mb-3 space-y-2">
        <StatsBadge dbTotal={dbTotal} />
        {countries.length > 0 && (
          <CountrySelector
            countries={countries}
            selected={selectedCountry}
            onSelect={handleCountrySelect}
          />
        )}
      </div>

      {error && (
        <p className="mb-3 text-[10px] font-mono text-rose-400">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        <ToolCard title="Active persona" icon="👤" accent="violet">
          {persona ? (
            <PersonaCard persona={persona} />
          ) : (
            <p className="text-[10px] text-slate-500 font-mono">
              {loading ? 'Loading address from database…' : 'Select a country and generate a persona.'}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              onClick={() => forge(selectedCountry)}
              variant="indigo"
              disabled={loading}
            >
              {loading ? 'Forging…' : 'Forge New'}
            </ActionButton>
            {persona && (
              <ActionButton
                onClick={() => navigator.clipboard.writeText(JSON.stringify(persona, null, 2))}
                variant="cyan"
              >
                Copy JSON
              </ActionButton>
            )}
          </div>
        </ToolCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ToolCard title="Use Cases" icon="💡" accent="amber">
            <ul className="text-[10px] text-slate-400 space-y-1.5 font-mono">
              <li>→ UI mockups with real street addresses</li>
              <li>→ QA test accounts for staging</li>
              <li>→ Country-specific address formats</li>
              <li>→ Names & contact are fictional — only addresses are real</li>
            </ul>
          </ToolCard>

          <ToolCard title="Export Preview" icon="📦" accent="teal">
            <OutputBox>{persona ? JSON.stringify(persona, null, 2) : '{}'}</OutputBox>
          </ToolCard>
        </div>
      </div>
    </PageShell>
  );
}