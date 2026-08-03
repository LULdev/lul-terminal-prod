#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Optional CLI for auth bootstrap (the server already auto-bootstraps on start).
 *
 *   node scripts/seed-auth-database.mjs          # bootstrap if empty
 *   node scripts/seed-auth-database.mjs --reset  # wipe + re-bootstrap
 */

import '../server/loadEnv.mjs';
import { resetAuthDatabase, seedDefaultUsersIfEmpty } from '../server/auth/authStore.mjs';

const reset = process.argv.includes('--reset');

if (reset) {
  await resetAuthDatabase();
  console.log('Auth database reset and bootstrapped (admin + bot only).');
  console.log('Credentials: data/auth/admin-credentials.json');
} else {
  await seedDefaultUsersIfEmpty();
  console.log('Auth bootstrap complete (skipped if users already exist).');
  console.log('Credentials (first run only): data/auth/admin-credentials.json');
}
