/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PostViewType = 'changelog' | 'news';

export type PostViewsMap = Record<string, number>;

export type AllPostViews = {
  changelog: PostViewsMap;
  news: PostViewsMap;
};

const API = '/api/post-views';
const VIEW_SESSION_PREFIX = 'lul_post_view_';
const inflight = new Map<string, Promise<number>>();

export async function fetchAllPostViews(): Promise<AllPostViews> {
  try {
    const res = await fetch(API, { credentials: 'include' });
    if (!res.ok) return { changelog: {}, news: {} };
    return res.json() as Promise<AllPostViews>;
  } catch {
    return { changelog: {}, news: {} };
  }
}

export async function recordPostView(
  type: PostViewType,
  id: string,
  currentViews = 0,
): Promise<number> {
  const inflightKey = `${type}:${id}`;
  const pending = inflight.get(inflightKey);
  if (pending) return pending;

  const run = (async () => {
    const sessionKey = `${VIEW_SESSION_PREFIX}${type}:${id}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      return currentViews;
    }
    try {
      const res = await fetch(`${API}/view`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(sessionKey, '1');
        }
        const data = await res.json() as { views: number };
        return data.views;
      }
    } catch {
      /* best-effort */
    }
    return currentViews;
  })();

  inflight.set(inflightKey, run);
  try {
    return await run;
  } finally {
    if (inflight.get(inflightKey) === run) inflight.delete(inflightKey);
  }
}