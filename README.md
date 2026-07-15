# LUL Terminal

[![Version](https://img.shields.io/badge/version-3.48.0-blue)](./package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green)](./package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-orange)](./LICENSE)

Self-hosted community platform: authentication, arcade games, profiles, paste & image hosting, shoutbox, tools, and an admin dashboard.

**Stack:** React 19 · Vite · Express · SQLite (auth) · JSON file stores · Docker

**Repository:** [github.com/LULdev/lul-terminal-prod](https://github.com/LULdev/lul-terminal-prod)

---

## Table of contents

1. [What is LUL Terminal?](#what-is-lul-terminal)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick start (Docker — recommended)](#quick-start-docker--recommended)
5. [Local development](#local-development)
6. [First-run bootstrap & admin account](#first-run-bootstrap--admin-account)
7. [Environment variables](#environment-variables)
8. [Project structure](#project-structure)
9. [Main components](#main-components)
10. [Production security](#production-security)
11. [Scripts](#scripts)
12. [Troubleshooting](#troubleshooting)

---

## What is LUL Terminal?

LUL Terminal is a **real, self-hosted** community hub. Members register, play arcade games for LUL Coins, share pastes and images, chat in the shoutbox, and (as VIP) use the premium vault. Admins manage users, content, and page visibility from a dashboard.

| Term | Meaning |
|------|---------|
| `npm run dev` | Development mode — hot reload on port 3000 |
| `npm run build` + `npm start` | Production — optimized frontend + Express |
| `.env` | Secrets and runtime flags — **never commit** |
| `data/` | Live application data — **back up** and keep persistent |
| Bootstrap | Automatic first-run setup (admin account, dirs, vault key) |

**No demo users. No placeholder content.** The database starts clean except for the system administrator and the internal bot account.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                    │
│  AuthContext · pages · admin panels                     │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP (session cookie)
┌───────────────────────────▼─────────────────────────────┐
│  Express (server/start.mjs)                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ bootstrap   │  │ Auth API     │  │ Feature APIs   │  │
│  │ (first run) │  │ /api/auth/*  │  │ paste, games…  │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────┘  │
│         │                │                   │          │
│         ▼                ▼                   ▼          │
│  data/auth/lul-auth.sqlite     data/**/*.json + files   │
└─────────────────────────────────────────────────────────┘
```

### Design principles

| Principle | Implementation |
|-----------|----------------|
| **Modular** | Auth is an isolated subsystem (`server/auth/*`, `server/db/*`). Other modules depend on session resolution, not on each other. |
| **Self-configuring** | `server/bootstrap.mjs` runs on every start: directories, vault key, empty-DB admin creation. |
| **Portable** | Single container or single Node process. One volume for `data/`. |
| **No fake data** | Bootstrap creates only `Administrator` + system `bot`. Members register themselves. |

### Auth flow (module 1)

1. **Register** — email + password + username; scrypt password hash; optional referral code.
2. **Login** — username or email; session token in HttpOnly cookie (`lul_session`).
3. **Session** — SQLite `sessions` table; short (24h) or remember (30d) lifetime.
4. **Roles** — `admin` · `vip` · `user` · `bot`.
5. **Admin bootstrap** — if user table is empty on start, create admin and write credentials to `data/auth/admin-credentials.json`.

---

## Prerequisites

| Requirement | Minimum |
|-------------|---------|
| **Docker** + Docker Compose | 24+ (for container deploy) |
| **or Node.js** | 18+ (20 LTS recommended) |
| **npm** | 9+ |
| **Git** | to clone the repository |
| **OS** | Linux, macOS, or Windows |

```bash
docker -v          # Docker path
docker compose version
# or
node -v            # v18.x or higher
npm -v
```

---

## Quick start (Docker — recommended)

One command deploys a full production instance on any server with Docker.

```bash
git clone https://github.com/LULdev/lul-terminal-prod.git
cd lul-terminal-prod

# Optional but recommended for production
cp .env.example .env
# Edit .env: SEED_ADMIN_PASSWORD, PUBLIC_BASE_URL, TRUST_PROXY=1, …

docker compose up -d --build
```

Open **http://localhost:3000** (or your host port).

### Read admin credentials (first run)

```bash
# Docker volume path inside the container
docker compose exec lul-terminal cat data/auth/admin-credentials.json
```

Example shape:

```json
{
  "generatedAt": "2026-07-15T12:00:00.000Z",
  "passwordSource": "generated",
  "admin": {
    "login": "Administrator",
    "email": "administrator@lul.terminal",
    "password": "<strong-random-password>",
    "role": "admin"
  }
}
```

Log in with `Administrator` and that password. Change the password after first login.

### Stop / update

```bash
docker compose down
docker compose up -d --build   # after git pull
```

Data survives restarts in the `lul-data` Docker volume.

### Optional Redis

```bash
# In .env:
# REDIS_URL=redis://redis:6379

docker compose --profile with-redis up -d --build
```

---

## Local development

```bash
git clone https://github.com/LULdev/lul-terminal-prod.git
cd lul-terminal-prod
npm install
cp .env.example .env          # Windows: copy .env.example .env

# Optional: choose admin password before first start
# SEED_ADMIN_PASSWORD=YourStrongPassword12

npm run dev
```

Open **http://localhost:3000**.

On first auth touch (or `npm start`), bootstrap creates the admin account automatically. Credentials appear in:

- Console logs (`[bootstrap] …`)
- File: `data/auth/admin-credentials.json`

### Production-like local run

```bash
npm run build
npm start
```

---

## First-run bootstrap & admin account

| What | Details |
|------|---------|
| **When** | Automatically when the auth database has **zero** users |
| **Who is created** | `Administrator` (role `admin`) and `bot` (system, not loggable) |
| **Who is NOT created** | Demo users, VIP test accounts, fake members |
| **Password** | `SEED_ADMIN_PASSWORD` from `.env` if ≥ 12 chars; otherwise a secure random value |
| **Credentials file** | `data/auth/admin-credentials.json` (mode `0600`, gitignored) |
| **Vault key** | `PREMIUM_VAULT_KEY` or auto file `data/secrets/premium-vault.key` |

Optional CLI (not required — server already bootstraps):

```bash
npm run bootstrap          # same as auto first-run if empty
npm run bootstrap:reset    # WIPE auth DB and recreate admin — destructive
```

---

## Environment variables

See [`.env.example`](./.env.example) for the full template.

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `3000`) |
| `NODE_ENV` | `development` or `production` |
| `TRUST_PROXY` | `1` when behind nginx/Cloudflare |
| `PUBLIC_BASE_URL` | Canonical public URL (`https://…`) |
| `ALLOWED_PUBLIC_HOSTS` | Allowed forwarded hosts |
| `SEED_ADMIN_PASSWORD` | Admin password on first empty DB |
| `SEED_ADMIN_EMAIL` | Admin email on first empty DB |
| `PREMIUM_VAULT_KEY` | AES key for premium vault |
| `REDIS_URL` | Optional shared rate-limit / dedup backend |
| `COOKIE_SECURE` | Force Secure cookies `1` / `0` |

---

## Project structure

```
lul-terminal/
├── docker-compose.yml      # One-command deploy
├── Dockerfile              # Multi-stage production image
├── .env.example            # Environment template
├── package.json
├── index.html
├── vite.config.ts
├── public/                 # Static assets
├── src/                    # React frontend
│   ├── components/         # UI (auth, admin, games, paste, …)
│   ├── context/            # AuthContext, page visibility
│   ├── lib/                # API clients
│   ├── hooks/
│   └── App.tsx
├── server/                 # Express backend
│   ├── start.mjs           # Production entry (bootstrap + listen)
│   ├── bootstrap.mjs       # First-run self-configuration
│   ├── auth/               # Auth API, sessions, crypto, guards
│   ├── db/                 # SQLite schema + bootstrap users
│   └── *Api.mjs            # Feature modules
├── data/                   # Runtime data (gitignored; Docker volume)
│   ├── auth/               # SQLite + admin-credentials.json
│   └── secrets/            # Generated keys if not in env
├── scripts/                # Optional tooling
└── docs/
    └── PRODUCTION.md       # Hardening & ops
```

---

## Main components

| Area | Description |
|------|-------------|
| **Auth** | Register / login / session cookies, roles, registration challenge, referrals |
| **Profiles** | Public profiles, avatars, achievements, activity |
| **Arcade** | Games with LUL Coin escrow, matchmaking, leaderboards |
| **Paste** | Public / protected / private pastes, burn-after-read |
| **Image host** | Upload, gallery, view tracking |
| **Premium vault** | Encrypted VIP accounts (AES-GCM); reveal API only |
| **Proxy tools** | Scraper, checker, proxy database |
| **Tools** | Persona DB, meme editor, net toolkit, tool vault |
| **News & chat** | Feed + shoutbox with emotes and moderation |
| **Admin** | Users, analytics, moderation, page visibility, system pulse |

All application state is local under `data/` — no mandatory external database.

---

## Production security

1. **Always use HTTPS** in production (`PUBLIC_BASE_URL=https://…`, reverse proxy TLS).
2. Set a strong `SEED_ADMIN_PASSWORD` **before** the first start, or rotate after reading `admin-credentials.json`.
3. Set `PREMIUM_VAULT_KEY` to a long random secret and **back it up**. Losing it makes vault ciphertext unreadable.
4. Enable `TRUST_PROXY=1` only behind a trusted reverse proxy; configure `TRUSTED_PROXY_IPS` if needed.
5. Never commit `.env`, `data/auth/admin-credentials.json`, or `data/secrets/`.
6. Remove or lock down `admin-credentials.json` after first login (password managers / secrets vault).
7. Keep Node/Docker images updated; run as non-root (Docker image already uses `node` user).
8. Back up the entire `data/` directory regularly.
9. Prefer rate limits + Redis when running multiple instances.

More detail: [docs/PRODUCTION.md](./docs/PRODUCTION.md).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with API middleware (port 3000) |
| `npm run build` | Production frontend build → `dist/` |
| `npm start` | Bootstrap + Express (serves `dist/` + API) |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |
| `npm run bootstrap` | Optional auth bootstrap if DB empty |
| `npm run bootstrap:reset` | **Destructive** wipe + re-create admin |

Docker:

```bash
docker compose up -d --build
docker compose logs -f lul-terminal
docker compose exec lul-terminal cat data/auth/admin-credentials.json
docker compose down
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Cannot log in after first deploy | Wrong password / unread credentials file | Read `data/auth/admin-credentials.json` or container exec as above |
| Empty credentials file / no admin | Volume already had users or bootstrap failed | Check logs for `[bootstrap]` / `[fatal]` |
| Cookies not set behind HTTPS proxy | Missing Secure / trust proxy | `TRUST_PROXY=1`, `PUBLIC_BASE_URL=https://…` |
| `better-sqlite3` build fails | Missing native toolchain | Install Python 3 + build tools; Docker image already includes them |
| Healthcheck fails | App not ready yet | Wait for `start_period` (40s); check `docker compose logs` |
| Vault decrypt errors | Key changed | Restore original `PREMIUM_VAULT_KEY` / `data/secrets/premium-vault.key` |

---

## License

Apache-2.0 — see [LICENSE](./LICENSE).
