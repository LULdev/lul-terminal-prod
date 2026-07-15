/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ActionButton, OutputBox, PageShell, TerminalInput, TerminalTextarea, ToolCard } from './PageShell';
import { removeDuplicateLines, slugify } from '../../utils/generators';

export function TextLabPage() {
  const [text, setText] = useState('Hello LUL Terminal!\nhello lul terminal!\n  spaced line  ');
  const [slugSource, setSlugSource] = useState('My Cool Project Name!!');

  const stats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text.split('\n').length;
    return { words, chars, lines };
  }, [text]);

  return (
    <PageShell
      id="textlab-module"
      pageId="textlab"
      icon="📝"
      title="Text Laboratory"
      subtitle="Transform, count, clean — word stats, case modes, slugs & dedup."
      accentClass="text-emerald-400"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ToolCard title="Input Buffer" icon="📥" accent="emerald">
          <TerminalTextarea value={text} onChange={setText} rows={6} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] font-mono text-slate-400">
            <span>WORDS: <b className="text-emerald-400">{stats.words}</b></span>
            <span>CHARS: <b className="text-emerald-400">{stats.chars}</b></span>
            <span>LINES: <b className="text-emerald-400">{stats.lines}</b></span>
          </div>
        </ToolCard>

        <ToolCard title="Case Transform" icon="🔤" accent="indigo">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setText(text.toUpperCase())} variant="indigo">UPPER</ActionButton>
            <ActionButton onClick={() => setText(text.toLowerCase())} variant="cyan">lower</ActionButton>
            <ActionButton onClick={() => setText(text.split('').reverse().join(''))} variant="rose">reverse</ActionButton>
            <ActionButton onClick={() => setText(text.trim())} variant="emerald">trim</ActionButton>
          </div>
        </ToolCard>

        <ToolCard title="Deduplicator" icon="🧹" accent="amber">
          <ActionButton onClick={() => setText(removeDuplicateLines(text))} variant="amber">Remove Duplicate Lines</ActionButton>
          <p className="text-[9px] text-slate-500 mt-2">Removes duplicate lines (after trim).</p>
        </ToolCard>

        <ToolCard title="Slug Generator" icon="🔗" accent="cyan">
          <TerminalInput value={slugSource} onChange={setSlugSource} placeholder="Enter title…" />
          <OutputBox>{slugify(slugSource) || '(empty)'}</OutputBox>
        </ToolCard>

        <ToolCard title="Lorem Injector" icon="📄" accent="violet">
          <ActionButton
            onClick={() =>
              setText(
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'
              )
            }
            variant="indigo"
          >
            Insert Lorem Block
          </ActionButton>
        </ToolCard>

        <ToolCard title="Word Frequency" icon="📊" accent="teal">
          <OutputBox>
            {(Object.entries(
              text
                .toLowerCase()
                .split(/\W+/)
                .filter(Boolean)
                .reduce<Record<string, number>>((acc, w) => {
                  acc[w] = (acc[w] ?? 0) + 1;
                  return acc;
                }, {})
            ) as [string, number][])
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([w, c]) => `${w.padEnd(12)} ${c}`)
              .join('\n') || '(no words)'}
          </OutputBox>
        </ToolCard>
      </div>
    </PageShell>
  );
}