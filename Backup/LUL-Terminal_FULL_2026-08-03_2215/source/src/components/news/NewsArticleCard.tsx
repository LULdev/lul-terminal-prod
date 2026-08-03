/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, Eye, Radio, User } from 'lucide-react';
import type { TabId } from '../../config/menuItems';
import { ALL_TAB_IDS } from '../../config/menuItems';
import { useAuth } from '../../context/AuthContext';
import { usePageVisibility } from '../../context/PageVisibilityContext';
import type { NewsArticle } from '../../types/news';
import { formatNewsDate } from '../../lib/news';
import { safeHref } from '../../lib/safeHref';

type Props = {
  article: NewsArticle;
  variant?: 'featured' | 'standard' | 'compact';
  views?: number;
  onNavigateTab?: (tab: TabId, opts?: { profileUsername?: string }) => void;
};

const BODY_CLAMP = 220;
const LINK_SPLIT_RE = /(https?:\/\/[^\s<>"']+|\/?\?tab=[a-zA-Z0-9_-]+|\/profile\/[a-zA-Z0-9_]+)/gi;
const LINK_MATCH_RE = /^(https?:\/\/|\/?\?tab=|\/profile\/)/i;
const TRAIL_PUNCT_RE = /[.,;:!?)]+$/;

function stripTrailingPunct(url: string) {
  return url.replace(TRAIL_PUNCT_RE, '');
}

function parseTabFromHref(href: string): TabId | null {
  const m = href.match(/[?&]tab=([a-zA-Z0-9_-]+)/);
  const tab = m?.[1] as TabId | undefined;
  return tab && ALL_TAB_IDS.includes(tab) ? tab : null;
}

function renderBodyText(
  text: string,
  opts: {
    isLoggedIn: boolean;
    requiresLogin: (tab: TabId) => boolean;
    onLoginGate?: (tab: TabId) => void;
    onNavigateTab?: (tab: TabId, opts?: { profileUsername?: string }) => void;
  },
) {
  const parts = text.split(LINK_SPLIT_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    if (LINK_MATCH_RE.test(part)) {
      const clean = stripTrailingPunct(part);
      const isExternal = clean.startsWith('http');
      const href = isExternal
        ? safeHref(clean)
        : safeHref(clean.startsWith('/') ? clean : `/${clean}`);
      if (!href) return <React.Fragment key={i}>{part}</React.Fragment>;
      const suffix = part.slice(clean.length);
      return (
        <React.Fragment key={`${part}-${i}`}>
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            onClick={isExternal ? undefined : (e) => {
              e.preventDefault();
              const tab = parseTabFromHref(href);
              const profileMatch = href.match(/^\/profile\/([a-zA-Z0-9_]+)/);
              if (profileMatch) {
                const username = profileMatch[1];
                if (opts.onNavigateTab) {
                  opts.onNavigateTab('profile', { profileUsername: username });
                  return;
                }
                if (!opts.isLoggedIn && opts.requiresLogin('profile')) {
                  opts.onLoginGate?.('profile');
                  return;
                }
              }
              if (tab) {
                if (opts.onNavigateTab) {
                  opts.onNavigateTab(tab);
                  return;
                }
                if (!opts.isLoggedIn && opts.requiresLogin(tab)) {
                  opts.onLoginGate?.(tab);
                  return;
                }
              }
              const path = href.startsWith('/') ? href : `/${href}`;
              window.history.pushState(null, '', path);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all"
          >
            {clean}
          </a>
          {suffix}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function NewsArticleCard({ article, variant = 'standard', views, onNavigateTab }: Props) {
  const { isLoggedIn, openLoginGate } = useAuth();
  const { requiresLogin } = usePageVisibility();
  const [expanded, setExpanded] = useState(false);
  const highlight = Boolean(article.highlight);
  const isFeatured = variant === 'featured';
  const isCompact = variant === 'compact';
  const longBody = article.body.length > BODY_CLAMP;
  const showClamp = longBody && !expanded && !isFeatured;

  const viewLabel = views === 1 ? 'view' : 'views';

  return (
    <article
      className={`group relative overflow-hidden transition-all duration-300 ${
        isFeatured
          ? 'rounded-2xl border border-indigo-500/35 bg-gradient-to-br from-indigo-950/60 via-[#10131c] to-[#08090d] shadow-[0_8px_40px_rgba(99,102,241,0.15)]'
          : isCompact
            ? 'rounded-xl border border-slate-800/70 bg-[#0e1018]/90 hover:border-slate-700'
            : highlight
              ? 'rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-[#12151f] to-[#0c0d12] shadow-[0_0_20px_rgba(99,102,241,0.08)] hover:border-indigo-500/45'
              : 'rounded-xl border border-slate-800/80 bg-[#12151f]/75 hover:border-slate-700/90 hover:bg-[#141824]/85'
      }`}
    >
      {(highlight || isFeatured) && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
      )}

      <div className={`${isFeatured ? 'p-5 sm:p-6' : isCompact ? 'p-3' : 'p-4'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider ${
                isFeatured
                  ? 'px-2.5 py-1 text-[9px] text-indigo-100 border-indigo-400/40 bg-indigo-500/15'
                  : highlight
                    ? 'px-2 py-0.5 text-[8px] text-indigo-200 border-indigo-500/35 bg-indigo-500/10'
                    : 'px-2 py-0.5 text-[8px] text-slate-400 border-slate-700/60 bg-slate-800/40'
              }`}
            >
              <span className={isFeatured ? 'text-base leading-none' : 'text-[10px] leading-none'}>
                {article.icon ?? '📰'}
              </span>
              {article.category}
            </span>
            {highlight && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest text-rose-200 border border-rose-500/30 bg-rose-500/10">
                <Radio size={8} className="animate-pulse" />
                Live
              </span>
            )}
          </div>
          <time
            className={`font-mono text-slate-500 tabular-nums shrink-0 ${isFeatured ? 'text-[10px]' : 'text-[9px]'}`}
            dateTime={article.publishedAt}
          >
            {formatNewsDate(article.publishedAt)}
          </time>
        </div>

        <h3
          className={`font-semibold leading-snug ${
            isFeatured
              ? 'text-lg sm:text-xl text-white mb-3'
              : isCompact
                ? 'text-xs text-slate-100 mb-1.5 line-clamp-2'
                : 'text-sm text-slate-100 mb-2'
          }`}
        >
          {article.title}
        </h3>

        <p
          className={`text-slate-400 leading-relaxed whitespace-pre-wrap ${
            isFeatured ? 'text-[12px] sm:text-[13px]' : isCompact ? 'text-[10px] line-clamp-3' : 'text-[11px]'
          } ${showClamp ? 'line-clamp-4' : ''}`}
        >
          {renderBodyText(article.body, { isLoggedIn, requiresLogin, onLoginGate: openLoginGate, onNavigateTab })}
        </p>

        {showClamp && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={expanded}
            className="mt-2 inline-flex items-center gap-1 text-[9px] font-mono text-indigo-400/90 hover:text-indigo-300 transition-colors"
          >
            Read more
            <ChevronDown size={10} />
          </button>
        )}

        <div
          className={`flex items-center justify-between gap-3 border-t border-slate-800/60 ${
            isFeatured ? 'mt-5 pt-3' : isCompact ? 'mt-2 pt-2' : 'mt-3 pt-2.5'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <User size={isFeatured ? 11 : 10} className="text-slate-600 shrink-0" />
            <span className={`font-mono text-slate-500 truncate ${isFeatured ? 'text-[10px]' : 'text-[9px]'}`}>
              {article.authorName}
            </span>
          </div>
          {views !== undefined && (
            <span
              className={`flex items-center gap-1 font-mono text-slate-500 tabular-nums shrink-0 ${
                isFeatured ? 'text-[10px]' : 'text-[9px]'
              }`}
              title="Post views"
            >
              <Eye size={isFeatured ? 11 : 9} className="opacity-70" />
              {views.toLocaleString('en-US')} {viewLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}