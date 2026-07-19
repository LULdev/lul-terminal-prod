/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PasteExpiry, PasteVisibility } from '../data/pasteLanguages';
import { PASTE_ID_RE } from './safePasteUrl';
import { sessionFetch } from './sessionFetch';

const API = '/api/paste';
const viewInflight = new Map<string, Promise<{ views: number; burned: boolean }>>();

export type PasteMeta = {
  id: string;
  title: string;
  language: string;
  visibility: PasteVisibility;
  locked: boolean;
  membersOnly: boolean;
  ownerOnly?: boolean;
  expiresAt: number | null;
  burnAfterRead: boolean;
  createdAt: number;
  updatedAt: number | null;
  views: number;
  size: number;
  lineCount: number;
  pinned?: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  userRating?: number;
  canRate?: boolean;
  ratingLockedUntil?: number | null;
  username: string | null;
  viewUrl: string;
  rawUrl: string;
  userId?: string | null;
};

export type PasteRecord = PasteMeta & {
  content: string | null;
  requiresPassword?: boolean;
  requiresLogin?: boolean;
  burned?: boolean;
  achievementUnlocks?: string[];
};

export type PasteStats = {
  pastesCreated: number;
  pasteViewsTotal: number;
  activePastes: number;
};

export type PasteSort = 'newest' | 'oldest' | 'views' | 'size' | 'title' | 'pinned';

export type MyPasteStats = {
  count: number;
  totalViews: number;
  totalBytes: number;
  totalLines: number;
  pinned: number;
  burnAfterRead: number;
  protectedCount: number;
  avgViews: number;
  byVisibility: Record<string, number>;
  byLanguage: Record<string, number>;
  topViewedId: string | null;
  topViewedTitle: string | null;
  topViewedViews: number;
};

export type PasteForkPayload = {
  title: string;
  content: string;
  language: string;
  visibility: PasteVisibility;
  sourceId: string;
};

export type CreatePasteInput = {
  title: string;
  content: string;
  language: string;
  visibility: PasteVisibility;
  password?: string;
  expiry: PasteExpiry;
  burnAfterRead?: boolean;
};

export function parsePasteViewerId(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  let raw: string | null = null;
  if (hash.startsWith('p/')) raw = hash.slice(2).split(/[?#]/)[0] || null;
  else {
    const match = window.location.pathname.match(/^\/p\/([^/]+)\/?$/);
    raw = match?.[1] ?? null;
  }
  if (!raw || !PASTE_ID_RE.test(raw)) return null;
  return raw;
}

export function buildPasteUrl(id: string): string {
  return `${window.location.origin}/p/${id}`;
}

export function formatPasteBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPasteDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function expiryLabel(expiresAt: number | null): string {
  if (!expiresAt) return 'Never expires';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Expires in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `Expires in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Expires in ${days}d`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || 'Request failed';
  }
}

export async function fetchPasteStats(): Promise<PasteStats> {
  const res = await fetch(`${API}/stats`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchPublicPastes(limit = 30): Promise<PasteMeta[]> {
  const res = await fetch(`${API}/public?limit=${limit}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.pastes ?? [];
}

export async function fetchMyPastes(sort: PasteSort = 'newest'): Promise<PasteMeta[]> {
  const res = await sessionFetch(`${API}/my?sort=${sort}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.pastes ?? [];
}

export async function fetchMyPasteStats(): Promise<MyPasteStats> {
  const res = await sessionFetch(`${API}/my/stats`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchTrendingPastes(limit = 12): Promise<PasteMeta[]> {
  const res = await fetch(`${API}/trending?limit=${limit}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.pastes ?? [];
}

async function fetchPasteResponse(id: string, credentialed: boolean) {
  const headers = { 'Content-Type': 'application/json' };
  return credentialed
    ? sessionFetch(`${API}/${id}`, { credentials: 'include', headers })
    : fetch(`${API}/${id}`, { credentials: 'omit', headers });
}

export async function fetchPaste(id: string, { credentialed = true } = {}): Promise<PasteRecord> {
  const res = await fetchPasteResponse(id, credentialed);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchPasteMeta(id: string, { credentialed = false } = {}): Promise<PasteMeta | null> {
  const res = await fetchPasteResponse(id, credentialed);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json() as PasteRecord;
  if (data.requiresPassword || data.requiresLogin || !data.content) {
    return {
      id: data.id,
      title: data.title,
      language: data.language,
      visibility: data.visibility,
      locked: data.locked,
      membersOnly: data.membersOnly ?? data.visibility === 'private',
      expiresAt: data.expiresAt,
      burnAfterRead: data.burnAfterRead,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      views: data.views ?? 0,
      size: data.size,
      lineCount: data.lineCount,
      ratingAvg: data.ratingAvg ?? 0,
      ratingCount: data.ratingCount ?? 0,
      username: data.username,
      viewUrl: data.viewUrl,
      rawUrl: data.rawUrl,
    };
  }
  return data;
}

export async function unlockPaste(id: string, password: string): Promise<PasteRecord> {
  const res = await sessionFetch(`${API}/${id}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/**
 * Sync view count after load. GET /api/paste/:id already increments views server-side
 * (including the owner's first view). This only refreshes the number — never fabricates "burned".
 */
export async function recordPasteView(
  id: string,
  opts: { knownViews?: number; burnAfterRead?: boolean } = {},
): Promise<{ views: number; burned: boolean }> {
  const pending = viewInflight.get(id);
  if (pending) return pending;

  const run = (async () => {
    // Prefer views already returned by the GET paste payload
    if (typeof opts.knownViews === 'number' && opts.knownViews >= 0) {
      return { views: opts.knownViews, burned: false };
    }
    try {
      const meta = await fetchPasteMeta(id, { credentialed: true });
      if (meta) return { views: meta.views ?? 0, burned: false };
    } catch { /* ignore */ }
    return { views: 0, burned: false };
  })();

  viewInflight.set(id, run);
  try {
    return await run;
  } finally {
    if (viewInflight.get(id) === run) viewInflight.delete(id);
  }
}

export function pollPasteMeta(
  id: string,
  onUpdate: (meta: PasteMeta) => void,
  intervalMs = 4000,
  opts: { credentialed?: boolean } = {},
): () => void {
  let active = true;
  const credentialed = opts.credentialed !== false;
  const tick = async () => {
    if (!active || document.hidden) return;
    try {
      // credentialed by default so private pastes keep live view counts after create
      const meta = await fetchPasteMeta(id, { credentialed });
      if (meta && active) onUpdate(meta);
    } catch { /* ignore */ }
  };
  tick();
  const t = setInterval(tick, intervalMs);
  const onVis = () => { if (!document.hidden) void tick(); };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    active = false;
    clearInterval(t);
    document.removeEventListener('visibilitychange', onVis);
  };
}

export function formatPasteViews(n: number): string {
  return n.toLocaleString('en-US');
}

const MAX_PASTE_BYTES = 512 * 1024;

export async function createPaste(input: CreatePasteInput): Promise<PasteRecord> {
  const bytes = new TextEncoder().encode(input.content ?? '').length;
  if (bytes > MAX_PASTE_BYTES) throw new Error('Paste max. 512 KB');
  const res = await sessionFetch(API, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type AdminPasteMeta = PasteMeta & {
  hasPassword?: boolean;
};

export type AdminPasteStats = {
  total: number;
  byVisibility: Record<string, number>;
  burnAfterRead: number;
  protectedCount: number;
  totalViews: number;
  totalBytes: number;
};

export type AdminPasteUpdateInput = {
  title?: string;
  content?: string;
  language?: string;
  visibility?: PasteVisibility;
  password?: string;
  expiry?: PasteExpiry;
  burnAfterRead?: boolean;
  pinned?: boolean;
};

export async function fetchAdminPastes(opts: {
  q?: string;
  visibility?: string;
  sort?: PasteSort;
  limit?: number;
  offset?: number;
} = {}): Promise<{ pastes: AdminPasteMeta[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.visibility) params.set('visibility', opts.visibility);
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  const res = await sessionFetch(`${API}/admin?${params}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchAdminPasteStats(): Promise<AdminPasteStats> {
  const res = await sessionFetch(`${API}/admin/stats`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchAdminPaste(id: string): Promise<PasteRecord & { hasPassword?: boolean }> {
  const res = await sessionFetch(`${API}/admin/${id}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function adminUpdatePaste(id: string, patch: AdminPasteUpdateInput): Promise<PasteRecord> {
  const res = await sessionFetch(`${API}/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function adminDeletePaste(id: string): Promise<void> {
  const res = await sessionFetch(`${API}/admin/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function deletePaste(id: string): Promise<void> {
  const res = await sessionFetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function updatePasteMeta(
  id: string,
  patch: { pinned?: boolean; title?: string },
): Promise<PasteRecord> {
  const res = await sessionFetch(`${API}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function forkPaste(id: string): Promise<PasteForkPayload> {
  const res = await sessionFetch(`${API}/${id}/fork`, { method: 'POST' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type PasteRateResult = {
  ratingAvg: number;
  ratingCount: number;
  userRating: number;
  canRate?: boolean;
  lockedUntil?: number | null;
};

export async function ratePaste(id: string, stars: number): Promise<PasteRateResult> {
  // soft401: guests rate without session — never wipe login on 401
  const res = await sessionFetch(
    `${API}/${id}/rate`,
    { method: 'POST', body: JSON.stringify({ stars }) },
    { soft401: true },
  );
  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await res.json() as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    const msg = typeof body.error === 'string' ? body.error : (res.statusText || 'Rating failed');
    const err = new Error(msg) as Error & {
      code?: string;
      userRating?: number;
      lockedUntil?: number;
      ratingAvg?: number;
      ratingCount?: number;
    };
    if (typeof body.code === 'string') err.code = body.code;
    if (typeof body.userRating === 'number') err.userRating = body.userRating;
    if (typeof body.lockedUntil === 'number') err.lockedUntil = body.lockedUntil;
    if (typeof body.ratingAvg === 'number') err.ratingAvg = body.ratingAvg;
    if (typeof body.ratingCount === 'number') err.ratingCount = body.ratingCount;
    throw err;
  }
  return res.json() as Promise<PasteRateResult>;
}

export function dedupePasteLines(content: string): { content: string; removed: number } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const line of lines) {
    if (seen.has(line)) {
      removed += 1;
      continue;
    }
    seen.add(line);
    out.push(line);
  }
  return { content: out.join('\n'), removed };
}

export type PasteSearchResult = {
  lineNumbers: number[];
  matchCount: number;
};

export function findPasteSearchMatches(content: string, query: string): PasteSearchResult {
  const q = query.trim().toLowerCase();
  if (!q) return { lineNumbers: [], matchCount: 0 };
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const lineNumbers: number[] = [];
  let matchCount = 0;
  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    let idx = 0;
    let foundOnLine = false;
    while ((idx = lower.indexOf(q, idx)) !== -1) {
      matchCount += 1;
      foundOnLine = true;
      idx += q.length;
    }
    if (foundOnLine) lineNumbers.push(i);
  });
  return { lineNumbers, matchCount };
}

export function downloadPasteText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}