#!/usr/bin/env bash
# LUL Terminal — comfort one-liners (Linux / macOS / Git Bash / WSL)
# Usage: bash scripts/one-liners.sh <command>
#        ./scripts/one-liners.sh help

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED=$'\033[0;31m'
GRN=$'\033[0;32m'
YLW=$'\033[0;33m'
CYN=$'\033[0;36m'
NC=$'\033[0m'

log()  { echo "${CYN}[lul]${NC} $*"; }
ok()   { echo "${GRN}[ok]${NC} $*"; }
warn() { echo "${YLW}[warn]${NC} $*"; }
die()  { echo "${RED}[err]${NC} $*" >&2; exit 1; }

need_node() {
  command -v node >/dev/null 2>&1 || die "Node.js ≥ 18 required. Install: https://nodejs.org"
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -lt 18 ]]; then die "Node ≥ 18 required (found $(node -v))"; fi
}

ensure_env() {
  if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
      cp .env.example .env
      warn "Created .env from .env.example — edit PUBLIC_BASE_URL / secrets before prod."
    else
      die "No .env or .env.example"
    fi
  fi
}

cmd_help() {
  cat <<'EOF'
LUL Terminal one-liners
=======================
  help           This help
  doctor         Check Node, .env, data/, ports
  setup          First install: .env + npm ci + build
  install        npm ci (fallback npm install)
  build          Production build (dist/)
  lint           Typecheck (tsc --noEmit)
  dev            Dev server (Vite :3000)
  start          Production start (node server/start.mjs)
  stop           Stop PM2 app lul-terminal (if any)
  deploy         git pull + npm ci + build + pm2 restart
  pm2-start      pm2 start/restart production process
  pm2-restart    pm2 restart lul-terminal
  logs           pm2 logs lul-terminal
  health         curl /api/health
  backup         Tar data/ (+ copy .env) into backups/
  restore-hint   Print restore instructions
  version        Print app version
  create-lul-admin  Create/update LUL admin (username lul, role admin)

Examples:
  bash scripts/one-liners.sh setup && bash scripts/one-liners.sh start
  bash scripts/one-liners.sh deploy
  bash scripts/one-liners.sh backup
  bash scripts/one-liners.sh create-lul-admin
  LUL_ADMIN_PASSWORD='YourPass' bash scripts/one-liners.sh create-lul-admin
EOF
}

cmd_doctor() {
  need_node
  log "Node $(node -v)  npm $(npm -v 2>/dev/null || echo n/a)"
  log "Root: $ROOT"
  if [[ -f package.json ]]; then
    log "package version: $(node -p "require('./package.json').version")"
  fi
  if [[ -f src/config/version.ts ]]; then
    log "APP_VERSION: $(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" src/config/version.ts | head -1)"
  fi
  [[ -f .env ]] && ok ".env present" || warn ".env missing (run setup)"
  [[ -d data ]] && ok "data/ present" || warn "data/ missing (created on first start)"
  [[ -f data/auth/lul-auth.sqlite ]] && ok "auth SQLite present" || warn "auth SQLite not yet created"
  [[ -d dist ]] && ok "dist/ present" || warn "dist/ missing (run build)"
  if command -v pm2 >/dev/null 2>&1; then ok "pm2 available"; else warn "pm2 not installed (optional)"; fi
  if command -v curl >/dev/null 2>&1; then
    if curl -sf "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null 2>&1; then
      ok "health endpoint responds on :${PORT:-3000}"
    else
      warn "health not responding on :${PORT:-3000} (app may be stopped)"
    fi
  fi
  ok "doctor done"
}

cmd_install() {
  need_node
  if [[ -f package-lock.json ]]; then
    npm ci || npm install
  else
    npm install
  fi
  ok "dependencies installed"
}

cmd_setup() {
  need_node
  ensure_env
  cmd_install
  npm run build
  ok "setup complete — run: bash scripts/one-liners.sh start"
  warn "First login: check data/auth/admin-credentials.json then change password."
}

cmd_build() {
  need_node
  npm run build
  ok "build complete → dist/"
}

cmd_lint() {
  need_node
  npm run lint
  ok "lint clean"
}

cmd_dev() {
  need_node
  ensure_env
  log "Dev server → http://0.0.0.0:3000"
  npm run dev
}

cmd_start() {
  need_node
  ensure_env
  if [[ ! -d dist ]]; then
    warn "dist/ missing — building…"
    npm run build
  fi
  log "Starting production server…"
  exec node server/start.mjs
}

cmd_stop() {
  if command -v pm2 >/dev/null 2>&1; then
    pm2 stop lul-terminal 2>/dev/null || warn "PM2 app lul-terminal not running"
    ok "stopped (pm2)"
  else
    warn "pm2 not found — stop the node process manually"
  fi
}

cmd_pm2_start() {
  need_node
  ensure_env
  command -v pm2 >/dev/null 2>&1 || die "Install PM2: npm i -g pm2"
  if [[ ! -d dist ]]; then npm run build; fi
  if pm2 describe lul-terminal >/dev/null 2>&1; then
    pm2 restart lul-terminal --update-env
  else
    pm2 start server/start.mjs --name lul-terminal
  fi
  pm2 save
  ok "pm2 lul-terminal running"
}

cmd_pm2_restart() {
  command -v pm2 >/dev/null 2>&1 || die "pm2 not installed"
  pm2 restart lul-terminal --update-env
  ok "restarted"
}

cmd_deploy() {
  need_node
  ensure_env
  log "git pull…"
  git pull --ff-only || git pull
  cmd_install
  npm run build
  if command -v pm2 >/dev/null 2>&1 && pm2 describe lul-terminal >/dev/null 2>&1; then
    pm2 restart lul-terminal --update-env
    ok "deployed + pm2 restarted"
  else
    warn "PM2 app not found — start with: bash scripts/one-liners.sh pm2-start"
    ok "code built; start manually with npm start"
  fi
}

cmd_logs() {
  command -v pm2 >/dev/null 2>&1 || die "pm2 not installed"
  pm2 logs lul-terminal
}

cmd_health() {
  local port="${PORT:-3000}"
  if [[ -f .env ]]; then
    # shellcheck disable=SC1091
    set +u
    # crude PORT from .env if set
    local envport
    envport="$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)"
    [[ -n "${envport:-}" ]] && port="$envport"
    set -u
  fi
  command -v curl >/dev/null 2>&1 || die "curl required"
  log "GET http://127.0.0.1:${port}/api/health"
  curl -sf "http://127.0.0.1:${port}/api/health" | tee /dev/stderr | grep -q '"ok"' && ok "healthy" || die "unhealthy"
}

cmd_backup() {
  mkdir -p backups
  local stamp
  stamp="$(date +%Y-%m-%d_%H%M 2>/dev/null || date +%Y-%m-%d)"
  local out="backups/lul-data-${stamp}.tgz"
  if [[ ! -d data ]]; then die "data/ missing — nothing to backup"; fi
  tar -czf "$out" data
  if [[ -f .env ]]; then
    cp .env "backups/dotenv-${stamp}.env"
    ok "also copied .env → backups/dotenv-${stamp}.env (keep private!)"
  fi
  ok "backup → $out"
  ls -lh "$out"
}

cmd_restore_hint() {
  cat <<'EOF'
Restore data/ from backup:
  1) Stop app:  bash scripts/one-liners.sh stop
  2) Move old:  mv data data.old
  3) Extract:   tar -xzf backups/lul-data-YYYY-MM-DD_HHMM.tgz
  4) Restore .env from backups/dotenv-*.env if needed
  5) Same PREMIUM_VAULT_KEY as before (vault passwords)
  6) Start:     bash scripts/one-liners.sh pm2-start
Full code+data snapshot: Backup/LUL-Terminal_FULL_*/WIEDERHERSTELLUNG.md
EOF
}

cmd_version() {
  node -p "require('./package.json').version" 2>/dev/null || true
  grep -oE "[0-9]+\.[0-9]+\.[0-9]+" src/config/version.ts 2>/dev/null | head -1 || true
}

cmd_create_lul_admin() {
  need_node
  log "Create/update LUL admin account (data/auth/lul-auth.sqlite)…"
  node scripts/create-lul-admin.mjs
  ok "create-lul-admin done"
}

main() {
  local cmd="${1:-help}"
  shift || true
  case "$cmd" in
    help|-h|--help) cmd_help ;;
    doctor) cmd_doctor ;;
    setup) cmd_setup ;;
    install) cmd_install ;;
    build) cmd_build ;;
    lint) cmd_lint ;;
    dev) cmd_dev ;;
    start) cmd_start ;;
    stop) cmd_stop ;;
    deploy) cmd_deploy ;;
    pm2-start) cmd_pm2_start ;;
    pm2-restart) cmd_pm2_restart ;;
    logs) cmd_logs ;;
    health) cmd_health ;;
    backup) cmd_backup ;;
    restore-hint) cmd_restore_hint ;;
    version) cmd_version ;;
    create-lul-admin|create_lul_admin|lul-admin) cmd_create_lul_admin ;;
    *) die "Unknown command: $cmd (try: help)" ;;
  esac
}

main "$@"
