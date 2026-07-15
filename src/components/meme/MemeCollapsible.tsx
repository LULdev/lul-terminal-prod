/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

type Props = {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function MemeCollapsible({ title, icon, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-800/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-2 bg-[#12151c] hover:bg-[#161a24] text-[9px] font-mono uppercase tracking-wide text-slate-400 transition"
      >
        <span className="flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          {title}
        </span>
        <span className="text-slate-600">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="p-2.5 flex flex-col gap-2">{children}</div>}
    </div>
  );
}