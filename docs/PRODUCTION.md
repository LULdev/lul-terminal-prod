# Production Deployment Guide

> **Full ops runbook (setup, one-liners, multi-worker, troubleshooting):**  
> **[docs/RUNBOOK.md](./RUNBOOK.md)**  
> Comfort scripts: `bash scripts/one-liners.sh help` · `.\scripts\one-liners.ps1 help` · `npm run ops`

## Overview

LUL Terminal is a single Node.js process that serves:

- REST API under `/api/*`
- Built React SPA from `dist/`
- Image host under `/hosting/*` (and related routes)

Persistent state lives under `data/` (SQLite auth DB + JSON file stores). No external database is required.

**Version 3.49.0+** adds cross-process locks for auth users/sessions and view counters, two-phase jackpot settlement, and IP-pinned SSRF-safe fetch. Prefer **one PM2 instance** still; multi-worker is safer but Redis is recommended for rate-limit/dedup.

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
| `PREMIUM_VAULT_KEY` | Recommended | Else auto-generated under `data/secrets/` — **back this up** |

## First-run bootstrap

On every process start the server runs `bootstrapApplication()`:

1. Creates `data/*` directories
2. Ensures premium vault key (env or generated file)
3. Initializes SQLite auth schema
4. If **no users** exist: creates `Administrator` + system `bot`
5. Writes admin credentials to `data/auth/admin-credentials.json`
6. Games boot: refund orphan escrows + recover incomplete jackpot payouts before arcade traffic

No manual seed step is required for a clean deploy.

### Fast path

```bash
bash scripts/one-liners.sh setup
bash scripts/one-liners.sh pm2-start
```

## Hardening

1. Change the admin password after first login.
2. Delete or relocate `data/auth/admin-credentials.json` after storing the password in a secrets manager.
3. Never commit `.env`, `data/`, or credential files.
4. Terminate TLS at the reverse proxy; set `TRUST_PROXY=1` and `PUBLIC_BASE_URL=https://…`.
5. Restrict outbound network if you do not need proxy scraper / external fetch features.
6. Schedule backups of the entire `data/` directory (`bash scripts/one-liners.sh backup`).
7. Prefer a dedicated OS user and systemd/PM2/Docker restart policies.
8. Keep **one** primary writer process unless you understand multi-worker lock + Redis setup.

## Backup & restore

```bash
# Backup
bash scripts/one-liners.sh backup
# or:
tar -czf lul-data-$(date +%F).tar.gz data/

# Restore (stop app first)
tar -xzf lul-data-YYYY-MM-DD.tar.gz
```

Full disaster recovery: `Backup/LUL-Terminal_FULL_*/WIEDERHERSTELLUNG.md`.

## Updates

```bash
# One-liner:
bash scripts/one-liners.sh deploy

# Manual:
git pull
npm ci
npm run build
pm2 restart lul-terminal
# Docker:
docker compose up -d --build
```

Auth and content data survive updates when `data/` is preserved (Docker volume or host path).
