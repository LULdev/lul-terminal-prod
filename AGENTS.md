# LUL Terminal — Agent Instructions

## Git: auto commit + push

After **every completed change set** (feature, fix, or config edit):

1. Stage the relevant files (`git add` — never secrets, `data/auth/*`, SQLite DBs, or local env).
2. Commit with a clear message (what + why).
3. **Push to `origin` immediately** (`git push origin HEAD` or current branch).

Do **not** wait for the user to say "push". Treat push as part of finishing the work.

Exceptions (ask first):
- Force-push / amend of already-published commits
- Deleting remote branches
- Committing credentials, production secrets, or large binary dumps

Local git is configured with `core.hooksPath=scripts/git-hooks` so a **post-commit** hook also auto-pushes after any commit (CLI or agent).

---

## Project overview

Single Node.js process serving a React SPA + REST API. Self-hosted community platform with auth, arcade, paste, image hosting, proxy scraping, chat, analytics, and admin dashboard. **No mandatory external database** — uses SQLite (`better-sqlite3`) for auth and JSON files under `data/` for everything else.

| Layer | Tech | Entry |
|---|---|---|
| Frontend | React 19 + Vite 6 + Tailwind 4 | `src/main.tsx` → `App.tsx` |
| Backend | Express 4 (Node.js ESM) | `server/start.mjs` |
| Auth store | SQLite via `better-sqlite3` | `data/auth/lul-auth.sqlite` |
| Content stores | JSON files under `data/` | module-specific stores |

---

## Essential commands

```bash
npm run dev          # Vite dev server (port 3000) — boots API + SPA together
npm run build        # Vite build → verify chunk sizes
npm start            # Production: serve dist/ + API on port 3000

npm run lint         # TypeScript type-check (tsc --noEmit)

npm run bootstrap    # Seed auth DB (admin + bot accounts)
npm run bootstrap:reset  # Wipe & re-seed auth DB

npm run hooks:install    # Install git hooks
npm run ops:doctor       # Health check
npm run ops:setup        # Full setup
npm run ops:deploy       # Deploy
npm run ops:backup       # Backup data/
```

### Docker

```bash
docker compose build   # Multi-stage build
docker compose up -d   # Mounts lul-data at /app/data
```

---

## Project structure

```
├── src/                          # React SPA (TypeScript)
│   ├── main.tsx                  # Entry: AuthProvider → App or ImageHostViewer
│   ├── App.tsx                   # Main app shell: header, sidebar nav, tab routing
│   ├── components/
│   │   ├── pages/                # Lazy-loaded feature pages (one per tab)
│   │   │   ├── lazyPages.tsx     # React.lazy wrappers for all pages
│   │   │   └── PageShell.tsx     # Shared page wrapper (header, scroll)
│   │   ├── admin/                # ~25 admin dashboard panels
│   │   ├── auth/                 # AuthModal, FeatureLoginGate, UserBar, etc.
│   │   ├── games/                # Arcade game arenas (Connect4, Dice, Roulette, etc.)
│   │   ├── paste/                # Paste viewer, gallery, star rating
│   │   ├── image/                # Image host viewer, gallery
│   │   ├── chat/                 # (in diagnostics/)
│   │   └── ui/                   # Small reusable components
│   ├── config/
│   │   ├── menuItems.ts          # Tab definitions, nav items, accent styles
│   │   ├── accessControl.ts      # Default public/restricted tab config
│   │   └── version.ts            # APP_VERSION constant (must match package.json)
│   ├── context/
│   │   ├── AuthContext.tsx        # Session state, login/register, achievements
│   │   └── PageVisibilityContext.tsx  # Tab visibility tracking
│   ├── hooks/                    # ~15 custom hooks (polling, Firebase, stats)
│   ├── lib/                      # Typed API clients (one per feature module)
│   ├── data/                     # Static data: achievements, changelog, FAQ, persona data
│   └── types/                    # Shared TypeScript types
├── server/                       # Express API (JavaScript ESM — .mjs)
│   ├── start.mjs                 # Entry: bootstrap → Express listen
│   ├── bootstrap.mjs             # Self-config: dirs, vault key, auth DB
│   ├── serverMiddleware.mjs      # Single dispatcher: routes req by pathname to feature routers
│   ├── auth/                     # Auth subsystem (api, service, store, crypto, cookies, etc.)
│   ├── db/                       # SQLite schema, migrations, seed
│   └── *Api.mjs, *Service.mjs, *Store.mjs  # Feature modules
├── scripts/                      # CLI tools (seed, ops, dedup, migration, git hooks)
├── docs/                         # Architecture, deployment, runbook
├── data/                         # Runtime data (gitignored except .gitkeep)
└── public/                       # Static assets: favicon, emotes, memes
```

---

## Architecture & data flow

### Bootstrap sequence

```
start.mjs
  → loadEnv (.env)
  → bootstrapApplication()
       → ensure data/* directories
       → ensure PREMIUM_VAULT_KEY (env or generate → data/secrets/)
       → initAuth() — open SQLite, apply schema, seed admin+bot if empty
  → gamesBoot (refund escrows before listen)
  → Express listen
```

### API routing

All API routes live on a single Express app. `serverMiddleware.mjs` dispatches by pathname prefix to feature routers (e.g., `/api/auth/*` → auth, `/api/games/*` → games). Each feature has a `create*Middleware()` factory that returns a Router or handler function.

### Feature module pattern

Each feature typically has three files:

| File | Role |
|---|---|
| `*Api.mjs` | HTTP route handlers (middleware) |
| `*Service.mjs` | Business logic (sometimes merged into Store) |
| `*Store.mjs` | Persistence under `data/` |

API handlers follow this pattern:
1. `attachAuth(req)` — populates `req.auth.user` + `req.auth.permissions`
2. `requireMemberTab(req, tabId)` — access control check
3. `checkRateLimit(key, opts)` — sliding-window rate limit
4. `requireUser(req)` — throws if not logged in
5. Do business logic → `sendJson(res, status, body)`

### Session/401 handling

- Backend sets HttpOnly session cookies
- Frontend uses `sessionFetch`/`sessionJson` (in `lib/sessionFetch.ts`) — credentialed fetch
- On 401, `invalidateSession()` broadcasts via an event bus, causing AuthContext to re-fetch `/api/auth/me`
- `soft401` option available for read-only endpoints that shouldn't invalidate

### Auth system

- Roles: `admin` > `vip` > `user` > `bot`
- Passwords: scrypt with random salt
- Sessions: opaque 32-byte tokens, HttpOnly cookies, rotatable on login
- Guest `/api/auth/me`: null-safe permissions (never assumes user object)

---

## Conventions & gotchas

### Code conventions

- **Every file** starts with `/** @license SPDX-License-Identifier: Apache-2.0 */`
- Backend: **JavaScript ESM (`.mjs`)** — all imports use full file extensions
- Frontend: **TypeScript (`.tsx`/`.ts`)** — JSX in `.tsx`
- `__dirname` pattern: `path.dirname(fileURLToPath(import.meta.url))`
- `@/` path alias configured in tsconfig + vite.config → resolves to repo root
- Server-side JSON responses use `sendJson(res, status, body)` helper, never `res.json()`

### API gotchas

- API handlers are **not** Express Router middleware — they're plain async functions. Use `wrapAsyncHandler` for JSON error wrapping.
- `readJsonBody(req, limit)` reads raw body chunks (no `express.json()` in most routes)
- Rate limits use a custom `checkRateLimit()` — different key per endpoint per user/IP
- Error messages double as HTTP status: `'Not logged in'` → 401, `'Permission denied'` → 403
- `clientIp(req)` respects `TRUST_PROXY` + `x-forwarded-for` / `x-real-ip`

### Games gotchas

- **Cross-process file locks** (`fileLock.mjs`) via exclusive create (`wx`) — used for matchmaking, jackpot, and coin balance writes
- `withGamesAuxWrite` serializes jackpot/history RMW (process-local promise chain + cross-process lock)
- Two-phase jackpot: pot drained to pending file, cleared only after user balance save
- Refund escrows happen **before** Express listen (in `gamesBoot.mjs`)
- Coin operations require `withGamesCoinLock` — don't mutate user coins without it

### Data gotchas

- `data/auth/lul-auth.sqlite` is the **only** SQLite store — everything else is JSON files
- JSON stores use atomic writes: write to `.tmp` → `rename` (crash-safe on same filesystem)
- `data/` is excluded from Vite's file watcher (prevents full-page reloads on API writes)
- `data/secrets/premium-vault.key` is generated on first run — **back it up** (vault passwords unreadable without it)

### Frontend gotchas

- All pages are `React.lazy()` loaded via `lazyPages.tsx` — never import page components directly
- `PageShell` wraps every page — provides header, scroll container, pinned banner
- Vite manual chunks split admin panels into separate bundles to avoid one giant JS file (see `vite.config.ts`)
- HMR can be disabled via `DISABLE_HMR=true` (for AI Studio environments)
- `AuthProvider` wraps the entire app — use `useAuth()` for user state, login, logout
- `FeatureLoginGate` blocks guest access to features that require login
- Image viewer mode (`/i/:id`) renders `ImageHostViewer` directly without the main app shell

### Build gotchas

- `npm run build` runs `vite build` then `verify-build-chunks.mjs` — be careful with large admin panel imports
- `chunkSizeWarningLimit: 520` in vite config — admin panels are intentionally split into separate chunks
- TypeScript errors won't stop the build (noEmit + isolatedModules) — but `npm run lint` will catch them
- Production image uses `node:20-alpine` with `better-sqlite3` native addon — requires `python3 make g++` at build time

### Tailwind gotchas

- Uses **Tailwind v4** (imported via `@tailwindcss/vite` plugin, no `tailwind.config.js`)
- All classes are utility classes inline — no custom CSS files except `index.css` and `profile/profile.css`
- Custom `animate-fade-in` class is defined in `index.css`

---

## Testing

There is **no test framework** configured. `npm run lint` runs `tsc --noEmit` for type-checking. No unit, integration, or e2e tests exist.

When making changes, verify by:
1. `npm run lint` for type errors
2. `npm run dev` and manually test the affected feature
3. `npm run build` for production build verification

---

## Key files mapping

| Need | Look in |
|---|---|
| Add a new tab/page | `src/config/menuItems.ts` + `src/components/pages/lazyPages.tsx` + create page in `src/components/pages/` |
| Add a new API endpoint | Create `*Api.mjs` in `server/`, register in `serverMiddleware.mjs` |
| Auth logic | `server/auth/` (API, service, store, crypto, cookies, permissions) |
| User roles/permissions | `server/auth/permissions.mjs` |
| Rate limiting | `server/rateLimit.mjs` + `server/rateLimitStore.mjs` |
| Cross-process locks | `server/fileLock.mjs` |
| Session management | `src/lib/sessionEvents.ts` + `src/lib/sessionFetch.ts` + `src/context/AuthContext.tsx` |
| Admin dashboard panels | `src/components/admin/` (one per panel) |
| Games coin operations | `server/gamesCoinLock.mjs` + `server/coinLedger.mjs` |
| Premium vault encryption | `server/premiumVaultCrypto.mjs` |
| Bootstrap/config | `server/bootstrap.mjs` + `server/loadEnv.mjs` |
| Deployment | `Dockerfile` + `docker-compose.yml` + `docs/RUNBOOK.md` + `docs/PRODUCTION.md` |