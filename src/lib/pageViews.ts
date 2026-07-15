/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API = '/api/page-views';
const SESSION_PREFIX = 'lul_page_view_';
const inflight = new Map<string, Promise<number>>();
const canUseSession = typeof sessionStorage !== 'undefined';

export async function fetchPageViews(pageId: string): Promise<number | null> {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(pageId)}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Math.max(0, Number(data.views) || 0);
  } catch {
    return null;
  }
}

export async function recordPageView(pageId: string): Promise<number> {
  const pending = inflight.get(pageId);
  if (pending) return pending;

  const run = (async () => {
    const sessionKey = `${SESSION_PREFIX}${pageId}`;
    if (!canUseSession || !sessionStorage.getItem(sessionKey)) {
      try {
        const res = await fetch(`${API}/${encodeURIComponent(pageId)}/view`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json() as { views?: number; deduped?: boolean };
          if (canUseSession) sessionStorage.setItem(sessionKey, '1');
          return Math.max(0, Number(data.views) || 0);
        }
      } catch { /* fall through */ }
    }
    return (await fetchPageViews(pageId)) ?? 0;
  })();

  inflight.set(pageId, run);
  try {
    return await run;
  } finally {
    if (inflight.get(pageId) === run) inflight.delete(pageId);
  }
}