# LUL Terminal auf AWS (Ubuntu 26.04) — Komplette Anleitung

Von **null** bis zur **laufenden Produktions-Instanz** auf einem Amazon EC2 VPS mit **Ubuntu 26.04 LTS**.

| Ziel | Ergebnis |
|------|----------|
| Öffentliche URL | `https://terminal.deine-domain.de` |
| Server-Prozess | PM2 (Autostart nach Reboot) |
| Reverse-Proxy | nginx + Let's Encrypt (HTTPS) |
| Daten | JSON unter `data/` auf dem Server |

**Repository:** [github.com/LULdev/lul-terminal](https://github.com/LULdev/lul-terminal)

---

## Inhaltsverzeichnis

1. [Überblick](#1-überblick)
2. [Voraussetzungen](#2-voraussetzungen)
3. [Teil A — EC2 Instanz anlegen](#teil-a--ec2-instanz-anlegen)
4. [Teil B — SSH-Verbindung](#teil-b--ssh-verbindung)
5. [Teil C — Server vorbereiten](#teil-c--server-vorbereiten)
6. [Teil D — LUL Terminal installieren](#teil-d--lul-terminal-installieren)
7. [Teil E — Produktion bauen & PM2](#teil-e--produktion-bauen--pm2)
8. [Teil F — Domain & DNS](#teil-f--domain--dns)
9. [Teil G — nginx + HTTPS](#teil-g--nginx--https)
10. [Teil H — Firewall](#teil-h--firewall)
11. [Teil I — Erster Login](#teil-i--erster-login)
12. [Teil J — Backup & Updates](#teil-j--backup--updates)
13. [Optional — Dev-Modus](#optional--dev-modus)
14. [Fehlerbehebung](#fehlerbehebung)
15. [Checkliste](#checkliste)

---

## 1. Überblick

```
Internet
   │
   ▼
[ AWS Security Group ]   Port 22, 80, 443
   │
   ▼
[ EC2 Ubuntu 26.04 ]
   │
   ├── nginx :443  ──►  Express :3000  (PM2: lul-terminal)
   │                      ├── /api/*
   │                      ├── dist/  (React SPA)
   │                      └── data/   (JSON-Stores)
   │
   └── certbot (Let's Encrypt)
```

| Modus | Befehl | Wann |
|-------|--------|------|
| **Entwicklung** | `npm run dev` | Nur lokal testen, Hot-Reload |
| **Produktion** | `npm run build` + `npm start` (PM2) | Öffentlicher VPS — **empfohlen** |

> Port **3000** bleibt intern. Nach außen nur **80/443** über nginx.

---

## 2. Voraussetzungen

| Was | Details |
|-----|---------|
| AWS-Konto | [aws.amazon.com](https://aws.amazon.com) |
| Domain | z. B. `terminal.deine-domain.de` (Route 53 oder extern) |
| SSH-Client | PowerShell, Windows Terminal, PuTTY |
| Instance | **t3.small** (2 GB RAM) empfohlen |
| Speicher | **30 GiB** gp3 |

---

## Teil A — EC2 Instanz anlegen

### A1 — EC2 starten

1. [AWS Console](https://console.aws.amazon.com) → Region wählen (z. B. `eu-central-1`)
2. **EC2** → **Launch instances**

### A2 — Konfiguration

| Feld | Wert |
|------|------|
| Name | `lul-terminal` |
| AMI | **Ubuntu Server 26.04 LTS** (64-bit x86) |
| Instance type | `t3.small` |

> Falls 26.04 nicht verfügbar: **Ubuntu 24.04 LTS** — gleiche Schritte.

### A3 — Key Pair

1. **Create new key pair** → Name `lul-terminal-key`, Format **`.pem`**
2. Datei sicher speichern

**Windows — Rechte (einmalig):**

```powershell
icacls "$env:USERPROFILE\Downloads\lul-terminal-key.pem" /inheritance:r
icacls "$env:USERPROFILE\Downloads\lul-terminal-key.pem" /grant:r "$($env:USERNAME):(R)"
```

### A4 — Security Group

| Typ | Port | Quelle |
|-----|------|--------|
| SSH | **22** | Deine IP |
| HTTP | **80** | `0.0.0.0/0` |
| HTTPS | **443** | `0.0.0.0/0` |

### A5 — Storage & Launch

- **30 GiB** gp3
- **Launch instance** → Status **running**, **2/2 checks passed**

### A6 — Elastic IP

1. **Elastic IPs** → **Allocate** → **Associate** mit der Instance
2. IP notieren (z. B. `3.120.45.67`)

---

## Teil B — SSH-Verbindung

**Linux / macOS:**

```bash
chmod 400 ~/Downloads/lul-terminal-key.pem
ssh -i ~/Downloads/lul-terminal-key.pem ubuntu@DEINE_ELASTIC_IP
```

**Windows PowerShell:**

```powershell
ssh -i "$env:USERPROFILE\Downloads\lul-terminal-key.pem" ubuntu@DEINE_ELASTIC_IP
```

Standard-User: **`ubuntu`**

---

## Teil C — Server vorbereiten

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git gnupg build-essential python3 ufw
```

**Node.js 20:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

**Zeitzone (optional):**

```bash
sudo timedatectl set-timezone Europe/Berlin
```

**Firewall vorbereiten:**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
```

---

## Teil D — LUL Terminal installieren

### D1 — Repository

```bash
cd ~
git clone https://github.com/LULdev/lul-terminal.git
cd lul-terminal
git pull origin main
npm install
```

### D2 — `.env` (Produktion)

```bash
cp .env.example .env
nano .env
```

**Mindest-Konfiguration:**

```env
NODE_ENV=production
PORT=3000
TRUST_PROXY=1

PUBLIC_BASE_URL=https://terminal.deine-domain.de
ALLOWED_PUBLIC_HOSTS=terminal.deine-domain.de

SEED_ADMIN_PASSWORD=StarkesAdminPasswort!
SEED_VIP_PASSWORD=StarkesVipPasswort!
PREMIUM_VAULT_KEY=<openssl rand -base64 32>
```

**Secrets generieren:**

```bash
openssl rand -base64 32
```

| Variable | Wann Pflicht |
|----------|--------------|
| `SEED_ADMIN_PASSWORD` | Vor erstem Start (leere `users.json`) |
| `SEED_VIP_PASSWORD` | Vor erstem Start |
| `PREMIUM_VAULT_KEY` | Immer in Produktion |
| `PUBLIC_BASE_URL` | Sobald HTTPS + Domain aktiv |
| `TRUST_PROXY` | Immer hinter nginx |

> **Vor HTTPS (nur IP-Test):** `PUBLIC_BASE_URL` weglassen. Session-Cookies nutzen `Secure` erst bei `https://` in `PUBLIC_BASE_URL`. Optional: `COOKIE_SECURE=0` erzwingen.

### D3 — Seed (erste Installation)

```bash
npm run seed:auth
```

Optional Demo-Daten:

```bash
npm run seed:persona-db
npm run seed:proxy-sources
npm run seed:news
```

---

## Teil E — Produktion bauen & PM2

### E1 — Build

```bash
cd ~/lul-terminal
npm run lint
npm run build
ls dist/index.html
```

### E2 — PM2

```bash
sudo npm install -g pm2
pm2 start server/start.mjs --name lul-terminal
pm2 status
pm2 logs lul-terminal --lines 30
```

### E3 — Autostart

```bash
pm2 save
pm2 startup
```

Den ausgegebenen **`sudo env PATH=...`** Befehl ausführen, dann erneut `pm2 save`.

### E4 — Lokaler Test

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

Erwartung: **200**

### PM2 Referenz

| Befehl | Wirkung |
|--------|---------|
| `pm2 status` | Status |
| `pm2 logs lul-terminal` | Logs live |
| `pm2 restart lul-terminal` | Nach Update |
| `pm2 stop lul-terminal` | Stoppen |

---

## Teil F — Domain & DNS

**A-Record** (Route 53 oder extern):

| Typ | Name | Wert |
|-----|------|------|
| A | `terminal` | Elastic IP |

Prüfen:

```bash
dig +short terminal.deine-domain.de
```

`.env` anpassen und neu starten:

```bash
nano ~/lul-terminal/.env
pm2 restart lul-terminal
```

---

## Teil G — nginx + HTTPS

### G1 — nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### G2 — Site

```bash
sudo nano /etc/nginx/sites-available/lul-terminal
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name terminal.deine-domain.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/lul-terminal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### G3 — Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d terminal.deine-domain.de
sudo certbot renew --dry-run
```

Nach Certbot in `.env` setzen:

```env
PUBLIC_BASE_URL=https://terminal.deine-domain.de
ALLOWED_PUBLIC_HOSTS=terminal.deine-domain.de
```

```bash
pm2 restart lul-terminal
```

---

## Teil H — Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

Erwartung: **22**, **80**, **443** — Port **3000** nicht öffentlich.

---

## Teil I — Erster Login

1. Browser: `https://terminal.deine-domain.de`
2. **Sign in**
3. Benutzer: **`Administrator`** oder **`administrator@lul.terminal`**
4. Passwort: **`Test123456`** (Standard-Seed)

| Login | Rolle | Passwort |
|-------|-------|----------|
| `Administrator` | Admin | `Test123456` |
| `VIPTestUser` | VIP | `Test123456` |

20 Demo-User: `data/auth/demo-credentials.json` nach `npm run seed:auth`

**Checks nach Login:**

- [ ] Admin-Dashboard erreichbar
- [ ] Changelog zeigt aktuelle Version
- [ ] Paste/Image-Links nutzen `PUBLIC_BASE_URL` (nicht `localhost`)

---

## Teil J — Backup & Updates

### Backup `data/`

```bash
mkdir -p ~/backups
tar -czf ~/backups/lul-data-$(date +%F).tar.gz -C ~/lul-terminal data
```

`.env` separat sichern.

**Cron (täglich 3:00):**

```bash
crontab -e
```

```cron
0 3 * * * tar -czf /home/ubuntu/backups/lul-data-$(date +\%F).tar.gz -C /home/ubuntu/lul-terminal data
```

### Update

```bash
tar -czf ~/backups/lul-pre-update.tar.gz -C ~/lul-terminal data
pm2 stop lul-terminal
cd ~/lul-terminal
git pull origin main
npm install
npm run lint && npm run build
pm2 restart lul-terminal
pm2 logs lul-terminal --lines 20
```

### AWS EBS-Snapshot

EC2 → **Volumes** → **Create snapshot** (wöchentlich empfohlen).

---

## Optional — Dev-Modus

Nur für interne Tests — **nicht** für öffentlichen Produktionsbetrieb:

```bash
curl -fsSL https://raw.githubusercontent.com/LULdev/lul-terminal/main/scripts/install-ubuntu-dev.sh | bash
```

Details: [README → Ubuntu One-Click (Dev)](../README.md#ubuntu-one-click-dev)

---

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| SSH `Permission denied` | `chmod 400 key.pem`, User `ubuntu` |
| Build OOM | Instance auf `t3.small` upgraden |
| Seite nicht erreichbar | Security Group 80/443; `sudo ufw status` |
| `502 Bad Gateway` | `pm2 status`; `curl http://127.0.0.1:3000` |
| Login-Modal bleibt offen | Benutzer `admin` (nicht nur E-Mail); `git pull` für neuesten Fix |
| Login scheint ok, sofort ausgeloggt | `PUBLIC_BASE_URL=https://…` nach Certbot; oder vor HTTPS `COOKIE_SECURE=0` |
| Falsches Passwort | `SEED_ADMIN_PASSWORD` in `.env`; `npm run seed:auth` wenn DB leer |
| Rate-Limits eine IP | `TRUST_PROXY=1` in `.env` |
| Share-Links `localhost` | `PUBLIC_BASE_URL` setzen, `pm2 restart` |
| Certbot fehlgeschlagen | DNS A-Record prüfen; Port 80 erreichbar |
| Nach Reboot offline | `pm2 startup` + `pm2 save` |

**Logs:**

```bash
pm2 logs lul-terminal --lines 100
sudo tail -f /var/log/nginx/error.log
```

**Issues:** [github.com/LULdev/lul-terminal/issues](https://github.com/LULdev/lul-terminal/issues)

---

## Checkliste

### AWS & Netzwerk

- [ ] EC2 Ubuntu 26.04 (oder 24.04) running
- [ ] Elastic IP zugewiesen
- [ ] Security Group: 22 (deine IP), 80, 443
- [ ] DNS A-Record → Elastic IP

### Installation

- [ ] Node.js 20
- [ ] `git clone` + `npm install`
- [ ] `.env` mit Prod-Secrets, `TRUST_PROXY=1`
- [ ] `npm run seed:auth`
- [ ] `npm run lint && npm run build`

### Betrieb

- [ ] PM2 `lul-terminal` running + `pm2 startup`
- [ ] nginx + Certbot HTTPS
- [ ] `PUBLIC_BASE_URL` gesetzt
- [ ] UFW aktiv
- [ ] Login `admin` funktioniert
- [ ] Backup-Plan für `data/`

---

*Stand: LUL Terminal v3.46.0+ — bei Updates `git pull` und [README](../README.md) prüfen.*