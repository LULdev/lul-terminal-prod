# LUL Terminal - comfort one-liners (Windows PowerShell)
# Usage:  .\scripts\one-liners.ps1 <command>
#         .\scripts\one-liners.ps1 help

param(
  [Parameter(Position = 0)]
  [string]$Command = "help"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Write-Lul([string]$msg) { Write-Host "[lul] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)  { Write-Host "[ok] $msg" -ForegroundColor Green }
function Write-Warn([string]$msg){ Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Die([string]$msg)       { Write-Host "[err] $msg" -ForegroundColor Red; exit 1 }

function Need-Node {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Die "Node.js >= 18 required. Install: https://nodejs.org"
  }
  $major = [int](node -p "process.versions.node.split('.')[0]")
  if ($major -lt 18) { Die "Node >= 18 required (found $(node -v))" }
}

function Ensure-Env {
  if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
      Copy-Item .env.example .env
      Write-Warn "Created .env from .env.example - edit before production."
    } else {
      Die "No .env or .env.example"
    }
  }
}

function Cmd-Help {
  Write-Host @"
LUL Terminal one-liners (PowerShell)
====================================
  help           This help
  doctor         Check Node, .env, data/, health
  setup          First install: .env + npm ci + build
  install        npm ci (fallback npm install)
  build          Production build (dist/)
  lint           Typecheck (tsc --noEmit)
  dev            Dev server (Vite :3000)
  start          Production start (node server/start.mjs)
  stop           Stop PM2 app lul-terminal
  deploy         git pull + npm ci + build + pm2 restart
  pm2-start      pm2 start/restart production process
  pm2-restart    pm2 restart lul-terminal
  logs           pm2 logs lul-terminal
  health         Invoke /api/health
  backup         Zip data/ and copy .env into backups/
  restore-hint   Print restore instructions
  version        Print app version

Examples:
  .\scripts\one-liners.ps1 setup
  .\scripts\one-liners.ps1 start
  .\scripts\one-liners.ps1 deploy
  .\scripts\one-liners.ps1 backup
"@
}

function Cmd-Doctor {
  Need-Node
  Write-Lul "Node $(node -v)  npm $(npm -v)"
  Write-Lul "Root: $Root"
  if (Test-Path package.json) {
    $v = (Get-Content package.json -Raw | ConvertFrom-Json).version
    Write-Lul "package version: $v"
  }
  if (Test-Path .env) { Write-Ok ".env present" } else { Write-Warn ".env missing" }
  if (Test-Path data) { Write-Ok "data/ present" } else { Write-Warn "data/ missing" }
  if (Test-Path "data\auth\lul-auth.sqlite") { Write-Ok "auth SQLite present" } else { Write-Warn "auth SQLite not yet created" }
  if (Test-Path dist) { Write-Ok "dist/ present" } else { Write-Warn "dist/ missing (run build)" }
  if (Get-Command pm2 -ErrorAction SilentlyContinue) { Write-Ok "pm2 available" } else { Write-Warn "pm2 not installed (optional)" }
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 3
    if ($r.Content -match '"ok"') { Write-Ok "health endpoint responds" } else { Write-Warn "health unexpected body" }
  } catch {
    Write-Warn "health not responding on :3000 (app may be stopped)"
  }
  Write-Ok "doctor done"
}

function Cmd-Install {
  Need-Node
  if (Test-Path package-lock.json) {
    try { npm ci } catch { npm install }
  } else {
    npm install
  }
  Write-Ok "dependencies installed"
}

function Cmd-Setup {
  Need-Node
  Ensure-Env
  Cmd-Install
  npm run build
  Write-Ok "setup complete - run: .\scripts\one-liners.ps1 start"
  Write-Warn "First login: check data\auth\admin-credentials.json then change password."
}

function Cmd-Build {
  Need-Node
  npm run build
  Write-Ok "build complete -> dist/"
}

function Cmd-Lint {
  Need-Node
  npm run lint
  Write-Ok "lint clean"
}

function Cmd-Dev {
  Need-Node
  Ensure-Env
  Write-Lul "Dev server -> http://0.0.0.0:3000"
  npm run dev
}

function Cmd-Start {
  Need-Node
  Ensure-Env
  if (-not (Test-Path dist)) {
    Write-Warn "dist/ missing - building..."
    npm run build
  }
  Write-Lul "Starting production server..."
  node server/start.mjs
}

function Cmd-Stop {
  if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    try { pm2 stop lul-terminal } catch { Write-Warn "PM2 app not running" }
    Write-Ok "stopped (pm2)"
  } else {
    Write-Warn "pm2 not found - stop the node process manually"
  }
}

function Cmd-Pm2Start {
  Need-Node
  Ensure-Env
  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) { Die "Install PM2: npm i -g pm2" }
  if (-not (Test-Path dist)) { npm run build }
  $exists = $false
  try {
    $null = pm2 describe lul-terminal 2>$null
    if ($LASTEXITCODE -eq 0) { $exists = $true }
  } catch {
    $exists = $false
  }
  if ($exists) {
    pm2 restart lul-terminal --update-env
  } else {
    pm2 start server/start.mjs --name lul-terminal
  }
  pm2 save
  Write-Ok "pm2 lul-terminal running"
}

function Cmd-Pm2Restart {
  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) { Die "pm2 not installed" }
  pm2 restart lul-terminal --update-env
  Write-Ok "restarted"
}

function Cmd-Deploy {
  Need-Node
  Ensure-Env
  Write-Lul "git pull..."
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) { git pull }
  Cmd-Install
  npm run build
  if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    try {
      $null = pm2 describe lul-terminal 2>$null
      if ($LASTEXITCODE -eq 0) {
        pm2 restart lul-terminal --update-env
        Write-Ok "deployed + pm2 restarted"
      } else {
        Write-Warn "PM2 app not found - run: .\scripts\one-liners.ps1 pm2-start"
      }
    } catch {
      Write-Warn "PM2 app not found - run: .\scripts\one-liners.ps1 pm2-start"
    }
  } else {
    Write-Warn "pm2 not installed - start with npm start or pm2-start"
  }
}

function Cmd-Logs {
  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) { Die "pm2 not installed" }
  pm2 logs lul-terminal
}

function Cmd-Health {
  $port = 3000
  if (Test-Path .env) {
    $line = Get-Content .env | Where-Object { $_ -match '^\s*PORT=' } | Select-Object -Last 1
    if ($line) { $port = ($line -split '=', 2)[1].Trim() }
  }
  Write-Lul "GET http://127.0.0.1:$port/api/health"
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 5
  Write-Host $r.Content
  if ($r.Content -notmatch '"ok"') { Die "unhealthy" }
  Write-Ok "healthy"
}

function Cmd-Backup {
  New-Item -ItemType Directory -Force -Path backups | Out-Null
  $stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
  if (-not (Test-Path data)) { Die "data/ missing" }
  $zip = "backups\lul-data-$stamp.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path (Join-Path data '*') -DestinationPath $zip -Force
  if (Test-Path .env) {
    Copy-Item .env "backups\dotenv-$stamp.env" -Force
    Write-Ok "also copied .env to backups\dotenv-$stamp.env (keep private!)"
  }
  Write-Ok "backup -> $zip"
  Get-Item $zip | Format-List Name, Length, FullName
}

function Cmd-RestoreHint {
  Write-Host @"
Restore data\ from backup:
  1) Stop:   .\scripts\one-liners.ps1 stop
  2) Rename: Rename-Item data data.old
  3) Expand: Expand-Archive backups\lul-data-DATE.zip -DestinationPath data
  4) Restore .env from backups\dotenv-*.env
  5) Same PREMIUM_VAULT_KEY as before
  6) Start:  .\scripts\one-liners.ps1 pm2-start
Full snapshot: Backup\LUL-Terminal_FULL_*\WIEDERHERSTELLUNG.md
"@
}

function Cmd-Version {
  if (Test-Path package.json) {
    (Get-Content package.json -Raw | ConvertFrom-Json).version
  }
  if (Test-Path "src\config\version.ts") {
    Select-String -Path "src\config\version.ts" -Pattern "\d+\.\d+\.\d+" | ForEach-Object { $_.Matches.Value } | Select-Object -First 1
  }
}

switch ($Command.ToLower()) {
  "help" { Cmd-Help }
  "doctor" { Cmd-Doctor }
  "setup" { Cmd-Setup }
  "install" { Cmd-Install }
  "build" { Cmd-Build }
  "lint" { Cmd-Lint }
  "dev" { Cmd-Dev }
  "start" { Cmd-Start }
  "stop" { Cmd-Stop }
  "deploy" { Cmd-Deploy }
  "pm2-start" { Cmd-Pm2Start }
  "pm2-restart" { Cmd-Pm2Restart }
  "logs" { Cmd-Logs }
  "health" { Cmd-Health }
  "backup" { Cmd-Backup }
  "restore-hint" { Cmd-RestoreHint }
  "version" { Cmd-Version }
  default { Die "Unknown command: $Command (try: help)" }
}
