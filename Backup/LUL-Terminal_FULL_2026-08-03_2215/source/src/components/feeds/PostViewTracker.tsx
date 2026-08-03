/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';

type Props = {
  postId: string;
  views: number;
  onView: (id: string) => void;
  children: React.ReactNode;
  hideFooter?: boolean;
  enabled?: boolean;
};

export function PostViewTracker({
  postId,
  views,
  onView,
  children,
  hideFooter = false,
  enabled = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onView(postId);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [postId, onView, enabled]);

  const label = views === 1 ? 'view' : 'views';

  return (
    <div ref={ref}>
      {children}
      {!hideFooter && (
        <div className="flex justify-end mt-2 pt-1.5 border-t border-slate-700/30 min-h-[22px]">
          <span className="text-[9px] text-slate-500 flex items-center gap-1 font-mono tabular-nums" title="Post views">
            <Eye size={9} className="opacity-70 shrink-0" />
            {views.toLocaleString('en-US')} {label}
          </span>
        </div>
      )}
    </div>
  );
}