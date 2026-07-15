/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { PageShell, TerminalInput } from './PageShell';
import {
  TOOL_CATEGORIES,
  TOOL_VAULT_CATALOG,
  getCategoryCounts,
  getSubcategories,
} from '../../data/toolVaultCatalog';
import type { ToolCategory, ToolDefinition } from '../../data/toolVault/types';
import { ToolVaultItem } from '../toolVault/ToolVaultItem';

const PAGE_SIZE = 48;
const RECENT_KEY = 'lul_toolvault_recent';

type ViewMode = 'grid' | 'list';
type SortMode = 'az' | 'category';

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  const prev = loadRecent().filter((x) => x !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, 12)));
}

export function ToolVaultPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ToolCategory | 'all'>('all');
  const [subcategory, setSubcategory] = useState<string>('all');
  const [activeId, setActiveId] = useState(TOOL_VAULT_CATALOG[0]?.id ?? '');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [recentIds, setRecentIds] = useState<string[]>(loadRecent);

  const counts = useMemo(() => getCategoryCounts(), []);
  const subcategories = useMemo(() => getSubcategories(category), [category]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = TOOL_VAULT_CATALOG.filter((t) => {
      const catOk = category === 'all' || t.category === category;
      const subOk = subcategory === 'all' || t.subcategory === subcategory;
      const searchOk =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.subcategory.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q));
      return catOk && subOk && searchOk;
    });

    if (sortMode === 'az') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = [...list].sort((a, b) =>
        a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
      );
    }
    return list;
  }, [search, category, subcategory, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const active: ToolDefinition =
    TOOL_VAULT_CATALOG.find((t) => t.id === activeId) ?? filtered[0] ?? TOOL_VAULT_CATALOG[0];

  const recentTools = recentIds
    .map((id) => TOOL_VAULT_CATALOG.find((t) => t.id === id))
    .filter(Boolean) as ToolDefinition[];

  useEffect(() => {
    setPage(0);
  }, [search, category, subcategory, sortMode]);

  useEffect(() => {
    if (filtered.length && !filtered.find((t) => t.id === activeId)) {
      setActiveId(filtered[0].id);
    }
  }, [filtered, activeId]);

  const selectTool = (id: string) => {
    setActiveId(id);
    saveRecent(id);
    setRecentIds(loadRecent());
  };

  return (
    <PageShell
      id="toolvault-module"
      pageId="toolvault"
      icon="🧰"
      title="Tool Vault"
      subtitle={`${TOOL_VAULT_CATALOG.length} micro-tools — search, categories, subcategories, pagination & recently used.`}
      accentClass="text-amber-400"
    >
      <div className="flex flex-col gap-2.5 min-h-0 h-full">
        {/* Search + controls */}
        <div className="flex flex-col lg:flex-row gap-2 shrink-0">
          <div className="flex-1">
            <TerminalInput
              value={search}
              onChange={setSearch}
              placeholder="Search: name, tag, description… (e.g. json, http 404, uuid)"
            />
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 shrink-0 flex-wrap">
            <span className="text-amber-400 font-bold">{filtered.length}</span>
            <span>/ {TOOL_VAULT_CATALOG.length}</span>
            <button type="button" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} className="px-2 py-1 border border-slate-800 rounded hover:border-slate-600">
              {viewMode === 'list' ? '▦ Grid' : '☰ List'}
            </button>
            <button type="button" onClick={() => setSortMode(sortMode === 'az' ? 'category' : 'az')} className="px-2 py-1 border border-slate-800 rounded hover:border-slate-600">
              Sort: {sortMode === 'az' ? 'A–Z' : 'Category'}
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1 shrink-0 max-h-[52px] overflow-y-auto">
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setCategory(cat.id); setSubcategory('all'); }}
              className={`text-[8px] font-mono px-2 py-1 rounded border transition whitespace-nowrap ${
                category === cat.id
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'border-slate-800 text-slate-500 hover:border-slate-600'
              }`}
            >
              {cat.icon} {cat.label}
              {cat.id !== 'all' && counts[cat.id] ? ` (${counts[cat.id]})` : cat.id === 'all' ? ` (${counts.all})` : ''}
            </button>
          ))}
        </div>

        {/* Subcategories */}
        {subcategories.length > 0 && (
          <div className="flex flex-wrap gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSubcategory('all')}
              className={`text-[8px] font-mono px-2 py-0.5 rounded border ${subcategory === 'all' ? 'border-cyan-500/40 text-cyan-300' : 'border-slate-800 text-slate-600'}`}
            >
              All subcategories
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubcategory(sub)}
                className={`text-[8px] font-mono px-2 py-0.5 rounded border ${subcategory === sub ? 'border-cyan-500/40 text-cyan-300' : 'border-slate-800 text-slate-600'}`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* Recent */}
        {recentTools.length > 0 && !search && (
          <div className="flex flex-wrap gap-1 shrink-0 items-center">
            <span className="text-[8px] text-slate-600 font-mono mr-1">RECENT:</span>
            {recentTools.slice(0, 8).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTool(t.id)}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-slate-800 text-slate-500 hover:text-amber-300 hover:border-amber-500/30"
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-3 min-h-0 flex-1">
          {/* Tool list */}
          <div className="flex flex-col min-h-0 border border-slate-800/60 rounded-lg bg-[#0d0f14]/80">
            <div className={`flex-1 min-h-0 overflow-y-auto p-1.5 ${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-1 content-start' : 'flex flex-col gap-0.5'}`}>
              {paged.map((tool) =>
                viewMode === 'list' ? (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => selectTool(tool.id)}
                    title={tool.description}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-left transition text-[9px] font-mono w-full ${
                      activeId === tool.id
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                        : 'hover:bg-slate-800/40 text-slate-400 border border-transparent'
                    }`}
                  >
                    <span className="shrink-0 w-4 text-center">{tool.icon}</span>
                    <span className="font-bold truncate flex-1">{tool.name}</span>
                    <span className="text-[7px] text-slate-600 shrink-0 hidden sm:inline">{tool.subcategory}</span>
                  </button>
                ) : (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => selectTool(tool.id)}
                    title={tool.description}
                    className={`text-left p-1.5 rounded border transition text-[9px] font-mono ${
                      activeId === tool.id
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : 'bg-[#161a24] border-slate-800/80 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span>{tool.icon}</span>
                    <span className="font-bold block truncate">{tool.name}</span>
                  </button>
                )
              )}
              {filtered.length === 0 && (
                <div className="text-[10px] text-slate-500 font-mono p-4">No tools found.</div>
              )}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="shrink-0 flex items-center justify-between px-2 py-1.5 border-t border-slate-800/60 text-[9px] font-mono text-slate-500">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30 hover:text-amber-300">← Prev</button>
                <span>Page {page + 1} / {pageCount}</span>
                <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30 hover:text-amber-300">Next →</button>
              </div>
            )}
          </div>

          {/* Active tool panel */}
          <div className="p-3 bg-[#161a24] rounded-lg border border-amber-500/20 min-h-[180px] flex flex-col min-h-0">
            <div className="mb-2 pb-2 border-b border-slate-800/60 shrink-0">
              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-2 flex-wrap">
                <span>{active.icon}</span> {active.name}
                <span className="text-[8px] font-normal text-slate-600 border border-slate-800 px-1.5 py-0.5 rounded">
                  {active.category} / {active.subcategory}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 mt-1">{active.description}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {active.tags.slice(0, 6).map((tag) => (
                  <span key={tag} className="text-[7px] font-mono text-slate-600 bg-black/30 px-1 rounded">#{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto" key={active.id}>
              <ToolVaultItem tool={active} />
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}