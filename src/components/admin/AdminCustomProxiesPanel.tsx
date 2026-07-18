/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useMountedLoad } from '../../hooks/useMountedLoad';
import { detectProxyPaste } from '../../lib/proxyParse';
import {
  addCustomProxies,
  clearCustomProxies,
  deleteCustomProxy,
  fetchCustomProxies,
  proxyListKey,
  type CustomProxy,
  type ProxyType,
} from '../../lib/proxyScraper';
import { ActionButton, ToolCard } from '../pages/PageShell';

const TYPE_STYLES: Record<ProxyType, string> = {
  http: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  https: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  socks4: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
  socks5: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
};

type AdminCustomProxiesPanelProps = {
  onAdded?: () => void;
  onGoToChecker?: () => void;
};

export function AdminCustomProxiesPanel({ onAdded, onGoToChecker }: AdminCustomProxiesPanelProps) {
  const [proxies, setProxies] = useState<CustomProxy[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [defaultType, setDefaultType] = useState<ProxyType>('http');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const { mountedRef, loadGenRef } = useMountedLoad();

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    try {
      const data = await fetchCustomProxies();
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setProxies(data.proxies ?? []);
    } catch {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      setProxies([]);
    }
  }, [loadGenRef, mountedRef]);

  useEffect(() => {
    load();
  }, [load]);

  const addProxies = async () => {
    if (!pasteText.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await addCustomProxies({ text: pasteText, defaultType });
      setPasteText('');
      await load();
      setMsg(`${result.added.toLocaleString('en-US')} added${result.skipped ? ` · ${result.skipped} duplicates skipped` : ''} — pool: ${result.count.toLocaleString('en-US')}`);
      if (result.added > 0) onAdded?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (key: string) => {
    try {
      await deleteCustomProxy(key);
      await load();
      setMsg('Proxy removed');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const removeAll = async () => {
    if (!proxies.length || !confirm('Really delete all custom proxies?')) return;
    try {
      await clearCustomProxies();
      await load();
      setMsg('Custom proxies cleared');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Clear failed');
    }
  };

  const filtered = proxies.filter((p) => {
    const q = search.trim();
    if (!q) return true;
    return p.raw.includes(q) || p.host.includes(q) || p.type.includes(q);
  });

  const detection = useMemo(
    () => detectProxyPaste(pasteText, defaultType),
    [pasteText, defaultType],
  );

  return (
    <ToolCard title="Custom proxies" icon="✏️" accent="emerald">
      <p className="text-[9px] font-mono text-slate-500 mb-3 leading-relaxed">
        Bulk paste with <strong className="text-emerald-300">auto-detect</strong> for{' '}
        <code className="text-slate-400">ip:port</code>,{' '}
        <code className="text-slate-400">type://…</code>,{' '}
        <code className="text-slate-400">user:pass@ip:port</code>,{' '}
        <code className="text-slate-400">ip:port:user:pass</code>. Stored permanently; checker can refine protocol.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
        <div className="sm:col-span-3">
          <label className="text-[8px] font-mono text-slate-500 uppercase">Paste proxies (bulk)</label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={'1.2.3.4:8080\nhttp://5.6.7.8:3128\nsocks5://user:pass@10.0.0.2:1080\n9.8.7.6:1080:user:pass'}
            className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-300 focus:border-emerald-500/40 focus:outline-none"
            spellCheck={false}
          />
          {pasteText.trim() && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] font-mono">
              <span className={`px-2 py-0.5 rounded border ${detection.count ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-rose-500/40 text-rose-300 bg-rose-500/10'}`}>
                {detection.count.toLocaleString('en-US')} detected
              </span>
              {(['http', 'https', 'socks4', 'socks5'] as ProxyType[]).map((t) =>
                detection.byType[t] > 0 ? (
                  <span key={t} className={`px-1.5 py-0.5 rounded border uppercase ${TYPE_STYLES[t]}`}>
                    {t} {detection.byType[t]}
                  </span>
                ) : null,
              )}
              {detection.withAuth > 0 && (
                <span className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300/90">
                  auth {detection.withAuth}
                </span>
              )}
              {detection.sample[0] && (
                <span className="text-slate-600 truncate max-w-full">
                  e.g. {detection.sample[0].type}://{detection.sample[0].raw}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 justify-end">
          <label className="text-[8px] font-mono text-slate-500 uppercase">
            Default type
            <span className="block text-[7px] text-slate-600 normal-case tracking-normal mt-0.5">
              used when scheme omitted
            </span>
            <select
              value={defaultType}
              onChange={(e) => setDefaultType(e.target.value as ProxyType)}
              className="mt-1 w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks4">SOCKS4</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </label>
          <ActionButton onClick={addProxies} variant="emerald" disabled={busy || detection.count === 0}>
            <Plus size={12} className="inline mr-1" />
            {busy ? 'Saving…' : detection.count ? `Add ${detection.count}` : 'Add'}
          </ActionButton>
        </div>
      </div>

      {msg && <p className="text-[10px] font-mono text-emerald-300 mb-3">{msg}</p>}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[9px] font-mono text-slate-500">
          <strong className="text-emerald-300">{proxies.length.toLocaleString('en-US')}</strong> stored
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="flex-1 min-w-[100px] max-w-[200px] bg-black/40 border border-slate-800 rounded-lg px-2 py-1 text-[9px] font-mono text-slate-300"
        />
        {proxies.length > 0 && (
          <button type="button" onClick={removeAll} className="text-[9px] font-mono text-slate-600 hover:text-rose-400">
            Delete all
          </button>
        )}
        {onGoToChecker && proxies.length > 0 && (
          <button
            type="button"
            onClick={onGoToChecker}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-500/30 text-[9px] font-mono text-teal-300 hover:bg-teal-500/10"
          >
            Go to checker <ArrowRight size={11} />
          </button>
        )}
      </div>

      <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
        {filtered.map((p) => (
          <div key={proxyListKey(p)} className="flex items-center gap-2 p-2 rounded-lg border border-slate-800/80 bg-black/20">
            <span className={`px-1.5 py-0.5 rounded border text-[8px] font-mono uppercase ${TYPE_STYLES[p.type]}`}>{p.type}</span>
            <span className="flex-1 text-[10px] font-mono text-slate-300 truncate">{p.raw}</span>
            <button type="button" onClick={() => removeOne(proxyListKey(p))} className="p-1 text-slate-600 hover:text-rose-400 shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {!filtered.length && (
          <p className="text-center py-6 text-[9px] font-mono text-slate-600">
            {proxies.length ? 'No matches' : 'No custom proxies yet — paste & add above'}
          </p>
        )}
      </div>
    </ToolCard>
  );
}