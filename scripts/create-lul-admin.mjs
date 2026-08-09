#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Create (or update) the LUL admin account in data/auth/lul-auth.sqlite.
 *
 * Ubuntu one-liner (from repo root):
 *   node scripts/create-lul-admin.mjs
 *   bash scripts/one-liners.sh create-lul-admin
 *
 * Env overrides (optional):
 *   LUL_ADMIN_USERNAME   default: LUL
 *   LUL_ADMIN_EMAIL      default: lul@lul.terminal
 *   LUL_ADMIN_PASSWORD   default: Fuggbush1
 *   LUL_ADMIN_ROLE       default: admin
 *   LUL_ADMIN_DISPLAY    default: LUL
 */

import '../server/loadEnv.mjs';
import { createUserAdmin, listUsers, updateUserAdmin } from '../server/auth/adminService.mjs';

function normalizeUsername(username) {
  return String(username ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

const usernameRaw = process.env.LUL_ADMIN_USERNAME || 'LUL';
const username = normalizeUsername(usernameRaw);
const email = String(process.env.LUL_ADMIN_EMAIL || 'lul@lul.terminal')
  .trim()
  .toLowerCase();
const password = String(process.env.LUL_ADMIN_PASSWORD || 'Fuggbush1');
const role = String(process.env.LUL_ADMIN_ROLE || 'admin').trim().toLowerCase();
const displayName = String(process.env.LUL_ADMIN_DISPLAY || 'LUL').trim() || username;

if (!username) {
  console.error('[err] Invalid username');
  process.exit(1);
}
if (!email.includes('@')) {
  console.error('[err] Invalid email');
  process.exit(1);
}
if (password.length < 6) {
  console.error('[err] Password min. 6 characters');
  process.exit(1);
}

const { users } = await listUsers({ search: username });
const existing =
  users.find((u) => String(u.username).toLowerCase() === username) ||
  users.find((u) => String(u.email).toLowerCase() === email);

if (existing) {
  const updated = await updateUserAdmin(existing.id, {
    password,
    role,
    active: true,
    verified: true,
    displayName,
    email,
    username: usernameRaw,
  });
  console.log('[ok] Updated existing account');
  console.log(
    JSON.stringify(
      {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        active: updated.active,
        verified: updated.verified,
        displayName: updated.displayName,
      },
      null,
      2,
    ),
  );
} else {
  const created = await createUserAdmin({
    username: usernameRaw,
    email,
    password,
    role,
    displayName,
    verified: true,
    active: true,
  });
  console.log('[ok] Created admin account');
  console.log(
    JSON.stringify(
      {
        id: created.id,
        username: created.username,
        email: created.email,
        role: created.role,
        active: created.active,
        verified: created.verified,
        displayName: created.displayName,
      },
      null,
      2,
    ),
  );
}

console.log('');
console.log('Login: username=%s  (or email %s)', username, email);
console.log('Password was set from LUL_ADMIN_PASSWORD (or default). Change after first login if shared.');
