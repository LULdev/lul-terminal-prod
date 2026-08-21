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
import { createBypassMiddleware } from './bypassApi.mjs';
import { ensureGamesBootstrapped, isGamesBootReady } from './gamesBoot.mjs';
import { startRegistrationChallengePurge } from './auth/registrationChallenge.mjs';
import { startLeaderboardSyncScheduler } from './leaderboardService.mjs';
import { startProxyDatabaseScheduler } from './proxyDatabaseScheduler.mjs';

let schedulerStarted = false;

export function createServerMiddleware() {
  if (!schedulerStarted) {
    schedulerStarted = true;
    startProxyDatabaseScheduler();
    startLeaderboardSyncScheduler();
    startRegistrationChallengePurge();
    // Kick boot (awaited in start.mjs before listen; vite may race so also gate games)
    void ensureGamesBootstrapped();
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
  const bypass = createBypassMiddleware();

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
    if (pathname.startsWith('/api/bypass')) {
      bypass(req, res, next);
      return;
    }
    if (pathname.startsWith('/api/games')) {
      // Vite/dev can hit games before boot await; block until escrow refund finishes
      if (!isGamesBootReady()) {
        void ensureGamesBootstrapped().then(() => games(req, res, next)).catch((err) => {
          console.error('[games] boot gate failed', err);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Arcade starting up — retry shortly' }));
        });
        return;
      }
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