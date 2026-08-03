# LUL Terminal — Runbook (Betrieb & Setup)

Everything you need to **install, run, update, backup, and recover** LUL Terminal — from first-time beginner to production ops.

**App version:** see `package.json` / `src/config/version.ts` (current **3.49.0**).

---

## 1. What this app is

Single Node.js process:

| Path | Role |
|------|------|
| `/api/*` | REST API (auth, arcade, paste, images, admin, …) |
| `/` + SPA | React UI from `dist/` |
| `/hosting/*` | Image host |
| `data/` | **All persistent state** (SQLite auth + JSON stores) |

No external DB required. Optional: Redis for shared rate-limits / view-dedup across workers.

---

## 2. Requirements

| Item | Min |
|------|-----|
| Node.js | **≥ 18** |
| npm | ships with Node |
| Disk | ~500 MB app + `data/` growth |
| Ports | `3000` default (`PORT` in `.env`) |
| OS | Linux (prod recommended), Windows/macOS (dev OK) |

Optional: PM2, Docker, nginx/Caddy, Redis.

---

## 3. First-time setup (5 minutes)

### Option A — One-liners (recommended)

From repo root (`lul-terminal/`):

```bash
# Linux / macOS / Git Bash
bash scripts/one-liners.sh setup
bash scripts/one-liners.sh start
```

```powershell
# Windows PowerShell
.\scripts\one-liners.ps1 setup
.\scripts\one-liners.ps1 start
```

### Option B — Manual

```bash
cp .env.example .env          # Windows: copy .env.example .env
# Edit .env — see section 4
npm ci                       # or: npm install
npm run build
npm start                    # → http://localhost:3000
```

On **first start** with empty auth DB the server:

1. Creates `data/*` directories  
2. Ensures premium vault key (`PREMIUM_VAULT_KEY` or `data/secrets/premium-vault.key`)  
3. Creates **Administrator** + system **bot**  
4. Writes password to `data/auth/admin-credentials.json`  

**Log in → change admin password → delete or relocate credentials file.**

---

## 4. Environment (`.env`) — must-know

| Variable | Prod | Notes |
|----------|------|--------|
| `NODE_ENV=production` | **Yes** | Secure cookies / prod paths |
| `PORT=3000` | Optional | Listen port |
| `TRUST_PROXY=1` | **Yes** behind nginx/Caddy/CF | Real client IPs |
| `PUBLIC_BASE_URL=https://your.domain` | **Strongly recommended** | Paste/image/referral absolute URLs |
| `ALLOWED_PUBLIC_HOSTS=your.domain` | Recommended | Host allow-list |
| `PREMIUM_VAULT_KEY=` | **Backup this** | Losing it = vault passwords unreadable |
| `SEED_ADMIN_PASSWORD=` | First run only | Else random → credentials file |
| `REDIS_URL=` | Optional multi-instance | Shared rate limit / view dedup |
| `COOKIE_SECURE=1` | Optional | Force Secure cookies |

Template: `.env.example`.

---

## 5. Production topologies

### Single process (recommended default)

```
Internet → HTTPS reverse proxy → Node :3000
                                  └── ./data  (bind-mount or volume)
```

**One PM2 instance only** for coin/user correctness historically; as of **3.49.0** cross-process locks protect user/session/view/jackpot file RMW — still prefer **1 writer process** unless you also run Redis for rate-limit/dedup.

```bash
pm2 start server/start.mjs --name lul-terminal
pm2 save
pm2 startup
```

### Docker

```bash
docker compose up -d --build
# optional Redis:
docker compose --profile with-redis up -d --build
```

### Deploy update (canonical)

```bash
git pull && npm ci && npm run build && pm2 restart lul-terminal
```

Or: `bash scripts/one-liners.sh deploy`

---

## 6. Multi-worker / PM2 notes (3.49.0+)

| Resource | Protection |
|----------|------------|
| Users / sessions (SQLite snapshot RMW) | Cross-process locks `auth-users`, `auth-sessions` + SQLite `busy_timeout` |
| Jackpot pool | `games-aux` lock + **pending journal** until user credit saved |
| Page / post views | Locks `page-views`, `post-views` |
| Rate limit / guest view dedup | File locks or **Redis** (`REDIS_URL`) |

Still recommended: **`pm2 scale lul-terminal 1`** unless you know you need more and have Redis + shared `data/`.

---

## 7. Daily ops one-liners

| Goal | Command |
|------|---------|
| Dev server | `bash scripts/one-liners.sh dev` |
| Prod start (no PM2) | `bash scripts/one-liners.sh start` |
| Build only | `bash scripts/one-liners.sh build` |
| Typecheck | `bash scripts/one-liners.sh lint` |
| Health check | `bash scripts/one-liners.sh health` |
| Backup `data/` | `bash scripts/one-liners.sh backup` |
| Full deploy | `bash scripts/one-liners.sh deploy` |
| PM2 restart | `bash scripts/one-liners.sh pm2-restart` |
| Logs (PM2) | `bash scripts/one-liners.sh logs` |
| Doctor (env/data checks) | `bash scripts/one-liners.sh doctor` |

Windows: replace with `.\scripts\one-liners.ps1 <cmd>`.

---

## 8. Backup & restore

```bash
# Backup (stop writes if possible)
bash scripts/one-liners.sh backup
# → backups/lul-data-YYYY-MM-DD_HHMM.tgz (or .zip on Windows)

# Restore
pm2 stop lul-terminal   # or stop node
# extract archive over data/
tar -xzf backups/lul-data-….tgz -C .
# restore .env + PREMIUM_VAULT_KEY from secrets backup
pm2 start lul-terminal
```

Full disaster recovery (code + data + secrets): see `Backup/LUL-Terminal_FULL_*/WIEDERHERSTELLUNG.md`.

**Critical secrets to keep offline:**

- `.env`
- `data/secrets/premium-vault.key` / `PREMIUM_VAULT_KEY`
- `data/auth/lul-auth.sqlite`

---

## 9. Health & troubleshooting

```bash
curl -s http://127.0.0.1:3000/api/health
# { "ok": true, "service": "lul-terminal", ... }
```

| Symptom | Check |
|---------|--------|
| Blank page | `npm run build`, `dist/` present |
| 502 behind proxy | Node up? `TRUST_PROXY=1`? |
| Rate limits wrong IP | `TRUST_PROXY`, `TRUSTED_PROXY_IPS` |
| Vault passwords fail | Same `PREMIUM_VAULT_KEY` as encrypt time |
| Coins “lost” after restart | Escrow boot refund; check logs `[games] Refunded` |
| Jackpot missing after crash | `[games] Jackpot pending recovery` on boot |
| Permission denied on paste share | Share routes skip members-only tab gate (by design) |

Logs: `pm2 logs lul-terminal` or process stdout.

---

## 10. Security checklist

1. HTTPS only in production  
2. Change admin password; remove `admin-credentials.json` from web-reachable paths  
3. Never commit `.env` or `data/`  
4. Backup vault key separately  
5. Restrict outbound if scrapers unused  
6. Keep Node and deps updated (`npm audit`)  

---

## 11. Useful npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite + API middleware (dev) |
| `npm run build` | Production SPA → `dist/` |
| `npm start` | `node server/start.mjs` |
| `npm run lint` | `tsc --noEmit` |
| `npm run bootstrap` | Seed/ensure auth DB |
| `npm run bootstrap:reset` | **Wipe users** + re-bootstrap (danger) |

---

## 12. Related docs

- `docs/PRODUCTION.md` — deploy overview  
- `docs/ARCHITECTURE.md` — module map  
- `docs/AWS-UBUNTU-PRODUCTION.md` — AWS Ubuntu  
- `Backup/README.md` — full snapshot index  
- `AGENTS.md` — agent git push rules  

---

*LUL Terminal ops runbook — keep this file with the deploy.*
