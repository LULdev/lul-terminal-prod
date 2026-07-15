/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

export function AdminPanelFallback({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-violet-500/15 bg-[#0c0d12]/60 px-4 py-8 text-center text-sm text-violet-300/70">
      {label} Loading…
    </div>
  );
}

function AdminPanelPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800/80 bg-black/20 px-4 py-10 text-center text-[10px] font-mono text-slate-600">
      {label} — scroll to load
    </div>
  );
}

type LazyAdminSectionProps = {
  id?: string;
  label: string;
  children: ReactNode;
  /** Prefetch chunk when section is within this margin of the viewport. */
  rootMargin?: string;
  className?: string;
};

/** Loads children only when the section enters (or nears) the viewport. */
export function LazyAdminSection({
  id,
  label,
  children,
  rootMargin = '280px 0px',
  className,
}: LazyAdminSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const activate = () => setActive(true);
    el.addEventListener('admin-prefetch', activate);

    if (active) {
      return () => el.removeEventListener('admin-prefetch', activate);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          activate();
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeEventListener('admin-prefetch', activate);
    };
  }, [active, rootMargin]);

  return (
    <div ref={ref} id={id} className={className}>
      {active ? (
        <Suspense fallback={<AdminPanelFallback label={label} />}>{children}</Suspense>
      ) : (
        <AdminPanelPlaceholder label={label} />
      )}
    </div>
  );
}

