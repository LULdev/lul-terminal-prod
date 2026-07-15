# Production Deployment Guide

## Overview

LUL Terminal is a single Node.js process that serves:

- REST API under `/api/*`
- Built React SPA from `dist/`
- Image host under `/hosting/*` (and related routes)

Persistent state lives under `data/` (SQLite auth DB + JSON file stores). No external database is required.

## Recommended topology

```
Internet → reverse proxy (nginx/Caddy) HTTPS → Node on :3000
                                              └── volume: ./data
```

Optional Redis (shared rate limits / multi-instance):

```
docker compose --profile with-redis up -d --build
REDIS_URL=redis://redis:6379
```

## Environment checklist

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV=production` | Yes | Secure cookies and production paths |
| `TRUST_PROXY=1` | Yes (behind proxy) | Real client IPs for rate limits |
| `PUBLIC_BASE_URL` | Recommended | Canonical HTTPS URL |
| `ALLOWED_PUBLIC_HOSTS` | Recommended | Host allow-list for forwarded Host |
| `SEED_ADMIN_PASSWORD` | Optional | Only used on **first** empty DB |
| `PREMIUM_VAULT_KEY` | Recommended | Else auto-generated under `data/secrets/` |

## First-run bootstrap

On every process start the server runs `bootstrapApplication()`:

1. Creates `data/*` directories
2. Ensures premium vault key (env or generated file)
3. Initializes SQLite auth schema
4. If **no users** exist: creates `Administrator` + system `bot`
5. Writes admin credentials to `data/auth/admin-credentials.json`

No manual seed step is required for a clean deploy.

## Hardening

1. Change the admin password after first login.
2. Delete or relocate `data/auth/admin-credentials.json` after storing the password in a secrets manager.
3. Never commit `.env`, `data/`, or credential files.
4. Terminate TLS at the reverse proxy; set `TRUST_PROXY=1` and `PUBLIC_BASE_URL=https://…`.
5. Restrict outbound network if you do not need proxy scraper / external fetch features.
6. Schedule backups of the entire `data/` directory.
7. Prefer a dedicated OS user and systemd/PM2/Docker restart policies.

## Backup & restore

```bash
# Backup
tar -czf lul-data-$(date +%F).tar.gz data/

# Restore (stop app first)
tar -xzf lul-data-YYYY-MM-DD.tar.gz
```

## Updates

```bash
git pull
npm install
npm run build
# Docker:
docker compose up -d --build
# PM2:
pm2 restart lul-terminal
```

Auth and content data survive updates when `data/` is preserved (Docker volume or host path).
