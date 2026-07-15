/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import './loadEnv.mjs';
import { createServerMiddleware } from './serverMiddleware.mjs';
import { bootstrapApplication } from './bootstrap.mjs';

export function viteImageHostPlugin() {
  return {
    name: 'lul-server-api',
    async configureServer(server) {
      try {
        await bootstrapApplication();
      } catch (err) {
        console.error('[bootstrap] Dev server bootstrap failed', err);
      }
      server.middlewares.use(createServerMiddleware());
    },
  };
}
