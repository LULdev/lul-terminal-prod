# LUL Terminal — Vollständige Wiederherstellungsanleitung

**Backup-ID:** `LUL-Terminal_FULL_2026-08-03_2215`  
**Erstellt:** 2026-08-03 (lokaler Snapshot)  
**App-Version:** siehe `meta/app-version.txt`  
**Git HEAD:** siehe `meta/git-HEAD.txt`

> ⚠️ **SICHERHEIT:** Dieses Backup enthält **Secrets** (`.env`, Admin-Credentials, SQLite-Auth, Premium-Vault-Key).  
> Das GitHub-Repo `lul-terminal-prod` ist **öffentlich**. Nach dem Push:  
> 1. Secrets **rotieren** (Admin-Passwort, Session-Secrets, Vault-Key nur wenn neu generiert), **oder**  
> 2. Repo auf **Private** stellen / Backup in privates Repo verschieben, **oder**  
> 3. `Backup/**/secrets/` und `.env` nach Restore von GitHub löschen und nur lokal halten.

---

## Inhalt dieses Backups (KOMPLETT)

| Pfad | Inhalt |
|------|--------|
| `source/` | Gesamter Anwendungscode: `src/`, `server/`, `scripts/`, `public/`, `docs/`, Config-Dateien |
| `data/` | **Runtime-Zustand:** Auth-SQLite, Chat, Paste, Images-Meta, Games, Premium-Vault, Proxies, Analytics, … |
| `secrets/` | `.env` (als `dotenv.env`), Vault-Keys, Admin-Credentials, SQLite-Kopie |
| `archives/source.zip` | Code als ZIP |
| `archives/data.zip` | Nur `data/` |
| `archives/secrets.zip` | Nur Secrets |
| `archives/FULL-BUNDLE.zip` | Code + data + secrets + meta in einem ZIP |
| `meta/` | Git-Stand, Versionen, SHA256-Hashes |
| `MANIFEST.txt` | Dateiliste mit Größen |

**Nicht enthalten (absichtlich, wiederherstellbar):**

- `node_modules/` → `npm ci` / `npm install`
- `dist/` → `npm run build`
- `.git/` → `git clone` + optional Checkout auf `meta/git-HEAD.txt`

---

## Voraussetzungen

- **Node.js ≥ 18**
- **npm** (lockfile: `package-lock.json`)
- Optional: **PM2**, **Docker**, **nginx/Caddy**
- Linux/Ubuntu (Produktion) oder Windows (Dev)

---

## Variante A — Schnell (FULL-BUNDLE.zip)

Geeignet für neuen Server / kompletten Neuaufbau.

```bash
# 1) Zielverzeichnis
mkdir -p /opt/lul-terminal && cd /opt/lul-terminal

# 2) Bundle entpacken (Pfad anpassen)
unzip /pfad/zu/Backup/LUL-Terminal_FULL_2026-08-03_2215/archives/FULL-BUNDLE.zip -d restore-tmp

# 3) Code nach Root
cp -a restore-tmp/source/. .

# 4) Runtime-Daten
mkdir -p data
cp -a restore-tmp/data/. data/

# 5) Secrets
cp restore-tmp/secrets/dotenv.env .env
# Vault-Key (falls vorhanden):
mkdir -p data/secrets
cp -a restore-tmp/secrets/data-secrets/. data/secrets/ 2>/dev/null || true
# Auth-DB absichern (bereits unter data/auth, ggf. aus secrets spiegeln):
cp -f restore-tmp/secrets/lul-auth.sqlite data/auth/lul-auth.sqlite 2>/dev/null || true
cp -f restore-tmp/secrets/admin-credentials.json data/auth/admin-credentials.json 2>/dev/null || true

# 6) Integrität prüfen (optional)
# sha256sum archives/FULL-BUNDLE.zip  →  vergleichen mit meta/FULL-BUNDLE.sha256.txt

# 7) Dependencies + Build
npm ci
# falls npm ci scheitert:
# npm install
npm run build

# 8) Starten
# Dev:
# npm run dev
# Produktion PM2:
# pm2 start server/start.mjs --name lul-terminal
# oder:
# npm start
```

### Windows (PowerShell)

```powershell
cd C:\pfad\lul-terminal
Expand-Archive -Path .\Backup\LUL-Terminal_FULL_2026-08-03_2215\archives\FULL-BUNDLE.zip -DestinationPath .\restore-tmp -Force
Copy-Item .\restore-tmp\source\* . -Recurse -Force
New-Item -ItemType Directory -Force -Path data | Out-Null
Copy-Item .\restore-tmp\data\* .\data -Recurse -Force
Copy-Item .\restore-tmp\secrets\dotenv.env .\.env -Force
if (Test-Path .\restore-tmp\secrets\data-secrets) {
  New-Item -ItemType Directory -Force -Path data\secrets | Out-Null
  Copy-Item .\restore-tmp\secrets\data-secrets\* .\data\secrets -Recurse -Force
}
npm ci
npm run build
npm start
```

---

## Variante B — Bestehend aus Git + nur Data/Secrets

Wenn der Code bereits über Git aktuell ist:

```bash
cd /opt/lul-terminal
git fetch origin
git checkout main
# optional exakter Stand:
# git checkout $(cat Backup/.../meta/git-HEAD.txt)

# App stoppen
pm2 stop lul-terminal   # oder: systemctl stop lul-terminal

# data ersetzen
rm -rf data.old
mv data data.old 2>/dev/null || true
mkdir -p data
unzip -o Backup/LUL-Terminal_FULL_2026-08-03_2215/archives/data.zip -d data

# Secrets
cp Backup/LUL-Terminal_FULL_2026-08-03_2215/secrets/dotenv.env .env
cp -a Backup/LUL-Terminal_FULL_2026-08-03_2215/secrets/data-secrets/. data/secrets/ 2>/dev/null || true

npm ci
npm run build
pm2 restart lul-terminal
# oder: pm2 start … nach git pull && npm run build
```

---

## Variante C — Docker

```bash
# Nach Restore von Code + data + .env:
docker compose up -d --build
# Optional Redis:
# docker compose --profile with-redis up -d --build
```

`data/` muss als Volume gemountet sein (siehe `docker-compose.yml`).

---

## Checkliste nach Restore

1. **`.env` prüfen**
   - `NODE_ENV=production` (Prod)
   - `PUBLIC_BASE_URL=https://deine-domain`
   - `TRUST_PROXY=1` hinter nginx/Caddy
   - `PREMIUM_VAULT_KEY` = gleicher Key wie im Backup (sonst Vault-Passwörter unlesbar)

2. **Dateien**
   - [ ] `data/auth/lul-auth.sqlite` vorhanden
   - [ ] `data/secrets/premium-vault.key` oder Key in `.env`
   - [ ] `data/premium-accounts/accounts.json`
   - [ ] `data/chat/`, `data/paste/`, `data/games/`

3. **Start**
   ```bash
   npm run build
   node server/start.mjs
   # Health:
   curl -s http://127.0.0.1:3000/api/health
   ```

4. **Login**
   - Admin: Credentials in `data/auth/admin-credentials.json` bzw. `secrets/admin-credentials.json`
   - **Sofort Passwort ändern** nach erstem Login

5. **PM2 (Produktion)**
   ```bash
   git pull && npm run build && pm2 restart lul-terminal
   pm2 save
   ```

---

## Kritische Secrets (nicht verlieren)

| Datei / Variable | Zweck |
|------------------|--------|
| `.env` / `secrets/dotenv.env` | Alle Runtime-Env-Variablen |
| `PREMIUM_VAULT_KEY` / `data/secrets/premium-vault.key` | Entschlüsselung Premium-Accounts |
| `data/auth/lul-auth.sqlite` | User, Sessions, Coins, Achievements |
| `data/auth/admin-credentials.json` | Initiales Admin-Passwort (löschen nach Notiz) |

**Ohne Vault-Key sind verschlüsselte Premium-Passwörter (`enc:v1:…`) unlesbar.**

---

## Hash-Prüfung

```bash
# Linux
sha256sum archives/FULL-BUNDLE.zip
# muss mit meta/FULL-BUNDLE.sha256.txt übereinstimmen
```

```powershell
# Windows
Get-FileHash .\archives\FULL-BUNDLE.zip -Algorithm SHA256
Get-Content .\meta\FULL-BUNDLE.sha256.txt
```

---

## Rollback

Falls Restore fehlschlägt und `data.old` existiert:

```bash
pm2 stop lul-terminal
rm -rf data
mv data.old data
pm2 start lul-terminal
```

---

## Bekannte Grenzen dieses Snapshots

- **In-Memory-Arcade** (aktive Queues/Matches) ist nicht persistent — beim Restart werden Escrows via Boot-Refund erstattet.
- **node_modules / dist** müssen neu erzeugt werden.
- **Redis** (falls genutzt): separat sichern (`redis-cli SAVE` / RDB/AOF).
- **Öffentliches GitHub:** Secrets rotieren oder Backup privat halten.

---

## Support-Kurzform (One-Liner Prod)

```bash
# Stop → restore data+env → build → start
pm2 stop lul-terminal
cp secrets/dotenv.env .env
rsync -a data/ /opt/lul-terminal/data/
cd /opt/lul-terminal && npm ci && npm run build && pm2 restart lul-terminal
```

---

*Ende der Wiederherstellungsanleitung — LUL Terminal Full Backup*
