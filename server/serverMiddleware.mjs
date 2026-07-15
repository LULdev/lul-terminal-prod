/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createAuthMiddleware } from './auth/authApi.mjs';
import { createChatMiddleware } from './chatApi.mjs';
import { createImageHostMiddleware } from './imageHostApi.mjs';
import { createPremiumAccountsMiddleware } from './premiumAccountsApi.mjs';
import { createProxyDatabaseMiddleware } from './proxyDatabaseApi.mjs';
import { createPersonaDatabaseMiddleware } from './personaDatabaseApi.mjs';
import { createPostViewsMiddleware } from './postViewsApi.mjs';
import { createNewsMiddleware } from './newsApi.mjs';
import { createProxyScraperMiddleware } from './proxyScraperApi.mjs';
import { createProxyCheckerMiddleware } from './proxyCheckerApi.mjs';
import { createAnalyticsMiddleware } from './analyticsApi.mjs';
import { createAccessControlMiddleware } from './accessControlApi.mjs';
import { createTerminalStatsMiddleware } from './terminalStatsApi.mjs';
import { createLeaderboardMiddleware } from './leaderboardApi.mjs';
import { createPasteMiddleware } from './pasteApi.mjs';
import { createPageViewsMiddleware } from './pageViewsApi.mjs';
import { createXmlLinkScraperMiddleware } from './xmlLinkScraperApi.mjs';
import { createAdminMiddleware } from './adminApi.mjs';
import { createStatusMiddleware } from './statusApi.mjs';
import { createGamesMiddleware } from './gamesApi.mjs';
import { refundAllEscrowsOnBoot } from './gamesEscrow.mjs';
import { startMatchExpirySweep } from './gamesExpirySweep.mjs';
import { startRegistrationChallengePurge } from './auth/registrationChallenge.mjs';
import { startLeaderboardSyncScheduler } from './leaderboardService.mjs';
import { startProxyDatabaseScheduler } from './proxyDatabaseScheduler.mjs';

let schedulerStarted = false;
let gamesBootstrapped = false;

export function createServerMiddleware() {
  if (!schedulerStarted) {
    schedulerStarted = true;
    startProxyDatabaseScheduler();
    startLeaderboardSyncScheduler();
    startRegistrationChallengePurge();
  }
  if (!gamesBootstrapped) {
    gamesBootstrapped = true;
    void (async () => {
      try {
        const n = await refundAllEscrowsOnBoot();
        if (n > 0) console.log(`[games] Refunded ${n} escrow(s) after restart`);
      } catch (e) {
        console.error('[games] Boot escrow refund failed', e);
      }
      startMatchExpirySweep();
    })();
  }

  const imageHost = createImageHostMiddleware();
  const premiumAccounts = createPremiumAccountsMiddleware();
  const proxyScraper = createProxyScraperMiddleware();
  const proxyChecker = createProxyCheckerMiddleware();
  const proxyDatabase = createProxyDatabaseMiddleware();
  const personaDatabase = createPersonaDatabaseMiddleware();
  const auth = createAuthMiddleware();
  const chat = createChatMiddleware();
  const postViews = createPostViewsMiddleware();
  const news = createNewsMiddleware();
  const analytics = createAnalyticsMiddleware();
  const accessControl = createAccessControlMiddleware();
  const terminalStats = createTerminalStatsMiddleware();
  const leaderboards = createLeaderboardMiddleware();
  const paste = createPasteMiddleware();
  const pageViews = createPageViewsMiddleware();
  const xmlLinkScraper = createXmlLinkScraperMiddleware();
  const admin = createAdminMiddleware();
  const status = createStatusMiddleware();
  const games = createGamesMiddleware();

  return (req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname.startsWith('/api/chat')) {
      chat(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/auth')) {
      auth(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/persona-db')) {
      personaDatabase(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/premium-accounts')) {
      premiumAccounts(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/proxy-db')) {
      proxyDatabase(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/proxy-checker')) {
      proxyChecker(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/proxy')) {
      proxyScraper(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/images') || pathname.startsWith('/hosting/')) {
      imageHost(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/post-views')) {
      postViews(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/news')) {
      news(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/analytics')) {
      analytics(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/access-control')) {
      accessControl(req, res, next);
      return;
    }
    if (pathname === '/api/terminal-stats') {
      terminalStats(req, res, next);
      return;
    }
    if (pathname === '/api/status') {
      status(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/games')) {
      games(req, res, next);
      return;
    }
    if (pathname === '/api/leaderboards') {
      leaderboards(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/paste')) {
      paste(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/page-views')) {
      pageViews(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/xml-scraper')) {
      xmlLinkScraper(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/admin/')) {
      admin(req, res, next);
      return;
    }
    next();
  };
}