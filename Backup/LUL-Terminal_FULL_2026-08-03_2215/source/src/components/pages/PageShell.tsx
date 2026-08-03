/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PagePinnedBanner } from '../layout/PagePinnedBanner';

type PageShellProps = {
  id: string;
  pageId?: string;
  icon: string;
  title: string;
  subtitle: string;
  accentClass?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

export function PageShell({
  id,
  pageId,
  icon,
  title,
  subtitle,
  accentClass = 'text-indigo-400',
  contentClassName = '',
  children,
}: PageShellProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 animate-fade-in" id={id}>
      <PagePinnedBanner pageId={pageId} icon={icon} title={title} description={subtitle} accentClass={accentClass} />
      <div className={`flex-1 min-h-0 overflow-y-auto pr-1 ${contentClassName}`.trim()}>{children}</div>
    </div>
  );
}

export function ToolCard({
  title,
  icon,
  children,
  accent = 'indigo',
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  accent?: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'teal' | 'orange';
}) {
  const borders: Record<string, string> = {
    indigo: 'border-indigo-500/20',
    cyan: 'border-cyan-500/20',
    emerald: 'border-emerald-500/20',
    amber: 'border-amber-500/20',
    rose: 'border-rose-500/20',
    violet: 'border-violet-500/20',
    teal: 'border-teal-500/20',
    orange: 'border-orange-500/20',
  };
  const titles: Record<string, string> = {
    indigo: 'text-indigo-300',
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    violet: 'text-violet-300',
    teal: 'text-teal-300',
    orange: 'text-orange-300',
  };

  return (
    <div className={`p-4 bg-[#161a24] rounded-lg border ${borders[accent]} shadow-sm`}>
      <div className={`text-[10px] font-mono font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${titles[accent]}`}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

export function TerminalInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#0b0c10] border border-slate-800 text-[10px] font-mono rounded px-2.5 py-1.5 text-slate-200 w-full focus:outline-none focus:border-indigo-500/60 transition-all ${className}`}
    />
  );
}

export function TerminalTextarea({
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="bg-[#0b0c10] border border-slate-800 text-[10px] font-mono rounded px-2.5 py-2 text-slate-200 w-full focus:outline-none focus:border-indigo-500/60 transition-all resize-y leading-relaxed"
    />
  );
}

export function ActionButton({
  onClick,
  children,
  variant = 'indigo',
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose';
  disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    indigo: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    cyan: 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    emerald: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-[10px] font-mono font-bold border px-3 py-1.5 rounded transition disabled:opacity-40 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function OutputBox({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 p-3 bg-black/40 border border-slate-800/80 rounded text-[9px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
      {children}
    </pre>
  );
}