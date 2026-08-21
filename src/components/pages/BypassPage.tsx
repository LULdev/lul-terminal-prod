/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton, PageShell, TerminalTextarea, ToolCard } from './PageShell';
import {
  clearBypassHistory,
  fetchBypassCatalog,
  guessServiceLabel,
  loadBypassHistory,
  parseLocalUrls,
  pushBypassHistory,
  runBypass,
  safeBypassOpenHref,
  type BypassHistoryItem,
  type BypassResult,
  type BypassServiceInfo,
} from '../../lib/bypass';

export function BypassPage() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BypassResult[]>([]);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<BypassServiceInfo[]>([]);
  const [history, setHistory] = useState<BypassHistoryItem[]>(() => loadBypassHistory());
  const [copied, setCopied] = useState<string | null>(null);
  const [showSites, setShowSites] = useState(false);
  const [siteFilter, setSiteFilter] = useState('');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const load = (attempt: number) => {
      void fetchBypassCatalog()
        .then((list) => {
          if (!cancelled && mountedRef.current) setCatalog(list);
        })
        .catch(() => {
          if (!cancelled && attempt < 1) retryTimer = setTimeout(() => load(attempt + 1), 800);
        });
    };
    load(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  const urls = useMemo(() => parseLocalUrls(input), [input]);
  const firstLabel = urls[0] ? guessServiceLabel(urls[0], catalog) : null;

  const copyText = useCallback((text: string, id: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      if (!mountedRef.current) return;
      setError('');
      setCopied(id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(null);
      }, 1400);
    }).catch(() => {
      if (mountedRef.current) setError('Clipboard blocked — select the URL and copy manually.');
    });
  }, []);

  const run = useCallback(async () => {
    const list = parseLocalUrls(input);
    if (!list.length) {
      setError('Paste a Linkvertise (or other) URL first.');
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setResults([]);
    try {
      const out = await runBypass(list, ac.signal);
      if (!mountedRef.current || ac.signal.aborted) return;
      setResults(out);
      const hist = pushBypassHistory(
        out.map((r) => ({
          at: Date.now(),
          input: r.input,
          destination: r.destination,
          ok: r.ok,
          service: r.service,
        })),
      );
      setHistory(hist);
    } catch (err) {
      if (!mountedRef.current || ac.signal.aborted) return;
      if ((err instanceof DOMException || err instanceof Error) && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Bypass failed');
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [input]);

  const copyAll = useCallback(() => {
    const dests = results.filter((r) => r.ok && r.destination).map((r) => r.destination as string);
    if (!dests.length) return;
    copyText(dests.join('\n'), '__all__');
  }, [results, copyText]);

  const filteredSites = useMemo(() => {
    const q = siteFilter.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (s) => s.label.toLowerCase().includes(q) || s.hosts.some((h) => h.includes(q)),
    );
  }, [catalog, siteFilter]);

  return (
    <PageShell
      id="bypass-module"
      pageId="bypass"
      icon="🔓"
      title="Bypass"
      subtitle="Paste a Linkvertise or other locker URL — one click to the destination. No ads, no timers."
      accentClass="text-cyan-400"
    >
      <div className="flex flex-col gap-3 max-w-3xl">
        <ToolCard title="Unlock a link" icon="🔓" accent="cyan">
          <p className="text-[10px] text-slate-500 mb-2 font-mono leading-relaxed">
            Works best with every Linkvertise domain. Also shortens, paste hosts, work.ink, lootlabs, sub2unlock and more.
            Several URLs: one per line.
          </p>
          <div
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void run();
              }
            }}
          >
          <TerminalTextarea
            value={input}
            onChange={setInput}
            placeholder="https://linkvertise.com/…"
            rows={4}
          />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => void run()} variant="cyan" disabled={urls.length === 0}>
              {busy ? 'Bypassing…' : urls.length > 1 ? `Bypass ${urls.length} links` : 'Bypass'}
            </ActionButton>
            {firstLabel && (
              <span className="text-[9px] font-mono px-2 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                {firstLabel}
                {urls.length > 1 ? ` +${urls.length - 1}` : ''}
              </span>
            )}
            <span className="text-[9px] font-mono text-slate-600">Ctrl / ⌘ + Enter</span>
          </div>
          {error && <p className="mt-2 text-[11px] font-mono text-rose-300">{error}</p>}
        </ToolCard>

        {results.length > 0 && (
          <ToolCard title="Result" icon="✅" accent="emerald">
            <div className="flex justify-end mb-2">
              {results.some((r) => r.ok && r.destination) && (
                <ActionButton onClick={copyAll} variant="emerald">
                  {copied === '__all__' ? 'Copied all' : 'Copy all'}
                </ActionButton>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {results.map((r, i) => {
                const dest = r.ok ? (r.destination ?? '') : '';
                const href = dest ? safeBypassOpenHref(dest) : null;
                return (
                  <div
                    key={`${r.input}-${i}`}
                    className={`rounded-lg border p-3 ${r.ok ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-rose-500/25 bg-rose-500/5'}`}
                  >
                    <span className={`text-[9px] font-mono uppercase tracking-wider ${r.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {r.ok ? 'Ready' : 'Failed'} · {r.service}
                    </span>
                    <p className="text-[9px] font-mono text-slate-500 truncate mt-1 mb-2" title={r.input}>{r.input}</p>
                    {r.ok && dest ? (
                      <>
                        <code className="block text-xs font-mono text-slate-100 break-all leading-relaxed bg-black/40 border border-slate-800 rounded px-2.5 py-2">
                          {dest}
                        </code>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <ActionButton onClick={() => copyText(dest, r.input)} variant="emerald">
                            {copied === r.input ? 'Copied' : 'Copy'}
                          </ActionButton>
                          {href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono font-bold border px-3 py-1.5 rounded transition bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                            >
                              Open
                            </a>
                          )}
                        </div>
                        {r.hops.length > 1 && (
                          <p className="mt-2 text-[9px] font-mono text-slate-500 leading-relaxed break-all">{r.hops.join(' → ')}</p>
                        )}
                        {r.pasteText ? (
                          <pre className="mt-2 p-2 bg-black/40 border border-slate-800/80 rounded text-[9px] font-mono text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {r.pasteText}
                          </pre>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[11px] font-mono text-rose-300">{r.error || 'Bypass failed'}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </ToolCard>
        )}

        <ToolCard title="Recent" icon="🕑" accent="indigo">
          {history.length === 0 ? (
            <p className="text-[10px] font-mono text-slate-500">Bypassed links stay on this device (last 20).</p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {history.slice(0, 8).map((h, i) => (
                  <li key={`${h.at}-${i}`} className="text-[9px] font-mono text-slate-400">
                    <button
                      type="button"
                      className="text-left w-full hover:text-cyan-300 transition"
                      onClick={() => {
                        setInput(h.input);
                        setResults([]);
                        setError('');
                      }}
                      title="Reuse original URL"
                    >
                      <span className={h.ok ? 'text-emerald-400' : 'text-rose-400'}>{h.ok ? '✓' : '✗'}</span>
                      {' '}
                      <span className="text-slate-500">{h.service}</span>
                      {' · '}
                      <span className="break-all">{h.destination || h.input}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <ActionButton
                  onClick={() => {
                    clearBypassHistory();
                    setHistory([]);
                  }}
                  variant="indigo"
                >
                  Clear history
                </ActionButton>
              </div>
            </>
          )}
        </ToolCard>

        <ToolCard title="Supported sites" icon="🌐" accent="amber">
          <button
            type="button"
            className="text-[10px] font-mono text-amber-300 hover:underline"
            onClick={() => setShowSites((v) => !v)}
          >
            {showSites ? 'Hide list' : `Show ${catalog.length || 'all'} supported services`}
          </button>
          {showSites && (
            <div className="mt-2">
              <input
                type="text"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                placeholder="Filter…"
                className="bg-[#0b0c10] border border-slate-800 text-[10px] font-mono rounded px-2.5 py-1.5 text-slate-200 w-full focus:outline-none focus:border-amber-500/60 mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {filteredSites.map((s) => (
                  <span
                    key={s.id}
                    className="text-[9px] font-mono px-2 py-0.5 rounded border border-slate-700 text-slate-400 bg-black/30"
                    title={s.hosts.join(', ')}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </ToolCard>
      </div>
    </PageShell>
  );
}
