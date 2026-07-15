/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { CHANGELOG } from '../../data/changelog';
import { APP_VERSION } from '../../config/version';
import { useAuth } from '../../context/AuthContext';
import { usePostViews } from '../../hooks/usePostViews';
import { ChangelogEntry } from './ChangelogEntry';
import { ChangelogLegend } from './ChangelogLegend';
import { ChangelogPagination } from './ChangelogPagination';
import { PageShell } from '../pages/PageShell';

const PAGE_SIZE = 6;

type ChangelogPanelProps = {
  isActive?: boolean;
};

export const ChangelogPanel = memo(function ChangelogPanel({ isActive = true }: ChangelogPanelProps) {
  const { isLoggedIn } = useAuth();
  const { views, registerView } = usePostViews('changelog', { enabled: isActive && isLoggedIn });
  const [page, setPage] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const pageCount = Math.max(1, Math.ceil(CHANGELOG.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = CHANGELOG.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, next));
      setPage(clamped);
      requestAnimationFrame(() => {
        timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [pageCount],
  );

  useEffect(() => {
    if (!isActive || pageCount <= 1) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(safePage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(safePage + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToPage, isActive, pageCount, safePage]);

  const paginationProps = {
    page: safePage,
    pageCount,
    pageSize: PAGE_SIZE,
    total: CHANGELOG.length,
    versionFrom: paged[0]?.version,
    versionTo: paged[paged.length - 1]?.version,
    onPageChange: goToPage,
  };

  return (
    <PageShell
      id="changelog-module"
      pageId="changelog"
      icon="📜"
      title="Changelog"
      subtitle={`Release history · v${APP_VERSION}`}
      accentClass="text-indigo-400"
      contentClassName="changelog-scroll"
    >
      <ChangelogLegend />

      {pageCount > 1 && (
        <div className="mb-5">
          <ChangelogPagination {...paginationProps} />
        </div>
      )}

      <div
        ref={timelineRef}
        className="space-y-5 pl-4 border-l-2 border-indigo-500/20 relative max-w-5xl scroll-mt-3"
        id="timeline-flow"
      >
        {paged.map((entry, idx) => (
          <ChangelogEntry
            key={entry.version}
            entry={entry}
            idx={idx}
            views={views[entry.version] ?? 0}
            onView={registerView}
            trackViews={isActive}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-6">
          <ChangelogPagination {...paginationProps} />
        </div>
      )}
    </PageShell>
  );
});