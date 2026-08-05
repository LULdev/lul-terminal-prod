# LUL Terminal

[![Version](https://img.shields.io/badge/version-3.59.0-blue)](./package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green)](./package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-orange)](./LICENSE)

**Self-hosted community platform** — authentication, durable arcade matchmaking, profiles, paste & image hosting, shoutbox, tools, premium vault, and a full admin dashboard.

| | |
|---|---|
| **Stack** | React 19 · Vite · Express · SQLite (auth) · JSON file stores · optional Redis · Docker |
| **Repo** | [github.com/LULdev/lul-terminal-prod](https://github.com/LULdev/lul-terminal-prod) |
| **App version** | **3.59.0** (`package.json` / `src/config/version.ts`) |
| **License** | Apache-2.0 |

---

## Table of contents

1. [What is LUL Terminal?](#what-is-lul-terminal)
2. [What’s new (3.50 → 3.57) — details](#whats-new-350--357--details)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Step-by-step: first boot & setup](#step-by-step-first-boot--setup)
6. [Step-by-step: running (dev & production)](#step-by-step-running-dev--production)
7. [Step-by-step: Wartung (maintenance)](#step-by-step-wartung-maintenance)
8. [Environment variables](#environment-variables)
9. [Project structure](#project-structure)
10. [Features by module](#features-by-module)
11. [Tips & tricks](#tips--tricks)
12. [Troubleshooting](#troubleshooting)
13. [License](#license)

---

## What is LUL Terminal?

A **real, self-hosted** community hub. Members register, play arcade games for **LUL Coins**, share pastes and images, chat in the shoutbox, and (as VIP) use the encrypted premium vault. Admins manage users, content, scrapers, analytics, and page visibility.

| Concept | Meaning |
|---------|---------|
| `npm run dev` | Development — hot reload, API middleware, port **3000** |
| `npm run build` + `npm start` | Production — `dist/` SPA + Express (`server/start.mjs`) |
| `.env` | Secrets & flags — **never commit** |
| `data/` | **All live state** — back up and keep on a persistent volume |
| Bootstrap | First empty DB: admin + bot, dirs, vault key |

**No demo users. No placeholder members.** Only `Administrator` and the internal `bot` are created on first boot.

---

## What’s new (3.50 → 3.57) — details

High-signal production work from recent full-system audits. Changelog UI: in-app **Changelog** tab / `src/data/changelog.ts`.

### Arcade & money (critical)

| Version | What |
|---------|------|
| **3.57.0** | **Durable matchmaker** — queue, rooms, and active matches live under `data/games/matchmaker/{gameId}.json` with **cross-process file locks**. Survives restarts; multi-PM2 on **one host + shared `data/`** can share matchmaking. Boot **hydrates** matchmakers **before** orphan escrow refunds (live sessions keep their stakes). |
| **3.56.x** | Queue leave/re-bet **recovers stuck escrow** without pinning users forever. Logout from PvP = **forfeit** (opponent takes pot), not dual refund. Jackpot credits use durable `jackpotCreditedPendingIds` (survives 80-row ledger rotation). No blind restore of stale jackpot pending. |
| **3.55.x** | Partial forfeit no longer double force-credits. Queue **hard lifetime** via `joinedAt` (heartbeat no longer extends escrow forever). Dual-finalize one-shot flag. UserBar coins sync with arcade `myCoins`. |
| **3.54.x** | Jackpot/pot/history **outside** users write lock (`scheduleAfterUsersWrite`) — avoids users↔games-aux deadlocks. RPS/TTT deferred jackpot same as settle. Logout revokes session **before** residual refund. |
| **3.51–3.53** | `preferGameId` on escrow release (no cross-game stake steal). Jackpot `{amount,pendingId}` + boot recovery by pendingId. Soft `/me` + **sessionEpoch** so late 401s don’t wipe a new login. |

### Client reliability

| Version | What |
|---------|------|
| **3.56.1** | Protect fresher `lulCoins` when merging tab_visit / achievements / claw. Proxy scraper & checker **busyRef** (no double jobs). Soft401 on paste raw download; admin double-submit guards (emotes, shoutbox, vault bulk, pastes). |
| **3.53–3.55** | Admin/poll soft401 (no global logout mid-poll). Firebase stats **singleton** + online re-count after reconnect. Meme Firebase count only after successful upload. Coin UI NaN-safe. Dice/Roulette auto-submit locks. |

### Security & multi-worker data

| Area | What |
|------|------|
| **File locks** | Users, sessions, jackpot/history, paste, images, analytics, rate-limit buckets, page/post views, matchmaker |
| **SSRF** | IP-pinned `safeFetch`, redirect re-check, response size caps; proxy checker probe body capped (256KB) |
| **Paste** | Burn-after-read fail-closed; password scrypt **max 128** chars (CPU DoS) |
| **Vault** | AES-GCM at rest; `PREMIUM_VAULT_KEY` or auto key under `data/secrets/` |
| **Redis (optional)** | Shared rate-limit + guest view dedup when `REDIS_URL` is set |

### Ops tooling

- `scripts/one-liners.sh` / `.ps1` — setup, start, deploy, backup, doctor, health, pm2
- `npm run ops` / `ops:doctor` / `ops:deploy` / `ops:backup`
- Full runbook: [docs/RUNBOOK.md](./docs/RUNBOOK.md) · production hardening: [docs/PRODUCTION.md](./docs/PRODUCTION.md)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                     │
│  AuthContext · sessionEpoch · games · admin · tools      │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTP + HttpOnly cookie
┌────────────────────────────▼─────────────────────────────┐
│  Express  server/start.mjs                               │
│  bootstrap → auth API → feature APIs → static dist/      │
│                                                          │
│  data/auth/lul-auth.sqlite     users + sessions          │
│  data/games/matchmaker/*.json  durable arcade state     │
│  data/games/jackpot*.json      pot + pending journal     │
│  data/**  paste, images, vault, proxy, analytics, …      │
│  data/locks/                   cross-process file locks  │
└──────────────────────────────────────────────────────────┘
```

**Design principles**

| Principle | Practice |
|-----------|----------|
| Modular | Auth is isolated (`server/auth/*`, `server/db/*`) |
| Self-configuring | Bootstrap on every start: dirs, vault key, empty-DB admin |
| Portable | One Node process (or Docker); one volume for `data/` |
| Money-safe | Coin lock + matchmaker lock order; jackpot two-phase pending |

**Auth flow (short)**

1. Register — email, password, username; scrypt hash; optional referral  
2. Login — cookie `lul_session` (HttpOnly)  
3. Roles — `admin` · `vip` · `user` · `bot`  
4. First empty DB → create `Administrator` + credentials file  

---

## Prerequisites

| Requirement | Minimum |
|-------------|---------|
| **Node.js** | **≥ 18** (20 LTS recommended) |
| **npm** | 9+ |
| **Git** | clone / pull |
| **Disk** | ~500 MB app + growth of `data/` |
| **OS** | Linux (prod), Windows/macOS (dev OK) |
| **Optional** | Docker 24+, PM2, nginx/Caddy, Redis |

```bash
node -v && npm -v
# optional
docker -v && docker compose version
```

---

## Step-by-step: first boot & setup

### Path A — One-liners (fastest)

```bash
git clone https://github.com/LULdev/lul-terminal-prod.git
cd lul-terminal-prod

# Linux / macOS / WSL / Git Bash
bash scripts/one-liners.sh setup    # .env if missing, npm ci, build
bash scripts/one-liners.sh start    # production start
```

```powershell
# Windows PowerShell
git clone https://github.com/LULdev/lul-terminal-prod.git
cd lul-terminal-prod
.\scripts\one-liners.ps1 setup
.\scripts\one-liners.ps1 start
```

### Path B — Manual (understand every step)

| Step | Action |
|------|--------|
| **1. Clone** | `git clone … && cd lul-terminal-prod` |
| **2. Env** | `cp .env.example .env` (Windows: `copy .env.example .env`) |
| **3. Edit `.env`** | At least for prod: `NODE_ENV=production`, `PUBLIC_BASE_URL`, `TRUST_PROXY=1`, optional `SEED_ADMIN_PASSWORD` (≥12 chars), `PREMIUM_VAULT_KEY` |
| **4. Install** | `npm ci` (or `npm install`) |
| **5. Build** | `npm run build` |
| **6. Start** | `npm start` → http://localhost:3000 |
| **7. Admin login** | Read `data/auth/admin-credentials.json` if password was auto-generated |
| **8. Harden** | Change admin password; remove or relocate credentials file; back up vault key |

### Path C — Docker

```bash
git clone https://github.com/LULdev/lul-terminal-prod.git
cd lul-terminal-prod
cp .env.example .env
# Edit .env for production (see Environment variables)

docker compose up -d --build
# Open http://localhost:3000

# First-run admin password
docker compose exec lul-terminal cat data/auth/admin-credentials.json
```

Optional Redis profile:

```bash
# In .env: REDIS_URL=redis://redis:6379
docker compose --profile with-redis up -d --build
```

### What bootstrap does on empty auth DB

1. Creates `data/*` directories  
2. Ensures premium vault key (`PREMIUM_VAULT_KEY` or `data/secrets/premium-vault.key`)  
3. Creates **Administrator** + system **bot**  
4. Writes `data/auth/admin-credentials.json` (gitignored, mode `0600` when possible)  
5. On games boot: hydrates **16** durable matchmakers, refunds only **orphan** escrows  

Optional CLI (server already bootstraps):

```bash
npm run bootstrap          # same if DB empty
npm run bootstrap:reset    # DESTRUCTIVE: wipe auth DB + re-create admin
```

---

## Step-by-step: running (dev & production)

### Development

```bash
cp .env.example .env   # once
npm install
npm run dev            # http://0.0.0.0:3000 — hot reload + API
```

### Production (Node + PM2 — recommended)

```bash
# On server, in repo root
git pull
npm ci
npm run build

# Prefer ONE process for simplicity; multi-worker only with shared data/
pm2 start server/start.mjs --name lul-terminal -i 1
pm2 save
pm2 startup    # follow printed instructions for reboot survival
```

Update cycle:

```bash
git pull && npm ci && npm run build && pm2 restart lul-terminal
# or
bash scripts/one-liners.sh deploy
npm run ops:deploy
```

### Production (Docker)

```bash
docker compose up -d --build
docker compose logs -f lul-terminal
docker compose down
```

### Health check

```bash
curl -s http://127.0.0.1:3000/api/health
# { "ok": true, "service": "lul-terminal", ... }
npm run ops:health
bash scripts/one-liners.sh health
```

### Reverse proxy (sketch)

- Terminate TLS at nginx/Caddy/Cloudflare  
- Proxy to `127.0.0.1:3000`  
- Set `TRUST_PROXY=1`, `PUBLIC_BASE_URL=https://your.domain`  
- Allow WebSocket/HMR only in dev  

---

## Step-by-step: Wartung (maintenance)

### Daily / weekly

| Task | How |
|------|-----|
| Health | `curl …/api/health` or `ops:health` |
| Logs | `pm2 logs lul-terminal` / `docker compose logs -f` |
| Disk | Watch `data/` (images, paste, matchmaker, analytics) |
| Updates | `git pull` → `npm ci` → `build` → restart |

### Backup

```bash
# Prefer brief write pause for consistency
pm2 stop lul-terminal   # optional but safer
bash scripts/one-liners.sh backup
# → backups/lul-data-YYYY-MM-DD_HHMM.tgz (or .zip on Windows)
pm2 start lul-terminal
```

**Always keep offline copies of:**

- `.env`  
- `PREMIUM_VAULT_KEY` / `data/secrets/premium-vault.key`  
- `data/auth/lul-auth.sqlite`  
- Full `data/` archive  

Full disaster bundle (if present): `Backup/LUL-Terminal_FULL_*/WIEDERHERSTELLUNG.md`.

### Restore

```bash
pm2 stop lul-terminal
# Extract backup over data/ (keep same vault key + .env)
tar -xzf backups/lul-data-….tgz -C .
pm2 start lul-terminal
```

### Cleanup & hygiene

| Item | Note |
|------|------|
| `admin-credentials.json` | Delete or move after first login |
| Matchmaker files | `data/games/matchmaker/*.json` — normal growth; safe while app stopped |
| Jackpot pending | Auto-recovered on boot/sweep; don’t hand-edit |
| `npm run bootstrap:reset` | **Wipes all users** — never on live prod without intent |

### Multi-worker notes (3.57+)

| Resource | Shared how |
|----------|------------|
| Users / sessions | SQLite + locks `auth-users` / `auth-sessions` |
| Jackpot | `games-aux` + pending journal |
| **Arcade queue/matches** | `data/games/matchmaker/*.json` + lock `matchmaker-{gameId}` |
| Rate limit / guest views | File locks **or** Redis |

**Requirement for multi-PM2:** same host (or NFS) with **one shared `data/`**. Without that, use **`-i 1`**.

---

## Environment variables

Full template: [`.env.example`](./.env.example).

| Variable | Prod | Notes |
|----------|------|--------|
| `NODE_ENV` | **production** | Secure cookies / paths |
| `PORT` | Optional | Default `3000` |
| `TRUST_PROXY` | **1** behind proxy | Real client IPs for rate limits |
| `TRUSTED_PROXY_IPS` | Optional | Who may set X-Forwarded-* |
| `PUBLIC_BASE_URL` | Strongly recommended | Absolute paste/image/referral URLs |
| `ALLOWED_PUBLIC_HOSTS` | Recommended | Host allow-list with proxy |
| `SEED_ADMIN_PASSWORD` | First run | ≥12 chars; else random → credentials file |
| `SEED_ADMIN_EMAIL` | Optional | Default bootstrap email |
| `PREMIUM_VAULT_KEY` | **Backup** | Lose it = vault unreadable |
| `REDIS_URL` | Optional | Shared rate-limit / view dedup |
| `COOKIE_SECURE` | Optional | Force Secure cookies `1` / `0` |
| `RATE_LIMIT_BACKEND` | Optional | `auto` / `file` / `redis` |
| `GUEST_VIEW_DEDUP_BACKEND` | Optional | Same pattern |

---

## Project structure

```
lul-terminal/
├── docker-compose.yml          # One-command deploy
├── Dockerfile
├── .env.example
├── package.json                # version + scripts
├── scripts/
│   ├── one-liners.sh / .ps1    # setup, deploy, backup, doctor
│   └── ops-help.mjs
├── src/                        # React SPA
│   ├── components/             # pages, admin, games, paste, …
│   ├── context/AuthContext.tsx # sessionEpoch, soft /me
│   ├── data/changelog.ts       # in-app release notes
│   └── lib/                    # sessionFetch, games, soft401 APIs
├── server/
│   ├── start.mjs               # production entry
│   ├── bootstrap.mjs
│   ├── auth/ · db/             # SQLite auth
│   ├── gamesMatchmakerStore.mjs  # durable arcade (3.57)
│   ├── gamesCore.mjs · *Service.mjs
│   └── *Api.mjs
├── data/                       # RUNTIME (gitignored)
│   ├── auth/lul-auth.sqlite
│   ├── games/matchmaker/       # per-game queues & matches
│   ├── games/jackpot.json
│   ├── paste/ · image-host/ · secrets/
│   └── locks/
├── docs/
│   ├── RUNBOOK.md
│   ├── PRODUCTION.md
│   └── ARCHITECTURE.md
└── Backup/                     # optional full restore kits
```

---

## Features by module

| Module | Highlights |
|--------|------------|
| **Auth** | Register/login, scrypt, sessions, roles, referrals, registration challenge |
| **Profiles** | Avatars, covers, achievements, privacy, public profiles |
| **Arcade** | 16 games, LUL Coin escrow, durable matchmaking, jackpot journal, leaderboards, daily bonus |
| **Paste** | Public / private / password, burn-after-read, ratings, admin tools |
| **Images** | Upload, gallery, soft view tracking |
| **Premium vault** | AES-GCM accounts, VIP/verified submit, reports |
| **Proxy** | Scraper, checker, proxy DB, colon/XML tools |
| **Tools** | Persona DB, meme editor, net toolkit, tool vault, chaos/color/text labs |
| **News & shoutbox** | Feed, emotes, mod tools, bot messages |
| **Admin** | Users, analytics, visibility, storage, scrapers, moderation |

---

## Tips & tricks

### Setup & security

1. **Set `SEED_ADMIN_PASSWORD` before first start** on a clean volume — avoids hunting the credentials file.  
2. **Back up the vault key the same day you deploy** — rotate only with a planned re-encrypt strategy.  
3. **Never commit** `.env`, `data/`, or `admin-credentials.json`.  
4. Behind Cloudflare/nginx: `TRUST_PROXY=1` + correct `PUBLIC_BASE_URL` or cookies and rate limits lie.  
5. After first login: change admin password and **delete** `data/auth/admin-credentials.json`.

### Arcade & coins

6. Prefer **`pm2 -i 1`** unless you deliberately share `data/` across workers.  
7. After upgrade to **3.57**, first boot should log matchmaker hydrate; queues survive restarts.  
8. Leaving mid-PvP **forfeits** — opponents keep pot EV; don’t use logout as “refund”.  
9. If someone is stuck “in queue” with wrong coins: leave queue once (soft recover) or wait queue hard timeout (~30m from join).  
10. Jackpot is two-phase: pool drain → pending file → user credit → confirm. Don’t hand-edit `jackpot-pending.json`.

### Ops

11. **`bash scripts/one-liners.sh doctor`** before blaming the app — Node version, `data/` perms, `.env`.  
12. Deploy one-liner: `git pull && npm ci && npm run build && pm2 restart lul-terminal`.  
13. Backup before `bootstrap:reset` or major upgrades.  
14. Health endpoint is enough for load balancer probes: `/api/health`.  
15. Typecheck before ship: `npm run lint` (`tsc --noEmit`).  
16. Docker: pin a volume for `/app/data` so rebuilds don’t wipe state.  
17. Logs: search for `[games]`, `[bootstrap]`, `[auth]`, `[fatal]`.

### Client / admin

18. Flaky admin 401s should **not** log you out on poll/read paths (soft401) — if they do, hard-refresh once.  
19. UserBar coins should track arcade after moves/claims; if not, hard refresh once after upgrade.  
20. Double-submit on heavy admin jobs (scrape/check) is blocked by busy refs — wait for progress text.  
21. Changelog tab lists every ship with **P0–P9** priorities for audits.

### Performance

22. Redis helps when **multiple Node processes** share rate limits and guest view windows.  
23. Image/paste growth is the usual disk eater — prune or offload `data/image-host` if needed.  
24. Don’t run `bootstrap:reset` on a populated production volume.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite + API, port 3000 |
| `npm run build` | Production SPA → `dist/` + chunk verify |
| `npm start` | Bootstrap + Express production server |
| `npm run lint` | `tsc --noEmit` |
| `npm run bootstrap` | Auth seed if empty |
| `npm run bootstrap:reset` | **Wipe auth DB** + admin |
| `npm run ops` | Print ops quickstart |
| `npm run ops:doctor` / `ops:deploy` / `ops:backup` / `ops:health` | One-liner wrappers |

```bash
bash scripts/one-liners.sh setup|start|deploy|backup|doctor|health|pm2-restart|logs|dev
# Windows: .\scripts\one-liners.ps1 <cmd>
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Cannot log in after first deploy | Unread credentials | `cat data/auth/admin-credentials.json` or Docker exec |
| Blank page | Missing `dist/` | `npm run build` then `npm start` |
| Cookies missing behind HTTPS | Secure / proxy | `TRUST_PROXY=1`, `PUBLIC_BASE_URL=https://…` |
| `better-sqlite3` build fails | Native toolchain | Build tools / use Docker image |
| Healthcheck fails | Cold start | Wait ~40s; check logs |
| Vault decrypt errors | Key changed | Restore original vault key |
| Queue gone after restart (pre-3.57) | Old RAM-only MM | Upgrade to 3.57+ |
| Double coins / split queues | Multi-worker without shared `data/` | Shared volume or `-i 1` |
| Stuck jackpot / no hits | Pending open | Wait sweep/boot recovery; check logs `[games] jackpot` |
| Rate limits hit everyone | Wrong client IP | Fix `TRUST_PROXY` / trusted proxy IPs |

---

## Further reading

| Doc | Content |
|-----|---------|
| [docs/RUNBOOK.md](./docs/RUNBOOK.md) | Install, PM2, backup, multi-worker |
| [docs/PRODUCTION.md](./docs/PRODUCTION.md) | Hardening checklist |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Module layout |
| In-app Changelog | Every version’s P0–P9 fix list |

---

## License

Apache-2.0 — see [LICENSE](./LICENSE).
