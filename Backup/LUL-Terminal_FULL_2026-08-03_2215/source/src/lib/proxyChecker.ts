/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CheckedProxy, ProxyType } from './proxyScraper';
import { sessionFetch } from './sessionFetch';

const API = '/api/proxy-checker';

export type CheckerStats = {
  lastCheckAt: number | null;
  totalChecked: number;
  alive: number;
  dead: number;
  avgLatency: number;
  uniqueChecked?: number;
  duplicatesRemoved?: number;
  supportsHttps?: number;
  databaseAdded?: number;
  databaseUpdated?: number;
  anonymity?: Record<string, number>;
  byType?: Record<string, number>;
  recovered?: number;
  latencyGrades?: { fast: number; medium: number; slow: number };
  errorCategories?: Record<string, number>;
};

export type CheckOptions = {
  text?: string;
  proxies?: { host: string; port: number; type: ProxyType; raw?: string }[];
  useScraped?: boolean;
  timeoutMs?: number;
  concurrency?: number;
  testUrl?: string;
  httpsTestUrl?: string;
  detectAnonymity?: boolean;
  testHttps?: boolean;
  autoDetectType?: boolean;
  retries?: number;
  retryDelayMs?: number;
  defaultType?: ProxyType;
  limit?: number;
  detectExitIp?: boolean;
};

export type ExtendedCheckedProxy = CheckedProxy & {
  anonymity?: string;
  supportsHttps?: boolean;
  testUrl?: string;
  typeDetected?: boolean;
  typeCorrected?: boolean;
  latencyGrade?: 'fast' | 'medium' | 'slow' | 'dead';
  checkAttempts?: number;
  recovered?: boolean;
  exitIp?: string | null;
  errorCategory?: 'timeout' | 'connection' | 'dns' | 'http_status' | 'unknown' | 'dead' | null;
};

export type CheckerJob = {
  id: string;
  type: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  progress: number;
  total: number;
  message: string;
  logs: string[];
  alive?: number;
  recovered?: number;
  etaMs?: number | null;
  startedAt?: number;
  result?: unknown;
  error?: string | null;
};

export async function fetchCheckerStats(): Promise<CheckerStats> {
  const res = await sessionFetch(`${API}/stats`);
  if (!res.ok) throw new Error('Checker stats unavailable');
  return res.json() as Promise<CheckerStats>;
}

export async function fetchCheckerResults(): Promise<{
  checked: ExtendedCheckedProxy[];
  summary: CheckerStats | null;
  stats?: CheckerStats;
}> {
  const res = await sessionFetch(`${API}/results`);
  if (!res.ok) return { checked: [], summary: null };
  return res.json() as Promise<{ checked: ExtendedCheckedProxy[]; summary: CheckerStats | null; stats?: CheckerStats }>;
}

export async function fetchTestUrlPresets(): Promise<Record<string, string>> {
  const res = await sessionFetch(`${API}/presets`);
  if (!res.ok) return { google: 'http://www.google.com/generate_204' };
  const data = await res.json() as { testUrls: Record<string, string> };
  return data.testUrls ?? {};
}

export async function startCheckJob(opts: CheckOptions = {}): Promise<string> {
  const res = await sessionFetch(`${API}/check`, {
    method: 'POST',
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Could not start check');
  }
  const data = await res.json() as { jobId: string };
  return data.jobId;
}

export async function cancelCheckerJob(jobId: string): Promise<void> {
  const res = await sessionFetch(`${API}/jobs/${jobId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Cancel failed');
  }
}

export async function pollCheckerJob(
  jobId: string,
  onUpdate: (job: CheckerJob) => void,
  intervalMs = 800,
  options?: { onCancel?: () => void; signal?: AbortSignal },
): Promise<CheckerJob> {
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
        if (!res.ok) throw new Error('Job not found');
        const job = await res.json() as CheckerJob;
        onUpdate(job);
        if (job.status === 'done') {
          finish(() => resolve(job));
        } else if (job.status === 'cancelled') {
          options?.onCancel?.();
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

function formatProxyUrl(p: ExtendedCheckedProxy) {
  if (p.type === 'socks4') return `socks4://${p.raw}`;
  if (p.type === 'socks5') return `socks5://${p.raw}`;
  if (p.type === 'https') return `https://${p.raw}`;
  return `http://${p.raw}`;
}

export function exportCheckedTxt(proxies: ExtendedCheckedProxy[], aliveOnly = true) {
  const list = aliveOnly ? proxies.filter((p) => p.alive) : proxies;
  return list.map(formatProxyUrl).join('\n');
}

export function exportCheckedJson(proxies: ExtendedCheckedProxy[], aliveOnly = true) {
  const list = aliveOnly ? proxies.filter((p) => p.alive) : proxies;
  return JSON.stringify(list, null, 2);
}

export function exportCheckedCsv(proxies: ExtendedCheckedProxy[], aliveOnly = true) {
  const list = aliveOnly ? proxies.filter((p) => p.alive) : proxies;
  const header = 'proxy,type,alive,latency_ms,latency_grade,anonymity,supports_https,exit_ip,error';
  const rows = list.map((p) => [
    formatProxyUrl(p),
    p.type,
    p.alive ? '1' : '0',
    p.latency ?? '',
    p.latencyGrade ?? '',
    p.anonymity ?? '',
    p.supportsHttps ? '1' : '0',
    p.exitIp ?? '',
    p.error ?? '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header, ...rows].join('\n');
}

export function formatEta(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `~${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `~${min}m ${rem}s` : `~${min}m`;
}