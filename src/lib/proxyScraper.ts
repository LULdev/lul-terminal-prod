/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionFetch } from './sessionFetch';

const API = '/api/proxy';

export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5';

export type ProxySource = {
  id: string;
  name: string;
  url: string;
  type: ProxyType;
  repo: string;
};

export type ScrapedProxy = {
  host: string;
  port: number;
  type: ProxyType;
  raw: string;
  sources?: string[];
};

export type CheckedProxy = ScrapedProxy & {
  alive: boolean;
  latency: number | null;
  error?: string | null;
  checkedAt?: number;
};

export type CustomProxy = ScrapedProxy & {
  source?: 'custom';
  addedAt?: number;
};

export type ProxyStats = {
  sourceCount: number;
  lastScrapeAt: number | null;
  lastCheckAt: number | null;
  totalScraped: number;
  uniqueProxies: number;
  alive: number;
  dead: number;
  avgLatency: number;
  sourcesOk?: number;
  sourcesFailed?: number;
  scrapedCount?: number;
  customCount?: number;
  poolCount?: number;
  byType?: Record<string, number>;
};

export type SourceScrapeResult = {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  format?: string | null;
  discovered?: number;
  fetched?: number;
  bytes?: number;
  error?: string;
};

export type ProxyJob = {
  id: string;
  type: string;
  status: 'running' | 'done' | 'error';
  progress: number;
  total: number;
  message: string;
  logs: string[];
  result?: { sourceResults?: SourceScrapeResult[]; proxies?: number };
  error?: string | null;
  lastResult?: { format?: string; discovered?: number; count?: number };
};

export async function fetchProxyStats(): Promise<ProxyStats> {
  const res = await fetch(`${API}/stats`);
  if (!res.ok) throw new Error('Stats unavailable');
  return res.json() as Promise<ProxyStats>;
}

export async function fetchProxySources(): Promise<ProxySource[]> {
  const res = await fetch(`${API}/sources`);
  if (!res.ok) return [];
  const data = await res.json() as { sources: ProxySource[] };
  return data.sources ?? [];
}

export async function fetchProxyResults(): Promise<{
  proxies: ScrapedProxy[];
  checked: CheckedProxy[];
  stats?: ProxyStats;
  scrapedCount?: number;
  customCount?: number;
  poolCount?: number;
}> {
  const res = await fetch(`${API}/results`);
  if (!res.ok) return { proxies: [], checked: [] };
  return res.json() as Promise<{
    proxies: ScrapedProxy[];
    checked: CheckedProxy[];
    stats?: ProxyStats;
    scrapedCount?: number;
    customCount?: number;
    poolCount?: number;
  }>;
}

export async function fetchCustomProxies(): Promise<{ count: number; proxies: CustomProxy[]; updatedAt: string | null }> {
  const res = await sessionFetch(`${API}/custom`);
  if (!res.ok) return { count: 0, proxies: [], updatedAt: null };
  return res.json() as Promise<{ count: number; proxies: CustomProxy[]; updatedAt: string | null }>;
}

export async function addCustomProxies(body: {
  text?: string;
  defaultType?: ProxyType;
  proxies?: { host: string; port: number; type?: ProxyType }[] | string[];
}): Promise<{ added: number; skipped: number; count: number; proxies: CustomProxy[] }> {
  const res = await sessionFetch(`${API}/custom`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({})) as { error?: string; added?: number; skipped?: number; count?: number; proxies?: CustomProxy[] };
  if (!res.ok) throw new Error(data.error ?? 'Could not save proxies');
  return {
    added: data.added ?? 0,
    skipped: data.skipped ?? 0,
    count: data.count ?? 0,
    proxies: data.proxies ?? [],
  };
}

export async function deleteCustomProxy(key: string): Promise<void> {
  const res = await sessionFetch(`${API}/custom/${encodeURIComponent(key)}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Delete failed');
  }
}

export async function clearCustomProxies(): Promise<void> {
  const res = await sessionFetch(`${API}/custom`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Clear failed');
  }
}

export function proxyListKey(p: ScrapedProxy) {
  return `${p.type}:${p.host}:${p.port}`;
}

export async function startScrapeJob(body: {
  customUrls?: string[];
  sourceIds?: string[];
  defaultType?: ProxyType;
} = {}): Promise<string> {
  const res = await sessionFetch(`${API}/scrape`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Could not start scrape');
  }
  const data = await res.json() as { jobId: string };
  return data.jobId;
}

export async function addProxySource(source: Partial<ProxySource>): Promise<ProxySource> {
  const res = await sessionFetch(`${API}/sources`, {
    method: 'POST',
    body: JSON.stringify(source),
  });
  const data = await res.json().catch(() => ({})) as { error?: string; source?: ProxySource };
  if (!res.ok) throw new Error(data.error ?? 'Could not save source');
  return data.source as ProxySource;
}

export async function deleteProxySource(id: string): Promise<void> {
  const res = await sessionFetch(`${API}/sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Delete failed');
  }
}

/** @deprecated Use startScrapeJob — checker is separate */
export async function startJob(endpoint: 'scrape', body: Record<string, unknown> = {}): Promise<string> {
  const res = await sessionFetch(`${API}/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Could not start job');
  }
  const data = await res.json() as { jobId: string };
  return data.jobId;
}

export type PollJobOptions = { signal?: AbortSignal };

export async function pollJob(
  jobId: string,
  onUpdate: (job: ProxyJob) => void,
  intervalMs = 800,
  options?: PollJobOptions,
): Promise<ProxyJob> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const onAbort = () => {
      finish(() => reject(new DOMException('Aborted', 'AbortError')));
    };

    const cleanup = () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      options?.signal?.removeEventListener('abort', onAbort);
    };

    const finish = (fn: () => void) => {
      cleanup();
      fn();
    };

    if (options?.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    const tick = async () => {
      if (document.hidden || options?.signal?.aborted) return;
      try {
        const res = await sessionFetch(`${API}/jobs/${jobId}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) throw new Error('Admin session required');
          throw new Error('Job not found');
        }
        const job = await res.json() as ProxyJob;
        onUpdate(job);
        if (job.status === 'done') {
          finish(() => resolve(job));
        } else if (job.status === 'error') {
          finish(() => reject(new Error(job.error ?? 'Job failed')));
        }
      } catch (e) {
        if (options?.signal?.aborted) return;
        finish(() => reject(e));
      }
    };

    const onVis = () => { if (!document.hidden) void tick(); };

    void tick();
    timer = setInterval(() => { void tick(); }, intervalMs);
    document.addEventListener('visibilitychange', onVis);
  });
}

export function formatProxyUrl(p: ScrapedProxy) {
  if (p.type === 'socks4') return `socks4://${p.raw}`;
  if (p.type === 'socks5') return `socks5://${p.raw}`;
  if (p.type === 'https') return `https://${p.raw}`;
  return `http://${p.raw}`;
}

export function exportTxt(proxies: CheckedProxy[], aliveOnly = true) {
  const list = aliveOnly ? proxies.filter((p) => p.alive) : proxies;
  return list.map((p) => formatProxyUrl(p)).join('\n');
}