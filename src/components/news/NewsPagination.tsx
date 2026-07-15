/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

type NewsPaginationProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  rangeFrom?: string;
  rangeTo?: string;
  onPageChange: (page: number) => void;
};

type PageToken = number | 'ellipsis';

function visiblePages(current: number, total: number): PageToken[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const keep = new Set<number>([0, total - 1, current, current - 1, current + 1]);
  const sorted = [...keep].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);
  const out: PageToken[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }

  return out;
}

const navBtn =
  'inline-flex items-center justify-center gap-1 rounded-md border border-slate-700/60 bg-[#161a24] px-2.5 py-2 text-[10px] font-mono text-slate-300 transition-colors hover:border-indigo-500/40 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-700/60 disabled:hover:text-slate-300';

export const NewsPagination = memo(function NewsPagination({
  page,
  pageCount,
  pageSize,
  total,
  rangeFrom,
  rangeTo,
  onPageChange,
}: NewsPaginationProps) {
  const pages = useMemo(() => visiblePages(page, pageCount), [page, pageCount]);
  const startIdx = page * pageSize + 1;
  const endIdx = Math.min((page + 1) * pageSize, total);

  return (
    <nav
      className="rounded-lg border border-indigo-500/20 bg-[#1e293b]/50 p-3 font-mono shadow-[0_0_16px_rgba(99,102,241,0.05)]"
      aria-label="News pagination"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-indigo-300">
            {rangeFrom && rangeTo ? (
              <>
                <span className="text-slate-400 truncate inline-block max-w-[140px] sm:max-w-none align-bottom">{rangeFrom}</span>
                <span className="mx-1.5 text-slate-600">→</span>
                <span className="text-slate-400 truncate inline-block max-w-[140px] sm:max-w-none align-bottom">{rangeTo}</span>
              </>
            ) : (
              'LUL Wire feed'
            )}
          </p>
          <p className="mt-0.5 text-[9px] text-slate-500">
            Showing {startIdx}–{endIdx} of {total} articles · {pageSize} per page
          </p>
        </div>

        <p className="text-[9px] text-slate-600 sm:text-right">
          Page {page + 1} of {pageCount}
          <span className="hidden sm:inline text-slate-700"> · ← → keys</span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={navBtn} disabled={page === 0} onClick={() => onPageChange(0)} aria-label="First page">
            <ChevronsLeft size={14} aria-hidden />
            <span className="hidden sm:inline">First</span>
          </button>
          <button type="button" className={navBtn} disabled={page === 0} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft size={14} aria-hidden />
            <span>Prev</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1 px-1">
          {pages.map((token, idx) =>
            token === 'ellipsis' ? (
              <span key={`gap-${idx}`} className="px-1 text-[10px] text-slate-600 select-none" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => onPageChange(token)}
                aria-label={`Page ${token + 1}`}
                aria-current={token === page ? 'page' : undefined}
                className={`min-w-[2rem] rounded-md border px-2 py-1.5 text-[10px] font-bold transition-colors ${
                  token === page
                    ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                    : 'border-slate-700/50 bg-[#161a24] text-slate-400 hover:border-indigo-500/35 hover:text-indigo-200'
                }`}
              >
                {token + 1}
              </button>
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={navBtn}
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={navBtn}
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(pageCount - 1)}
            aria-label="Last page"
          >
            <span className="hidden sm:inline">Last</span>
            <ChevronsRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  );
});