#!/usr/bin/env bash
#
# LUL Terminal — one-click install + dev mode (Ubuntu 22.04 / 24.04 / 26.04)
#
# Remote one-liner:
#   curl -fsSL https://raw.githubusercontent.com/LULdev/lul-terminal/main/scripts/install-ubuntu-dev.sh | bash
#
# Local (from repo):
#   chmod +x scripts/install-ubuntu-dev.sh
#   ./scripts/install-ubuntu-dev.sh
#
# Environment overrides:
#   LUL_TERMINAL_DIR=~/apps/lul-terminal
#   LUL_TERMINAL_BRANCH=main
#   LUL_TERMINAL_REPO=https://github.com/LULdev/lul-terminal.git
#   LUL_INSTALL_ONLY=1          # install deps, skip npm run dev
#   LUL_FULL_SEED=1             # run all seed:* scripts
#   LUL_NO_SEED=1               # skip seed:auth
#   LUL_NODE_MAJOR=20           # NodeSource major version
#
set -euo pipefail

readonly SCRIPT_NAME="install-ubuntu-dev.sh"
readonly DEFAULT_REPO="https://github.com/LULdev/lul-terminal.git"
readonly DEFAULT_BRANCH="main"
readonly DEFAULT_DIR="${HOME}/lul-terminal"
readonly MIN_NODE_MAJOR=18
readonly DEV_PORT="${PORT:-3000}"

LUL_TERMINAL_REPO="${LUL_TERMINAL_REPO:-$DEFAULT_REPO}"
LUL_TERMINAL_BRANCH="${LUL_TERMINAL_BRANCH:-$DEFAULT_BRANCH}"
LUL_TERMINAL_DIR="${LUL_TERMINAL_DIR:-$DEFAULT_DIR}"
LUL_NODE_MAJOR="${LUL_NODE_MAJOR:-20}"
INSTALL_ONLY="${LUL_INSTALL_ONLY:-0}"
FULL_SEED="${LUL_FULL_SEED:-0}"
NO_SEED="${LUL_NO_SEED:-0}"
SKIP_CLONE="${LUL_SKIP_CLONE:-0}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { printf '%b\n' "${CYAN}[lul-terminal]${NC} $*"; }
ok()   { printf '%b\n' "${GREEN}[lul-terminal]${NC} $*"; }
warn() { printf '%b\n' "${YELLOW}[lul-terminal]${NC} $*"; }
die()  { printf '%b\n' "${RED}[lul-terminal] ERROR:${NC} $*" >&2; exit 1; }

usage() {
  cat <<EOF
${BOLD}LUL Terminal — Ubuntu dev installer${NC}

Usage:
  ./scripts/${SCRIPT_NAME} [options]

Options:
  --dir PATH         Install directory (default: ${DEFAULT_DIR})
  --branch NAME      Git branch (default: ${DEFAULT_BRANCH})
  --repo URL         Git clone URL (default: ${DEFAULT_REPO})
  --install-only     Install and configure only; do not start dev server
  --full-seed        Run seed:auth, seed:persona-db, seed:proxy-sources, seed:news
  --no-seed          Skip seed:auth
  --skip-clone       Use current directory; do not clone or pull
  -h, --help         Show this help

One-liner (Ubuntu 22.04+ / 26.04):
  curl -fsSL https://raw.githubusercontent.com/LULdev/lul-terminal/main/scripts/${SCRIPT_NAME} | bash

Examples:
  curl -fsSL ... | LUL_TERMINAL_DIR=~/apps/lul-terminal bash
  ./scripts/${SCRIPT_NAME} --full-seed
  ./scripts/${SCRIPT_NAME} --install-only --dir .
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dir) LUL_TERMINAL_DIR="$2"; shift 2 ;;
      --branch) LUL_TERMINAL_BRANCH="$2"; shift 2 ;;
      --repo) LUL_TERMINAL_REPO="$2"; shift 2 ;;
      --install-only) INSTALL_ONLY=1; shift ;;
      --full-seed) FULL_SEED=1; shift ;;
      --no-seed) NO_SEED=1; shift ;;
      --skip-clone) SKIP_CLONE=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown option: $1 (try --help)" ;;
    esac
  done
}

have_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null
}

require_sudo() {
  if [[ "${EUID}" -eq 0 ]]; then
    SUDO=""
    return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
    return 0
  fi
  die "sudo is required to install system packages."
}

check_os() {
  if [[ ! -f /etc/os-release ]]; then
    die "This script targets Ubuntu. /etc/os-release not found."
  fi
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *"ubuntu"* && "${ID_LIKE:-}" != *"debian"* ]]; then
    warn "Detected ID=${ID:-unknown}. Continuing anyway (Debian-family expected)."
  else
    log "Detected ${PRETTY_NAME:-Ubuntu}."
  fi
  if [[ "${ID:-}" == "ubuntu" && -n "${VERSION_ID:-}" ]]; then
    local major="${VERSION_ID%%.*}"
    if [[ "${major}" -lt 22 ]]; then
      die "Ubuntu ${VERSION_ID} is too old. Use Ubuntu 22.04 LTS or newer (incl. 26.04)."
    fi
  fi
}

check_not_root_user() {
  if [[ "${EUID}" -eq 0 ]]; then
    die "Do not run as root. Use a normal user with sudo (npm install runs as your user)."
  fi
}

install_system_packages() {
  require_sudo
  log "Installing system packages (git, curl, build tools)..."
  ${SUDO} apt-get update -qq
  ${SUDO} DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    ca-certificates \
    curl \
    git \
    gnupg \
    build-essential \
    python3 \
    >/dev/null
  ok "System packages ready."
}

node_major_version() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0
}

install_node() {
  local current_major
  current_major="$(node_major_version)"
  if [[ "${current_major}" -ge "${MIN_NODE_MAJOR}" ]]; then
    ok "Node.js $(node -v) already installed (>= v${MIN_NODE_MAJOR})."
    return 0
  fi

  log "Installing Node.js ${LUL_NODE_MAJOR}.x via NodeSource..."
  require_sudo
  local setup_script="/tmp/nodesource-setup-${LUL_NODE_MAJOR}.sh"
  curl -fsSL "https://deb.nodesource.com/setup_${LUL_NODE_MAJOR}.x" -o "${setup_script}"
  ${SUDO} bash "${setup_script}" >/dev/null
  ${SUDO} DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
  rm -f "${setup_script}"

  current_major="$(node_major_version)"
  if [[ "${current_major}" -lt "${MIN_NODE_MAJOR}" ]]; then
    die "Node.js install failed (got v$(node -v), need >= v${MIN_NODE_MAJOR})."
  fi
  ok "Node.js $(node -v) / npm $(npm -v) installed."
}

is_lul_terminal_repo() {
  [[ -f package.json ]] && grep -q '"name"[[:space:]]*:[[:space:]]*"lul-terminal"' package.json 2>/dev/null
}

resolve_project_dir() {
  if [[ "${SKIP_CLONE}" == "1" ]]; then
    if is_lul_terminal_repo; then
      LUL_TERMINAL_DIR="$(pwd)"
      log "Using current directory: ${LUL_TERMINAL_DIR}"
      return 0
    fi
    die "--skip-clone set but $(pwd) is not a lul-terminal repo (missing package.json)."
  fi

  if is_lul_terminal_repo && [[ "$(realpath "${LUL_TERMINAL_DIR}" 2>/dev/null || echo "")" == "$(pwd)" ]]; then
    SKIP_CLONE=1
    log "Already inside lul-terminal repo: $(pwd)"
    return 0
  fi

  if [[ -d "${LUL_TERMINAL_DIR}/.git" ]] && [[ -f "${LUL_TERMINAL_DIR}/package.json" ]]; then
    log "Updating existing clone at ${LUL_TERMINAL_DIR}..."
    git -C "${LUL_TERMINAL_DIR}" fetch origin "${LUL_TERMINAL_BRANCH}" --quiet
    git -C "${LUL_TERMINAL_DIR}" checkout "${LUL_TERMINAL_BRANCH}" --quiet 2>/dev/null || true
    git -C "${LUL_TERMINAL_DIR}" pull --ff-only origin "${LUL_TERMINAL_BRANCH}" --quiet || \
      warn "git pull skipped (local changes or diverged branch)."
    return 0
  fi

  log "Cloning ${LUL_TERMINAL_REPO} (branch ${LUL_TERMINAL_BRANCH}) → ${LUL_TERMINAL_DIR}"
  mkdir -p "$(dirname "${LUL_TERMINAL_DIR}")"
  git clone --depth 1 --branch "${LUL_TERMINAL_BRANCH}" "${LUL_TERMINAL_REPO}" "${LUL_TERMINAL_DIR}"
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

ensure_env_file() {
  local env_file="${LUL_TERMINAL_DIR}/.env"
  local example="${LUL_TERMINAL_DIR}/.env.example"

  if [[ -f "${env_file}" ]]; then
    ok ".env already exists — leaving unchanged."
    return 0
  fi

  if [[ ! -f "${example}" ]]; then
    die ".env.example missing in ${LUL_TERMINAL_DIR}"
  fi

  cp "${example}" "${env_file}"

  local vault_key
  vault_key="$(random_hex)"

  # Dev-friendly defaults with unique vault key
  if grep -q '^NODE_ENV=' "${env_file}"; then
    sed -i 's/^NODE_ENV=.*/NODE_ENV=development/' "${env_file}"
  else
    echo "NODE_ENV=development" >> "${env_file}"
  fi

  if grep -q '^PORT=' "${env_file}"; then
    sed -i "s/^PORT=.*/PORT=${DEV_PORT}/" "${env_file}"
  fi

  if grep -q '^TRUST_PROXY=' "${env_file}"; then
    sed -i 's/^TRUST_PROXY=.*/TRUST_PROXY=0/' "${env_file}"
  fi

  if grep -q '^PREMIUM_VAULT_KEY=' "${env_file}"; then
    sed -i "s/^PREMIUM_VAULT_KEY=.*/PREMIUM_VAULT_KEY=${vault_key}/" "${env_file}"
  fi

  ok "Created .env from .env.example (dev defaults, random PREMIUM_VAULT_KEY)."
  warn "Admin credentials are auto-created on first start → data/auth/admin-credentials.json"
}

read_env_value() {
  local key="$1"
  local file="${LUL_TERMINAL_DIR}/.env"
  if [[ -f "${file}" ]]; then
    grep -E "^${key}=" "${file}" 2>/dev/null | head -n1 | cut -d= -f2- || true
  fi
}

npm_install() {
  log "Running npm install (may take 1–3 minutes)..."
  cd "${LUL_TERMINAL_DIR}"
  npm install --no-audit --no-fund
  ok "npm install complete."
}

run_seeds() {
  cd "${LUL_TERMINAL_DIR}"
  if [[ "${NO_SEED}" == "1" ]]; then
    warn "Skipping seeds (--no-seed)."
    return 0
  fi

  log "Bootstrapping auth (Administrator + system bot only; no demo users)..."
  npm run bootstrap

  if [[ "${FULL_SEED}" == "1" ]]; then
    log "Running optional catalog seeds (persona/proxy/news — not user accounts)..."
    npm run seed:persona-db || true
    npm run seed:proxy-sources || true
    npm run seed:news || true
    ok "Optional catalog seeds finished."
  else
    ok "Auth bootstrap complete (auto-runs on server start as well)."
  fi
}

check_port() {
  if command -v ss >/dev/null 2>&1; then
    if ss -tln | grep -q ":${DEV_PORT} "; then
      warn "Port ${DEV_PORT} appears to be in use. Stop the other process or set PORT in .env."
    fi
  fi
}

print_summary() {
  cat <<EOF

${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${GREEN}${BOLD}  LUL Terminal — dev install complete${NC}
${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

  Directory:  ${LUL_TERMINAL_DIR}
  Mode:       development (npm run dev)
  URL:        http://localhost:${DEV_PORT}
              http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1'):${DEV_PORT}

  Admin login:
    Username: Administrator
    Password: see ${LUL_TERMINAL_DIR}/data/auth/admin-credentials.json
              (or SEED_ADMIN_PASSWORD from .env if you set it before first start)

  Next time:
    cd ${LUL_TERMINAL_DIR} && npm run dev

  Production:
    docker compose up -d --build
    # or: npm run lint && npm run build && npm start

${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

EOF
}

start_dev() {
  if [[ "${INSTALL_ONLY}" == "1" ]]; then
    ok "Install-only mode — not starting dev server."
    print_summary
    return 0
  fi

  check_port
  print_summary
  log "Starting dev server (Ctrl+C to stop)..."
  cd "${LUL_TERMINAL_DIR}"
  exec npm run dev
}

main() {
  parse_args "$@"
  check_not_root_user
  check_os
  install_system_packages
  install_node
  resolve_project_dir
  ensure_env_file
  npm_install
  run_seeds
  start_dev
}

main "$@"