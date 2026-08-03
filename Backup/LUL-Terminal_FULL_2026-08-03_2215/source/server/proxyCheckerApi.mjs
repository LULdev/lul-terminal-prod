/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { attachAuth, requireRole } from './auth/authApi.mjs';
import { canAccessAdmin } from './auth/permissions.mjs';
import { loadScrapePool } from './proxyScraperStore.mjs';
import { upsertCheckedProxies } from './proxyDatabaseService.mjs';
import {
  checkProxiesExtendedBatch,
  dedupeForCheck,
  normalizeProxiesForCheck,
  parseProxyInput,
  summarizeCheck,
  TEST_URL_PRESETS,
} from './proxyCheckerEngine.mjs';
import {
  loadCheckerResults,
  loadCheckerState,
  saveCheckerResults,
  saveCheckerState,
} from './proxyCheckerStore.mjs';
import { checkRateLimit, clientIp, isRateLimitError } from './rateLimit.mjs';
import { pruneJobMap } from './jobPrune.mjs';
import { assertSafeFetchUrlAsync } from './assertSafeFetchUrl.mjs';
import { wrapAsyncHandler } from './asyncMiddleware.mjs';

const jobs = new Map();

function attachJobControl(job) {
  const control = { cancelled: false };
  job.control = control;
  return control;
}

async function requireAdmin(req) {
  await attachAuth(req);
  return requireRole(req, canAccessAdmin);
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalizeConcurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 60;
  return Math.min(Math.max(Math.round(n), 1), 500);
}

function normalizeTimeout(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5000;
  return Math.min(Math.max(Math.round(n), 1000), 60000);
}

export async function handleProxyCheckerRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    await requireAdmin(req);

    if (req.method === 'GET' && pathname === '/api/proxy-checker/presets') {
      await checkRateLimit(`proxy-checker:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      return sendJson(res, 200, { testUrls: TEST_URL_PRESETS });
    }

    if (req.method === 'GET' && pathname === '/api/proxy-checker/stats') {
      await checkRateLimit(`proxy-checker:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      const state = await loadCheckerState();
      return sendJson(res, 200, state);
    }

    if (req.method === 'GET' && pathname === '/api/proxy-checker/results') {
      await checkRateLimit(`proxy-checker:${clientIp(req)}`, { max: 90, windowMs: 60_000 });
      const data = await loadCheckerResults();
      const state = await loadCheckerState();
      return sendJson(res, 200, { ...data, stats: state });
    }

    const jobMatch = pathname.match(/^\/api\/proxy-checker\/jobs\/([a-f0-9]+)$/);
    if (jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: 'Job not found' });

      if (req.method === 'GET') {
        await checkRateLimit(`proxy-checker-job:${clientIp(req)}`, { max: 120, windowMs: 60_000 });
        return sendJson(res, 200, job);
      }

      if (req.method === 'DELETE') {
        await checkRateLimit(`proxy-checker-act:${req.auth.user.id}`, { max: 30, windowMs: 60_000 });
        if (job.control) job.control.cancelled = true;
        job.status = 'cancelled';
        job.message = 'Check cancelled';
        return sendJson(res, 200, { ok: true, id: job.id });
      }
    }

    if (req.method === 'POST' && pathname === '/api/proxy-checker/check') {
      await checkRateLimit(`proxy-checker-spawn:${req.auth.user.id}`, { max: 5, windowMs: 60_000 });
      const body = await readJsonBody(req);
      const jobId = crypto.randomBytes(8).toString('hex');
      const job = {
        id: jobId,
        type: 'check',
        status: 'running',
        progress: 0,
        total: 0,
        message: 'Checker starting…',
        logs: [],
        result: null,
        error: null,
        startedAt: Date.now(),
        etaMs: null,
        alive: 0,
        recovered: 0,
        control: null,
      };
      pruneJobMap(jobs);
      jobs.set(jobId, job);
      const control = attachJobControl(job);

      (async () => {
        try {
          let rawProxies = [];
          if (body.proxies?.length) {
            rawProxies = body.proxies;
          } else if (body.text?.trim()) {
            rawProxies = parseProxyInput(body.text, body.defaultType ?? 'http');
          } else if (body.useScraped !== false) {
            const pool = await loadScrapePool();
            rawProxies = pool.proxies ?? [];
          }

          if (!rawProxies.length) {
            throw new Error('No proxies to check — use paste, list or scrape pool');
          }

          const defaultType = body.defaultType ?? 'http';
          const beforeNormalize = rawProxies.length;
          rawProxies = normalizeProxiesForCheck(rawProxies, defaultType);
          if (!rawProxies.length) {
            throw new Error('No valid proxies after format normalization (expected: ip:port)');
          }

          const autoDetectType = body.autoDetectType !== false;
          const { proxies, before, removed } = dedupeForCheck(rawProxies, { autoDetectType });
          const timeoutMs = normalizeTimeout(body.timeoutMs);
          const concurrency = normalizeConcurrency(body.concurrency);
          const testUrl = await assertSafeFetchUrlAsync(body.testUrl ?? TEST_URL_PRESETS.google);
          const httpsTestUrl = await assertSafeFetchUrlAsync(body.httpsTestUrl ?? 'https://www.google.com/generate_204');
          const detectAnonymity = body.detectAnonymity !== false;
          const testHttps = body.testHttps !== false;
          const retries = Math.min(Math.max(Number(body.retries) ?? 1, 0), 3);
          const retryDelayMs = Math.min(Math.max(Number(body.retryDelayMs) ?? 500, 100), 3000);
          const limit = Number(body.limit) > 0 ? Number(body.limit) : 0;

          job.total = limit > 0 ? Math.min(proxies.length, limit) : proxies.length;
          if (removed > 0) {
            job.logs.push(`Dedup: ${before.toLocaleString('en-US')} → ${proxies.length.toLocaleString('en-US')} (−${removed})`);
          }
          if (beforeNormalize !== rawProxies.length) {
            job.logs.push(`Format: ${beforeNormalize.toLocaleString('en-US')} → ${rawProxies.length.toLocaleString('en-US')} (ip:port, duplicates removed)`);
          } else {
            job.logs.push(`Format: all ${rawProxies.length.toLocaleString('en-US')} entries → ip:port normalized`);
          }
          job.logs.push(
            autoDetectType
              ? `Auto type detection active (SOCKS4/5 · HTTP · HTTPS) — ${job.total.toLocaleString('en-US')} endpoints`
              : `Checking ${job.total.toLocaleString('en-US')} proxies (fixed protocol)`,
          );
          if (retries > 0) {
            job.logs.push(`Retry: up to ${retries}× on timeout/reset (${retryDelayMs}ms base delay)`);
          }

          const batch = await checkProxiesExtendedBatch(proxies, {
            limit,
            timeoutMs,
            concurrency,
            testUrl,
            httpsTestUrl,
            detectAnonymity,
            testHttps,
            autoDetectType,
            detectExitIp: body.detectExitIp !== false,
            retries,
            retryDelayMs,
            shouldCancel: () => control.cancelled,
          }, (p) => {
            job.progress = p.done;
            const elapsed = Date.now() - (job.startedAt ?? Date.now());
            if (p.done > 0 && elapsed > 500) {
              job.etaMs = Math.round(((p.total - p.done) / p.done) * elapsed);
            }
            if (p.last?.alive && job.logs.length < 120) {
              const tag = p.last.typeCorrected ? ' · auto' : p.last.typeDetected ? ' · detected' : '';
              const retryTag = p.last.recovered ? ' · retry✓' : '';
              const ipTag = p.last.exitIp ? ` · ${p.last.exitIp}` : '';
              job.logs.push(`✓ ${p.last.raw} [${p.last.type}] (${p.last.latency}ms · ${p.last.latencyGrade ?? '?'} · ${p.last.anonymity ?? '?'}${ipTag}${tag}${retryTag})`);
            }
            job.message = `Check ${p.done}/${p.total} — ${p.alive ?? 0} working${p.recovered ? ` · ${p.recovered} retry-ok` : ''}${job.etaMs ? ` · ~${Math.ceil(job.etaMs / 1000)}s` : ''}`;
            job.alive = p.alive ?? 0;
            job.recovered = p.recovered ?? 0;
          });

          const checked = (batch.results ?? []).filter(Boolean);
          if (batch.cancelled) {
            job.status = 'cancelled';
            job.message = `Cancelled — ${checked.length} of ${job.total} checked, ${checked.filter((p) => p.alive).length} working`;
            if (checked.length) {
              const summary = summarizeCheck(checked, { before, removed });
              const database = await upsertCheckedProxies(checked.filter((p) => p.alive));
              await saveCheckerResults({ checked, summary, checkedAt: Date.now(), database, partial: true });
              job.result = { ...summary, checked, database, partial: true };
            }
            return;
          }

          const summary = summarizeCheck(checked, { before, removed });
          const database = await upsertCheckedProxies(checked);

          if (summary.typesDetected) {
            job.logs.push(`Type detection: ${summary.typesDetected} detected${summary.typesCorrected ? ` · ${summary.typesCorrected} corrected` : ''}`);
          }
          if (summary.recovered) {
            job.logs.push(`Retry recovery: ${summary.recovered} proxies working after retry`);
          }
          if (summary.latencyGrades) {
            job.logs.push(`Latency: ${summary.latencyGrades.fast} fast · ${summary.latencyGrades.medium} medium · ${summary.latencyGrades.slow} slow`);
          }
          if (summary.errorCategories) {
            const ec = summary.errorCategories;
            const parts = [];
            if (ec.timeout) parts.push(`${ec.timeout} timeout`);
            if (ec.connection) parts.push(`${ec.connection} connection`);
            if (ec.dns) parts.push(`${ec.dns} dns`);
            if (parts.length) job.logs.push(`Errors: ${parts.join(' · ')}`);
          }
          job.logs.push(`DB: +${database.added} new · ${database.updated} updated · ${database.skipped} skipped (by column: HTTP/HTTPS/SOCKS4/SOCKS5)`);

          const state = {
            lastCheckAt: Date.now(),
            totalChecked: checked.length,
            ...summary,
            databaseAdded: database.added,
            databaseUpdated: database.updated,
          };
          await saveCheckerState(state);
          await saveCheckerResults({ checked, summary, checkedAt: Date.now(), database });

          job.status = 'done';
          job.finishedAt = Date.now();
          job.message = `${summary.alive} alive / ${checked.length} checked → DB +${database.added} · ~${database.updated} updated`;
          job.result = { ...summary, checked, database };
        } catch (e) {
          job.status = 'error';
          job.finishedAt = Date.now();
          job.error = e instanceof Error ? e.message : 'Check failed';
        }
      })();

      return sendJson(res, 202, { jobId });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    if (isRateLimitError(e)) return sendJson(res, 429, { error: 'Too many requests' });
    const msg = e instanceof Error ? e.message : 'Server error';
    const status =
      e instanceof SyntaxError ? 400
        : msg === 'Permission denied' ? 403
        : msg === 'Not logged in' ? 401
        : 500;
    return sendJson(res, status, { error: msg });
  }
}

export function createProxyCheckerMiddleware() {
  return wrapAsyncHandler((req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/proxy-checker')) {
      return handleProxyCheckerRequest(req, res);
    }
    next();
  });
}