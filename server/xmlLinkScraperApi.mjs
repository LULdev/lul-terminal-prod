/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { attachAuth, requireRole } from './auth/authApi.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { PATTERN_PRESETS, scanXmlLinks } from './xmlLinkScraperEngine.mjs';
import { CRAWL_PRESETS, WEBSITE_SCRAPER_FEATURES, crawlWebsite } from './websiteScraperEngine.mjs';
import { SCRAPER_SKILLS } from './websiteScraperSkills.mjs';
import {
  getColonDbStats,
  listColonDbEntries,
  saveAtlasToDatabase,
  saveXmlMatchesToDatabase,
} from './colonScraperDatabaseService.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { pruneJobMap } from './jobPrune.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';

const MAX_XML_BYTES = 10 * 1024 * 1024;
const crawlJobs = new Map();

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = MAX_XML_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Payload too large (max 10 MB)');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function requireAdmin(req) {
  await attachAuth(req);
  return requireRole(req, canAccessAdmin);
}

function runCrawlJob(jobId, startUrl, options) {
  const job = crawlJobs.get(jobId);
  if (!job) return;

  crawlWebsite(startUrl, { ...options, signal: job.abort.signal }, (progress) => {
    if (job.status === 'cancelled') return;
    job.progress = progress;
    job.message = progress.message ?? job.message;
    if (progress.currentUrl) job.logs.push(`→ ${progress.currentUrl}`);
    if (job.logs.length > 80) job.logs = job.logs.slice(-80);
  })
    .then((result) => {
      const wasStopped = job.status === 'cancelled' || result.stats?.cancelled;
      if (wasStopped) {
        job.status = 'cancelled';
        job.result = result;
        job.message = `Stopped — ${result.stats.uniqueColons} unique colon tokens on ${result.stats.pagesCrawled} pages (partial)`;
      } else {
        job.status = 'done';
        job.finishedAt = Date.now();
        job.message = `Complete — ${result.stats.uniqueColons} unique colon tokens on ${result.stats.pagesCrawled} pages`;
        job.result = result;
      }
      job.progress = {
        pagesCrawled: result.stats.pagesCrawled,
        queueSize: result.stats.queueRemaining ?? 0,
        colonHits: result.stats.colonHits,
        maxPages: options.maxPages ?? 80,
      };
    })
    .catch((err) => {
      if (job.status === 'cancelled') return;
      const msg = err instanceof Error ? err.message : 'Crawl failed';
      job.status = 'error';
      job.finishedAt = Date.now();
      job.error = msg;
      job.message = msg;
    });
}

export async function handleXmlLinkScraperRequest(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  try {
    await requireAdmin(req);

    if (req.method === 'GET' && pathname === '/api/xml-scraper/presets') {
      await checkRateLimit(`xml-scraper:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      return sendJson(res, 200, {
        presets: PATTERN_PRESETS,
        websiteFeatures: WEBSITE_SCRAPER_FEATURES,
        scraperSkills: SCRAPER_SKILLS,
        crawlPresets: CRAWL_PRESETS,
      });
    }

    const jobMatch = pathname.match(/^\/api\/xml-scraper\/jobs\/([a-zA-Z0-9_-]+)$/);
    if (req.method === 'GET' && jobMatch) {
      await checkRateLimit(`xml-scraper-job:${clientIp(req)}`, { max: 120, windowMs: 60_000 });
      const job = crawlJobs.get(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: 'Job not found' });
      return sendJson(res, 200, {
        id: job.id,
        status: job.status,
        message: job.message,
        progress: job.progress,
        logs: job.logs,
        result: job.result,
        error: job.error,
      });
    }

    if (req.method === 'POST' && jobMatch) {
      await checkRateLimit(`xml-scraper-act:${req.auth?.user?.id ?? clientIp(req)}`, { max: 30, windowMs: 60_000 });
      const job = crawlJobs.get(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: 'Job not found' });
      if (job.status !== 'running') return sendJson(res, 400, { error: 'Job is not running' });
      job.status = 'cancelled';
      job.message = 'Stopping crawl…';
      job.abort.abort();
      return sendJson(res, 200, { ok: true, status: 'cancelled' });
    }

    const adminActKey = `xml-scraper-act:${req.auth?.user?.id ?? clientIp(req)}`;

    if (req.method === 'POST' && pathname === '/api/xml-scraper/scan') {
      await checkRateLimit(adminActKey, { max: 30, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const xml = String(body.xml ?? '');
      const pattern = String(body.pattern ?? '*:*');
      const mode = ['smart', 'urls', 'raw'].includes(body.mode) ? body.mode : 'smart';
      const result = scanXmlLinks({ xml, pattern, mode });
      return sendJson(res, 200, result);
    }

    if (req.method === 'GET' && pathname === '/api/xml-scraper/colon-db/stats') {
      await checkRateLimit(`xml-scraper:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      return sendJson(res, 200, await getColonDbStats());
    }

    if (req.method === 'GET' && pathname === '/api/xml-scraper/colon-db/entries') {
      await checkRateLimit(`xml-scraper:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      const url = new URL(req.url, 'http://localhost');
      const { entries, total } = await listColonDbEntries({
        limit: Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100)),
        website: url.searchParams.get('website') ?? undefined,
        q: url.searchParams.get('q') ?? undefined,
      });
      return sendJson(res, 200, { entries, total });
    }

    if (req.method === 'POST' && pathname === '/api/xml-scraper/save-to-db') {
      await checkRateLimit(adminActKey, { max: 20, windowMs: 60_000 });
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      const source = body.source === 'xml' ? 'xml' : 'atlas';

      if (source === 'xml') {
        const matches = Array.isArray(body.matches) ? body.matches : [];
        const website = String(body.website ?? body.fileName ?? 'xml-scan').trim() || 'xml-scan';
        const result = await saveXmlMatchesToDatabase(matches, website);
        return sendJson(res, 200, { ok: true, ...result });
      }

      const atlas = Array.isArray(body.atlas) ? body.atlas : [];
      const fallbackWebsite = String(body.siteName ?? body.website ?? '').trim();
      const result = await saveAtlasToDatabase(atlas, fallbackWebsite);
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (req.method === 'POST' && pathname === '/api/xml-scraper/crawl') {
      await checkRateLimit(adminActKey, { max: 5, windowMs: 60_000 });
      const body = await readJsonBody(req, 64 * 1024);
      const startUrl = String(body.startUrl ?? '').trim();
      if (!startUrl) throw new Error('startUrl is required');

      const jobId = crypto.randomBytes(8).toString('hex');
      const options = {
        pattern: String(body.pattern ?? '*:*'),
        maxPages: Number(body.maxPages) || 80,
        maxDepth: Number(body.maxDepth) || 4,
        sameOriginOnly: body.sameOriginOnly !== false,
        useSitemap: body.useSitemap !== false,
        respectRobots: Boolean(body.respectRobots),
        smartColon: body.smartColon !== false,
        mineScripts: body.mineScripts !== false,
        discoverFeeds: body.discoverFeeds !== false,
        stripTracking: body.stripTracking !== false,
        retryFetch: body.retryFetch !== false,
        concurrency: Number(body.concurrency) || 3,
        delayMs: Number(body.delayMs) || 120,
      };

      pruneJobMap(crawlJobs);
      crawlJobs.set(jobId, {
        id: jobId,
        status: 'running',
        message: 'Crawl queued…',
        progress: { pagesCrawled: 0, queueSize: 0, colonHits: 0, maxPages: options.maxPages },
        logs: [],
        result: null,
        error: null,
        abort: new AbortController(),
        createdAt: new Date().toISOString(),
      });

      setImmediate(() => runCrawlJob(jobId, startUrl, options));

      return sendJson(res, 202, { jobId });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    if (isRateLimitError(err)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = err instanceof Error ? err.message : 'Server error';
    const status = msg === 'Permission denied' ? 403
      : msg === 'Not logged in' ? 401
        : msg.includes('too large') ? 413
          : 400;
    return sendJson(res, status, { error: msg });
  }
}

export function createXmlLinkScraperMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/xml-scraper')) {
      return handleXmlLinkScraperRequest(req, res);
    }
    next();
  });
}