/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionFetch } from './sessionFetch';

export type XmlLinkMatch = {
  value: string;
  path: string;
  source: 'attribute' | 'text' | 'cdata';
  attribute?: string;
  line: number;
  isLinkAttr?: boolean;
};

export type XmlScanResult = {
  pattern: string;
  mode: 'smart' | 'urls' | 'raw';
  stats: {
    xmlSize: number;
    stringsScanned: number;
    totalMatches: number;
    uniqueMatches: number;
    domains: number;
    attributeHits: number;
    textHits: number;
    cdataHits: number;
    protocols: Record<string, number>;
  };
  domains: { domain: string; count: number }[];
  matches: XmlLinkMatch[];
  scanMs: number;
};

export type PatternPreset = {
  id: string;
  label: string;
  pattern: string;
  hint: string;
};

export type WebsiteFeature = {
  id: string;
  title: string;
  desc: string;
};

export type ScraperSkill = {
  id: string;
  title: string;
  desc: string;
};

export type CrawlPreset = {
  id: string;
  label: string;
  maxPages: number;
  maxDepth: number;
  hint: string;
};

export type ColonAtlasEntry = {
  value: string;
  scheme: string;
  pages: { url: string; title: string; depth: number; siteName: string }[];
  hitCount: number;
};

export type CrawlPageStat = {
  url: string;
  title: string;
  depth: number;
  colonCount: number;
  status: number;
};

export type WebsiteCrawlResult = {
  startUrl: string;
  siteName: string;
  pattern: string;
  smartColon?: boolean;
  stats: {
    pagesCrawled: number;
    pagesFailed: number;
    pagesQueued: number;
    colonHits: number;
    uniqueColons: number;
    linksDiscovered: number;
    sitemapSeeded: number;
    crawlMs: number;
    schemes: Record<string, number>;
    maxDepthReached?: number;
    pagesWithColons?: number;
    avgColonsPerPage?: number;
    pagesPerSecond?: number;
    dedupeRatio?: number;
    successRate?: number;
    statusBreakdown?: Record<string, number>;
    schemeCount?: number;
    queueRemaining?: number;
    feedSeeded?: number;
    externalLinksFound?: number;
    scriptTokensFound?: number;
    metaTokensFound?: number;
    feedTokensFound?: number;

    totalBytes?: number;
    sources?: Record<string, number>;
    externalDomainCount?: number;
  };
  depthBreakdown: Record<string, number>;
  colonAtlas: ColonAtlasEntry[];
  pages: CrawlPageStat[];
  topPages?: CrawlPageStat[];
  topExternalDomains?: { domain: string; count: number }[];
  logs: string[];
};

export type CrawlJob = {
  id: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  message: string;
  progress: {
    pagesCrawled: number;
    queueSize: number;
    colonHits: number;
    maxPages: number;
    currentUrl?: string;
    maxDepth?: number;
    linksDiscovered?: number;
    pagesFailed?: number;
    sitemapSeeded?: number;
    elapsedMs?: number;
    pagesPerSecond?: number;
    uniqueColonsEstimate?: number;
    feedSeeded?: number;
    externalLinksFound?: number;
    scriptTokensFound?: number;
    metaTokensFound?: number;
  };
  logs: string[];
  result: WebsiteCrawlResult | null;
  error: string | null;
};

export async function fetchXmlScraperPresets(): Promise<{
  presets: PatternPreset[];
  websiteFeatures: WebsiteFeature[];
  scraperSkills: ScraperSkill[];
  crawlPresets: CrawlPreset[];
}> {
  const res = await sessionFetch('/api/xml-scraper/presets');
  if (!res.ok) return { presets: [], websiteFeatures: [], scraperSkills: [], crawlPresets: [] };
  const data = await res.json();
  return {
    presets: data.presets ?? [],
    websiteFeatures: data.websiteFeatures ?? [],
    scraperSkills: data.scraperSkills ?? data.websiteFeatures ?? [],
    crawlPresets: data.crawlPresets ?? [],
  };
}

export function normalizeStartUrl(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    raw = `https://${raw.replace(/^\/+/, '')}`;
  }
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

export function isValidStartUrl(input: string): boolean {
  return normalizeStartUrl(input) !== null;
}

export async function startWebsiteCrawl(opts: {
  startUrl: string;
  pattern?: string;
  maxPages?: number;
  maxDepth?: number;
  sameOriginOnly?: boolean;
  useSitemap?: boolean;
  respectRobots?: boolean;
  smartColon?: boolean;
  mineScripts?: boolean;
  discoverFeeds?: boolean;
  stripTracking?: boolean;
  retryFetch?: boolean;
  concurrency?: number;
  delayMs?: number;
}): Promise<string> {
  const res = await sessionFetch('/api/xml-scraper/crawl', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Crawl failed to start');
  return data.jobId;
}

export async function cancelCrawlJob(jobId: string): Promise<void> {
  const res = await sessionFetch(`/api/xml-scraper/jobs/${jobId}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Cancel failed');
}

export type PollCrawlOptions = { signal?: AbortSignal };

export async function pollCrawlJob(
  jobId: string,
  onUpdate: (job: CrawlJob) => void,
  intervalMs = 700,
  options?: PollCrawlOptions,
): Promise<CrawlJob> {
  return new Promise((resolve, reject) => {
    let delay = Math.max(400, intervalMs);
    let lastPages = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onAbort = () => {
      finish(() => reject(new DOMException('Aborted', 'AbortError')));
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
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

    const schedule = () => {
      timer = setTimeout(() => { void tick(); }, delay);
    };

    const tick = async () => {
      if (document.hidden || options?.signal?.aborted) return;
      try {
        const res = await sessionFetch(`/api/xml-scraper/jobs/${jobId}`);
        if (!res.ok) throw new Error('Job not found');
        const job = (await res.json()) as CrawlJob;
        onUpdate(job);
        if (job.status === 'done' || job.status === 'cancelled') {
          finish(() => resolve(job));
          return;
        }
        if (job.status === 'error') {
          finish(() => reject(new Error(job.error ?? 'Crawl failed')));
          return;
        }

        const pages = job.progress.pagesCrawled;
        if (pages === lastPages) {
          delay = Math.min(2000, delay + 200);
        } else {
          delay = Math.max(400, Math.min(intervalMs, delay - 100));
          lastPages = pages;
        }
        schedule();
      } catch (e) {
        if (options?.signal?.aborted) return;
        finish(() => reject(e));
      }
    };

    const onVis = () => { if (!document.hidden) void tick(); };

    void tick();
    document.addEventListener('visibilitychange', onVis);
  });
}

export function exportColonValuesOnly(atlas: ColonAtlasEntry[]): string {
  return atlas.map((e) => e.value).join('\n');
}

export type ColonDbEntry = {
  id: string;
  U: string;
  P: string;
  Website: string;
  sourceValue?: string;
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  seenCount: number;
};

export type ColonDbSaveResult = {
  ok: boolean;
  added: number;
  updated: number;
  skipped: number;
  total: number;
};

export type ColonDbStats = {
  total: number;
  updatedAt: string | null;
  websites: number;
  byWebsite: Record<string, number>;
};

export async function saveColonAtlasToDatabase(
  atlas: ColonAtlasEntry[],
  siteName?: string,
): Promise<ColonDbSaveResult> {
  const res = await sessionFetch('/api/xml-scraper/save-to-db', {
    method: 'POST',
    body: JSON.stringify({ source: 'atlas', atlas, siteName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save to database failed');
  return data;
}

export async function saveXmlMatchesToDatabase(
  matches: XmlLinkMatch[],
  website?: string,
): Promise<ColonDbSaveResult> {
  const res = await sessionFetch('/api/xml-scraper/save-to-db', {
    method: 'POST',
    body: JSON.stringify({ source: 'xml', matches, website, fileName: website }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save to database failed');
  return data;
}

export async function fetchColonDbStats(): Promise<ColonDbStats> {
  const res = await sessionFetch('/api/xml-scraper/colon-db/stats');
  if (!res.ok) throw new Error('Failed to load database stats');
  return res.json();
}

export function exportColonAtlasTxt(atlas: ColonAtlasEntry[]): string {
  return atlas.map((e) => {
    const pages = e.pages.map((p) => p.url).join(' | ');
    return `${e.value}\t[${e.scheme}] @ ${pages}`;
  }).join('\n');
}

export function exportColonAtlasCsv(atlas: ColonAtlasEntry[]): string {
  const rows = atlas.flatMap((e) =>
    e.pages.map((p) =>
      [e.value, e.scheme, String(e.hitCount), p.url, p.title, String(p.depth)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    ),
  );
  return ['value,scheme,hitCount,pageUrl,pageTitle,depth', ...rows].join('\n');
}

export async function scanXmlLinks(opts: {
  xml: string;
  pattern?: string;
  mode?: 'smart' | 'urls' | 'raw';
}): Promise<XmlScanResult> {
  const res = await sessionFetch('/api/xml-scraper/scan', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Scan failed');
  return data;
}

export function exportMatchesTxt(matches: XmlLinkMatch[]): string {
  return matches.map((m) => m.value).join('\n');
}

export function exportMatchesCsv(matches: XmlLinkMatch[]): string {
  const header = 'value,path,source,attribute,line';
  const rows = matches.map((m) =>
    [m.value, m.path, m.source, m.attribute ?? '', String(m.line)]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export function exportMatchesJson(result: XmlScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}