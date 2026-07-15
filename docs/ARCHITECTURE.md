# Architecture

## Overview

LUL Terminal is a modular full-stack application:

| Layer | Technology | Entry |
|-------|------------|--------|
| Frontend | React 19 + Vite + Tailwind | `src/main.tsx` → `App.tsx` |
| Backend | Express (Node.js ESM) | `server/start.mjs` |
| Auth store | SQLite (`better-sqlite3`) | `data/auth/lul-auth.sqlite` |
| Content stores | JSON + files under `data/` | module-specific stores |

One process serves the SPA and all `/api/*` routes. No mandatory external database.

## Bootstrap sequence

```
process start
  → loadEnv (.env)
  → bootstrapApplication()
       → ensure data/* directories
       → ensure PREMIUM_VAULT_KEY (env or data/secrets/)
       → initAuth()
            → open SQLite, apply schema
            → if users empty: create Administrator + bot
            → write data/auth/admin-credentials.json
  → Express listen
```

Development (`npm run dev`) runs the same bootstrap from the Vite plugin before attaching API middleware.

## Auth module (first component)

```
server/auth/
  authApi.mjs          HTTP routes (/api/auth/*)
  authService.mjs      register, login, sessions, profiles
  authStore.mjs        SQLite-backed user/session R/W + bootstrap hook
  crypto.mjs           scrypt password hash, session tokens
  cookies.mjs          HttpOnly session + registration lock cookies
  permissions.mjs      roles: admin | vip | user | bot
  registrationGuard.mjs multi-signal anti-abuse barrier
  registrationChallenge.mjs short-lived register proof
  …

server/db/
  authDatabase.mjs     schema, migrate, CRUD shapes
  seedAuthUsers.mjs    production bootstrap users (admin + bot only)
  userRecord.mjs       row ↔ object mapping
```

### Roles

| Role | Purpose |
|------|---------|
| `admin` | Full admin dashboard + all VIP features |
| `vip` | Premium vault view |
| `user` | Standard member |
| `bot` | System announcements; cannot log in |

### Security properties

- Passwords: scrypt with random salt
- Sessions: opaque 32-byte tokens, HttpOnly cookies, rotatable on login
- Registration: challenge token + multi-signal registry + disposable email block
- Guest `/api/auth/me`: never assumes a user object (null-safe permissions)

## Feature modules

Each feature typically has:

- `*Api.mjs` — HTTP middleware
- `*Service.mjs` / `*Store.mjs` — business logic + persistence under `data/`

| Module | API prefix | Persistence |
|--------|------------|-------------|
| Auth | `/api/auth` | SQLite |
| Chat | `/api/chat` | `data/chat/` |
| Paste | `/api/paste` | `data/paste/` |
| Image host | `/api/images`, `/hosting/` | `data/image-host/` |
| Games | `/api/games` | `data/games/` + user coins in auth |
| Admin | `/api/admin/*` | cross-cutting |
| Analytics | `/api/analytics` | `data/analytics/` |
| News | `/api/news` | `data/feeds/` |
| Premium vault | `/api/premium-accounts` | encrypted at rest |

## Frontend structure

- `src/context/AuthContext.tsx` — session state, login/register modals
- `src/components/auth/*` — auth UI
- `src/components/pages/*` — lazy-loaded feature pages
- `src/components/admin/*` — admin dashboard panels
- `src/lib/*` — typed API clients

## Deployment

```
Docker multi-stage build → node:20-alpine production image
docker compose up → volume lul-data mounted at /app/data
```

See [PRODUCTION.md](./PRODUCTION.md) and the root [README.md](../README.md).
