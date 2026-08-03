# AWS Ubuntu production (VPS)

This replaces older German-only guides. For general hardening see [PRODUCTION.md](./PRODUCTION.md).

## 1. Server prep

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
# Node 20 (if not using Docker)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Open ports: `22`, `80`, `443` (and optionally `3000` only for debugging).

## 2A. Docker (recommended)

```bash
git clone https://github.com/LULdev/lul-terminal-prod.git
cd lul-terminal-prod
cp .env.example .env
nano .env   # set NODE_ENV=production, TRUST_PROXY=1, PUBLIC_BASE_URL, SEED_ADMIN_PASSWORD, PREMIUM_VAULT_KEY

docker compose up -d --build
docker compose exec lul-terminal cat data/auth/admin-credentials.json
```

Put nginx or Caddy in front for TLS; proxy to `127.0.0.1:3000`.

## 2B. PM2 (without Docker)

```bash
git clone https://github.com/LULdev/lul-terminal-prod.git && cd lul-terminal-prod
cp .env.example .env && nano .env
npm install
npm run build
sudo npm install -g pm2
pm2 start server/start.mjs --name lul-terminal
pm2 save && pm2 startup
```

Bootstrap runs automatically on start — no manual seed required.

## 3. Reverse proxy (nginx sketch)

```nginx
server {
  listen 443 ssl http2;
  server_name terminal.example.com;
  # ssl_certificate ...;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 25m;
  }
}
```

`.env` essentials behind the proxy:

```
NODE_ENV=production
TRUST_PROXY=1
PUBLIC_BASE_URL=https://terminal.example.com
ALLOWED_PUBLIC_HOSTS=terminal.example.com
```

## 4. Backup

```bash
tar -czf lul-data-$(date +%F).tar.gz data/
```

Schedule daily via cron. Restore by stopping the app, extracting, and restarting.
