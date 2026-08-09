/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Print ops quickstart (cross-platform).
 */
console.log(`
LUL Terminal — ops quickstart (v3.49.0+)
========================================

Full runbook:  docs/RUNBOOK.md
Production:    docs/PRODUCTION.md
Full backup:   Backup/README.md

One-liners (pick your shell):
  Linux/macOS:   bash scripts/one-liners.sh help
  Windows PS:    .\\scripts\\one-liners.ps1 help

npm shortcuts:
  npm run ops:doctor
  npm run ops:setup
  npm run ops:deploy
  npm run ops:backup
  npm run ops:health
  npm run ops:create-lul-admin   # create/update LUL admin on this host

Canonical prod update:
  git pull && npm ci && npm run build && pm2 restart lul-terminal

Create LUL admin (Ubuntu, from repo root):
  node scripts/create-lul-admin.mjs
  # or: bash scripts/one-liners.sh create-lul-admin
  # password override: LUL_ADMIN_PASSWORD='…' node scripts/create-lul-admin.mjs

First install:
  npm run ops:setup
  npm start
  # login → change admin password (data/auth/admin-credentials.json)
`);
