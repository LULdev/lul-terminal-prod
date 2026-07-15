/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { isTrustProxyEnabled } from './loadEnv.mjs';
import { bootstrapApplication } from './bootstrap.mjs';
import { createServerMiddleware } from './serverMiddleware.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');
const port = Number(process.env.PORT) || 3000;

async function main() {
  // Self-configure data dirs, secrets, and admin account before serving traffic.
  await bootstrapApplication();

  const app = express();
  if (isTrustProxyEnabled()) {
    app.set('trust proxy', 1);
  }
  app.use(createServerMiddleware());
  app.use(express.static(dist));

  app.get('/i/:id', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });

  app.get('/p/:id', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });

  app.get('/profile/:username', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'lul-terminal', ts: Date.now() });
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/hosting/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`LUL Terminal → http://localhost:${port}`);
    console.log('[ready] Admin credentials (first run): data/auth/admin-credentials.json');
  });
}

main().catch((err) => {
  console.error('[fatal] Failed to start LUL Terminal', err);
  process.exit(1);
});
