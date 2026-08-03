/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side visitor context — attached to analytics session_start & tab events.
 */

const VISIT_COUNT_KEY = 'lul_visit_count';
const FIRST_VISIT_KEY = 'lul_first_visit_at';
const LAST_VISIT_KEY = 'lul_last_visit_at';
const SESSION_COUNTED_KEY = 'lul_session_counted';

export type VisitorContext = {
  referrer: string;
  referrerDomain: string;
  referrerType: string;
  landingUrl: string;
  landingPath: string;
  visitCount: number;
  returnVisitor: boolean;
  daysSinceLastVisit: number;
  firstVisitAt: number;
  language: string;
  languages: string;
  timezone: string;
  screen: string;
  viewport: string;
  deviceType: string;
  platform: string;
  connection: string;
  colorScheme: string;
  reducedMotion: boolean;
  touchSupport: boolean;
  cookieEnabled: boolean;
  online: boolean;
  hardwareConcurrency: number;
  deviceMemory: number;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  refCode: string;
  pageLoadMs: number;
  isLoggedIn: boolean;
};

function parseReferrerDomain(referrer: string): string {
  if (!referrer) return 'direct';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '') || 'direct';
  } catch {
    return 'unknown';
  }
}

function classifyReferrer(referrer: string, referrerDomain: string): string {
  if (!referrer || referrerDomain === 'direct') return 'direct';
  const host = referrerDomain.toLowerCase();
  if (host === window.location.hostname.replace(/^www\./, '')) return 'internal';
  if (/google\.|bing\.|duckduckgo|yahoo\.|baidu\.|ecosia\./.test(host)) return 'search';
  if (/facebook|twitter|x\.com|instagram|reddit|discord|telegram|tiktok|linkedin/.test(host)) return 'social';
  if (/t\.co|bit\.ly|lnk\.|short/.test(host)) return 'shortlink';
  return 'external';
}

function detectDeviceType(): string {
  const w = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua) || w < 640) return 'mobile';
  if (/ipad|tablet|playbook|silk/i.test(ua) || (w >= 640 && w < 1024)) return 'tablet';
  return 'desktop';
}

function readVisitStats(): { visitCount: number; firstVisitAt: number; daysSinceLastVisit: number } {
  const now = Date.now();
  let visitCount = 1;
  let firstVisitAt = now;
  let daysSinceLastVisit = 0;
  try {
    const alreadyCounted = sessionStorage.getItem(SESSION_COUNTED_KEY);
    const storedFirst = Number(localStorage.getItem(FIRST_VISIT_KEY)) || now;
    firstVisitAt = storedFirst || now;

    if (alreadyCounted) {
      visitCount = Math.max(1, Number(localStorage.getItem(VISIT_COUNT_KEY)) || 1);
      const lastVisit = Number(localStorage.getItem(LAST_VISIT_KEY));
      if (lastVisit) daysSinceLastVisit = Math.floor((now - lastVisit) / (24 * 60 * 60 * 1000));
      return { visitCount, firstVisitAt, daysSinceLastVisit };
    }

    sessionStorage.setItem(SESSION_COUNTED_KEY, '1');
    const prev = Number(localStorage.getItem(VISIT_COUNT_KEY)) || 0;
    visitCount = prev + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
      localStorage.setItem(FIRST_VISIT_KEY, String(now));
      firstVisitAt = now;
    }

    const lastVisit = Number(localStorage.getItem(LAST_VISIT_KEY));
    if (lastVisit) {
      daysSinceLastVisit = Math.floor((now - lastVisit) / (24 * 60 * 60 * 1000));
    }
    localStorage.setItem(LAST_VISIT_KEY, String(now));
  } catch { /* ignore */ }
  return { visitCount, firstVisitAt, daysSinceLastVisit };
}

/** Collect ~25 visitor dimensions once per page load. */
export function collectVisitorContext(isLoggedIn = false): VisitorContext {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || '';
  const referrerDomain = parseReferrerDomain(referrer);
  const { visitCount, firstVisitAt, daysSinceLastVisit } = readVisitStats();

  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
    userAgentData?: { platform?: string };
  };

  let pageLoadMs = 0;
  try {
    const [navEntry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntry?.loadEventEnd) pageLoadMs = Math.round(navEntry.loadEventEnd);
  } catch { /* ignore */ }

  return {
    referrer: referrer.slice(0, 200),
    referrerDomain,
    referrerType: classifyReferrer(referrer, referrerDomain),
    landingUrl: window.location.href.slice(0, 200),
    landingPath: (window.location.pathname + window.location.hash).slice(0, 120),
    visitCount,
    returnVisitor: visitCount > 1,
    daysSinceLastVisit,
    firstVisitAt,
    language: navigator.language || 'unknown',
    languages: (navigator.languages ?? []).slice(0, 4).join(',').slice(0, 80),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    screen: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    deviceType: detectDeviceType(),
    platform: nav.userAgentData?.platform || navigator.platform || 'unknown',
    connection: nav.connection?.effectiveType || 'unknown',
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    touchSupport: (navigator.maxTouchPoints ?? 0) > 0,
    cookieEnabled: navigator.cookieEnabled,
    online: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    deviceMemory: nav.deviceMemory ?? 0,
    utmSource: (params.get('utm_source') ?? '').slice(0, 64),
    utmMedium: (params.get('utm_medium') ?? '').slice(0, 64),
    utmCampaign: (params.get('utm_campaign') ?? '').slice(0, 64),
    utmTerm: (params.get('utm_term') ?? '').slice(0, 64),
    refCode: (params.get('ref') ?? '').slice(0, 32).toUpperCase(),
    pageLoadMs,
    isLoggedIn,
  };
}

/** Flatten for analytics meta payload. */
export function visitorContextToMeta(ctx: VisitorContext): Record<string, string | number | boolean> {
  return { ...ctx };
}