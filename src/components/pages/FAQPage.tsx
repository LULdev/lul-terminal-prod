/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import {
  ACHIEVEMENT_CATALOG,
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  type AchievementDef,
} from '../../data/achievements';
import { FAQ_SECTIONS, type FaqSection as FaqCategory } from '../../data/faqData';
import { PageShell } from './PageShell';

export function FAQPage() {
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['start', 'auth']));
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_SECTIONS;
    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
      ),
    })).filter((s) => s.items.length > 0);
  }, [query]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleItem = (itemKey: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(FAQ_SECTIONS.map((s) => s.id)));
    const keys = FAQ_SECTIONS.flatMap((s) => s.items.map((_, i) => `${s.id}-${i}`));
    setOpenItems(new Set(keys));
  };

  return (
    <PageShell
      id="faq-module"
      pageId="faq"
      icon="❓"
      title="FAQ"
      subtitle="Everything about LUL Terminal — features, roles, tools & how-tos"
      accentClass="text-teal-400"
    >
      <div className="max-w-3xl space-y-4">
        <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/30 via-[#0c0d12] to-indigo-950/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/10">
              <HelpCircle className="text-teal-300" size={22} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Help & orientation</h3>
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                Answers to common first-visit questions — from account & VIP to tools and the console.
                Search filters questions live. Click categories and entries to expand.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FAQ…"
              className="w-full pl-9 pr-3 py-2.5 bg-[#0b0c10] border border-slate-800 rounded-xl text-[11px] font-mono text-slate-200 focus:border-teal-500/40 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={expandAll}
            className="text-[9px] font-mono px-3 py-2.5 rounded-xl border border-slate-800 text-slate-500 hover:text-teal-300 transition"
          >
            Expand all
          </button>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-[10px] font-mono text-slate-600 py-8">No matches for "{query}"</p>
          )}
          {filtered.map((section) => (
            <React.Fragment key={section.id}>
              <FaqCategoryAccordion
                section={section}
                isOpen={openSections.has(section.id)}
                onToggle={() => toggleSection(section.id)}
                openItems={openItems}
                onToggleItem={toggleItem}
              />
            </React.Fragment>
          ))}
        </div>

        <p className="text-[9px] font-mono text-slate-600 text-center pt-2">
          {FAQ_SECTIONS.reduce((n, s) => n + s.items.length, 0)} questions · {FAQ_SECTIONS.length} categories
        </p>
      </div>
    </PageShell>
  );
}

type FaqCategoryAccordionProps = {
  section: FaqCategory;
  isOpen: boolean;
  onToggle: () => void;
  openItems: Set<string>;
  onToggleItem: (itemKey: string) => void;
};

function DifficultyBadge({ difficulty }: { difficulty: AchievementDef['difficulty'] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wide ${DIFFICULTY_STYLES[difficulty]}`}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

function AchievementCatalogList() {
  const achievements = ACHIEVEMENT_CATALOG.filter((a) => a.kind === 'achievement');
  const awards = ACHIEVEMENT_CATALOG.filter((a) => a.kind === 'award');

  return (
    <div className="mt-2 mx-1 space-y-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 via-[#0c0d12] to-violet-950/15 p-3">
      <div>
        <h4 className="text-[10px] font-semibold text-amber-200/90 mb-2 flex items-center gap-1.5">
          <span>🏅</span>
          All achievements ({achievements.length})
        </h4>
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          {achievements.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-2 rounded-lg border border-slate-800/60 bg-[#0b0c10]/80 px-2.5 py-2"
            >
              <span className="text-sm shrink-0 mt-0.5">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-mono text-slate-200">{a.name}</span>
                  <DifficultyBadge difficulty={a.difficulty} />
                </div>
                <p className="text-[9px] text-slate-500 leading-relaxed">{a.howToUnlock}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-[10px] font-semibold text-violet-200/90 mb-2 flex items-center gap-1.5">
          <span>🔱</span>
          Admin-Awards ({awards.length})
        </h4>
        <div className="space-y-1.5">
          {awards.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-2 rounded-lg border border-violet-500/20 bg-violet-950/15 px-2.5 py-2"
            >
              <span className="text-sm shrink-0 mt-0.5">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-mono text-violet-200">{a.name}</span>
                  <DifficultyBadge difficulty={a.difficulty} />
                </div>
                <p className="text-[9px] text-slate-500 leading-relaxed">{a.howToUnlock}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqCategoryAccordion({
  section,
  isOpen,
  onToggle,
  openItems,
  onToggleItem,
}: FaqCategoryAccordionProps) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#161a24] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/20 transition"
      >
        <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-2">
          <span>{section.icon}</span>
          {section.title}
          <span className="text-[8px] font-mono text-slate-600 font-normal">({section.items.length})</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-slate-800/60 px-2 pb-2 space-y-1">
          {section.items.map((item, i) => {
            const key = `${section.id}-${i}`;
            const itemOpen = openItems.has(key);
            return (
              <div key={key} className="rounded-lg border border-slate-800/50 bg-[#0c0d12]/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onToggleItem(key)}
                  className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-800/15 transition"
                >
                  <span className="text-[10px] font-mono text-teal-200/90 leading-relaxed pr-2">{item.q}</span>
                  <ChevronDown
                    size={12}
                    className={`text-slate-600 shrink-0 mt-0.5 transition-transform ${itemOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {itemOpen && (
                  <div className="px-3 pb-3 pt-0">
                    <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800/40 pt-2">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {section.id === 'awards' && <AchievementCatalogList />}
        </div>
      )}
    </div>
  );
}