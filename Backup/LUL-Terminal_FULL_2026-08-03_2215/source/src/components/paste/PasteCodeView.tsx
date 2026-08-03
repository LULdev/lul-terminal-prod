/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard, formatPasteViews } from '../../lib/paste';
import { languageLabel } from '../../data/pasteLanguages';

type Props = {
  content: string;
  language: string;
  maxHeight?: string;
  showHeader?: boolean;
  views?: number;
  searchQuery?: string;
  activeLine?: number | null;
  matchLines?: Set<number>;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchInText(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text];
  const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.split(re).map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-amber-400/25 text-amber-100 rounded px-0.5">{part}</mark>
      : part,
  );
}

function highlightLine(line: string, language: string, searchQuery?: string): React.ReactNode[] {
  if (searchQuery?.trim()) {
    return highlightSearchInText(line, searchQuery);
  }

  const parts: React.ReactNode[] = [];
  let key = 0;
  const push = (text: string, cls: string) => {
    if (!text) return;
    parts.push(<span key={key++} className={cls}>{text}</span>);
  };

  if (language === 'json') {
    const m = line.match(/^(\s*)(.*)$/);
    if (!m) return [line];
    push(m[1], '');
    const rest = m[2];
    if (/^".*":/.test(rest)) {
      const [k, ...v] = rest.split(':');
      push(k, 'text-rose-300');
      push(':', 'text-slate-500');
      push(v.join(':'), 'text-emerald-300');
    } else {
      push(rest, 'text-emerald-300');
    }
    return parts;
  }

  const commentRe = /(\/\/.*$|#.*$|--.*$)/;
  const stringRe = /('[^']*'|"[^"]*"|`[^`]*`)/g;

  if (commentRe.test(line)) {
    const idx = line.search(commentRe);
    const before = line.slice(0, idx);
    const comment = line.slice(idx);
    if (before) parts.push(...highlightLine(before, 'plaintext'));
    push(comment, 'text-slate-500 italic');
    return parts;
  }

  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = stringRe.exec(line)) !== null) {
    push(line.slice(last, match.index), 'text-slate-300');
    push(match[0], 'text-amber-200/90');
    last = match.index + match[0].length;
  }
  push(line.slice(last), 'text-slate-300');

  const kw = new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'from',
    'export', 'class', 'async', 'await', 'def', 'print', 'true', 'false', 'null', 'undefined',
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'CREATE', 'TABLE',
  ]);

  return parts.map((node, i) => {
    if (typeof node !== 'string' && React.isValidElement(node) && node.props.className) return node;
    const text = typeof node === 'string' ? node : String((node as React.ReactElement).props.children);
    return text.split(/(\b)/).map((tok, j) => {
      if (kw.has(tok)) return <span key={`${i}-${j}`} className="text-indigo-300">{tok}</span>;
      if (/^\d+$/.test(tok)) return <span key={`${i}-${j}`} className="text-cyan-300">{tok}</span>;
      return <span key={`${i}-${j}`}>{tok}</span>;
    });
  }).flat();
}

export function PasteCodeView({
  content,
  language,
  maxHeight = 'min(60vh, 520px)',
  showHeader = true,
  views,
  searchQuery = '',
  activeLine = null,
  matchLines,
}: Props) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => content.replace(/\r\n/g, '\n').split('\n'), [content]);

  useEffect(() => {
    if (activeLine == null || !scrollRef.current) return;
    const row = scrollRef.current.querySelector(`[data-line="${activeLine}"]`);
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLine]);

  const onCopy = async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#161a24] overflow-hidden shadow-sm">
      {showHeader && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/80 bg-black/30">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/25 bg-indigo-500/10">
              {languageLabel(language)}
            </span>
            <span className="text-[9px] font-mono text-slate-500">{lines.length} lines</span>
            {views !== undefined && (
              <span className="text-[9px] font-mono text-indigo-300/90 flex items-center gap-1">
                · {formatPasteViews(views)} views
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-1.5 text-[9px] font-mono px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition shrink-0"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
      <div ref={scrollRef} className="overflow-auto font-mono text-[10px] leading-relaxed bg-black/40" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const isMatch = matchLines?.has(i);
              const isActive = activeLine === i;
              return (
                <tr
                  key={i}
                  data-line={i}
                  className={`hover:bg-white/[0.02] ${
                    isActive ? 'bg-amber-500/15' : isMatch ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className={`select-none text-right pr-3 pl-3 py-0 w-[1%] whitespace-nowrap align-top border-r border-slate-800/60 ${
                    isActive ? 'text-amber-300' : 'text-slate-600'
                  }`}>
                    {i + 1}
                  </td>
                  <td className="px-3 py-0 whitespace-pre-wrap break-words text-slate-300">
                    {line ? highlightLine(line, language, searchQuery) : '\u00a0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}