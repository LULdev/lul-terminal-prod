/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Shield } from 'lucide-react';
import { ADMIN_SETUP_NOTES, INSTALLATION_STEPS, type AdminSetupNote } from '../../data/adminSetupNotes';

const CATEGORY_STYLES: Record<AdminSetupNote['category'], string> = {
  deployment: 'border-cyan-500/25 bg-cyan-500/5 text-cyan-300',
  security: 'border-rose-500/25 bg-rose-500/5 text-rose-300',
  database: 'border-amber-500/25 bg-amber-500/5 text-amber-300',
  general: 'border-slate-600/40 bg-slate-800/20 text-slate-400',
};

function SetupNoteCard({ note }: { note: AdminSetupNote }) {
  const catStyle = CATEGORY_STYLES[note.category];
  return (
    <article
      className={`rounded-2xl border p-4 ${
        note.highlight
          ? 'border-violet-500/30 bg-gradient-to-br from-violet-950/30 via-[#0a0b10] to-cyan-950/20'
          : 'border-slate-800/80 bg-black/25'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {note.highlight ? (
            <Shield size={14} className="text-violet-400 shrink-0" aria-hidden />
          ) : (
            <BookOpen size={14} className="text-slate-500 shrink-0" aria-hidden />
          )}
          <h4 className="text-[11px] font-mono font-bold text-slate-200">{note.title}</h4>
        </div>
        <span className={`text-[7px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${catStyle}`}>
          {note.category}
        </span>
      </div>
      {note.envVar && (
        <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="text-[7px] font-mono uppercase text-emerald-500/80 tracking-wider mb-1">Environment</div>
          <code className="text-[10px] font-mono text-emerald-300">{note.envVar}</code>
        </div>
      )}
      <p className="text-[10px] font-mono text-slate-400 leading-relaxed">{note.body}</p>
    </article>
  );
}

export function AdminSetupNotesPanel() {
  return (
    <div className="space-y-4">
      <p className="text-[9px] font-mono text-slate-500 max-w-2xl leading-relaxed">
        Operator notes for self-hosted and production deployments. Keep these settings aligned with your reverse proxy and hosting stack.
        Full guide: <span className="text-cyan-400/90">README.md</span> → Installationsanleitung.
      </p>

      <section className="rounded-2xl border border-slate-800/80 bg-black/25 p-4">
        <h3 className="text-[10px] font-mono font-bold text-slate-200 mb-3 uppercase tracking-wider">
          Installationsanleitung (Kurz)
        </h3>
        <ol className="space-y-3">
          {INSTALLATION_STEPS.map((s) => (
            <li key={s.step} className="flex gap-3">
              <span className="shrink-0 h-6 w-6 rounded-full border border-violet-500/30 bg-violet-500/10 text-[10px] font-mono font-bold text-violet-300 flex items-center justify-center">
                {s.step}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono font-bold text-slate-300 mb-1">{s.title}</div>
                <pre className="text-[9px] font-mono text-emerald-300/90 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                  {s.command}
                </pre>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-3">
        {ADMIN_SETUP_NOTES.map((note) => (
          <React.Fragment key={note.id}>
            <SetupNoteCard note={note} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}