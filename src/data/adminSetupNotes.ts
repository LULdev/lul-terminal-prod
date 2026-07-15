/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AdminSetupNote = {
  id: string;
  title: string;
  body: string;
  category: 'deployment' | 'security' | 'database' | 'general';
  envVar?: string;
  highlight?: boolean;
};

/** Quick install checklist — mirrored in README.md (Installationsanleitung). */
export const INSTALLATION_STEPS = [
  { step: 1, title: 'Repository klonen', command: 'git clone https://github.com/LULdev/lul-terminal.git && cd lul-terminal' },
  { step: 2, title: 'Node.js 18+ prüfen', command: 'node -v' },
  { step: 3, title: 'Abhängigkeiten installieren', command: 'npm install' },
  { step: 4, title: 'Umgebung konfigurieren', command: 'copy .env.example .env   # Windows\n# cp .env.example .env   # Linux/macOS' },
  { step: 5, title: 'Optional: Seed-Daten', command: 'npm run seed:auth && npm run seed:persona-db && npm run seed:proxy-sources && npm run seed:news' },
  { step: 6, title: 'Entwicklung starten', command: 'npm run dev' },
  { step: 7, title: 'Produktion bauen & starten', command: 'npm run build && npm start' },
] as const;

export const ADMIN_SETUP_NOTES: AdminSetupNote[] = [
  {
    id: 'trust-proxy',
    title: 'Reverse proxy & rate limits',
    category: 'deployment',
    envVar: 'TRUST_PROXY=1',
    highlight: true,
    body: 'Set TRUST_PROXY=1 in production when the app runs behind a reverse proxy (nginx, Caddy, Cloudflare, Vercel, etc.). Without it, rate limits use the socket IP instead of the real client. With TRUST_PROXY enabled, clientIp() reads the first X-Forwarded-For hop and Express trust proxy is enabled in server/start.mjs.',
  },
  {
    id: 'node-env',
    title: 'Production cookies',
    category: 'security',
    envVar: 'NODE_ENV=production',
    highlight: true,
    body: 'Set NODE_ENV=production in production so session cookies get the Secure flag. Serve the app over HTTPS when using a reverse proxy.',
  },
  {
    id: 'seed-passwords',
    title: 'First-run admin accounts',
    category: 'security',
    envVar: 'SEED_ADMIN_PASSWORD / SEED_VIP_PASSWORD',
    body: 'Auth uses SQLite (data/auth/lul-auth.sqlite). On empty DB the server seeds Administrator + VIPTestUser (Test123456), bot, and 20 demo users. Demo passwords: data/auth/demo-credentials.json. Reset: npm run seed:auth:reset.',
  },
  {
    id: 'premium-vault',
    title: 'Premium vault encryption',
    category: 'security',
    envVar: 'PREMIUM_VAULT_KEY',
    body: 'PREMIUM_VAULT_KEY encrypts premium account passwords at rest. Required in production. Use a long random secret (32+ chars). Without it, dev uses a fixed dev key — never deploy that to production.',
  },
  {
    id: 'data-persist',
    title: 'Persist the data/ directory',
    category: 'database',
    body: 'All JSON stores (auth, chat, games, paste, images meta, analytics, proxy DB, etc.) live under data/. Mount or back up this folder on self-hosted deployments. image-host files and proxy scraper runtime state are gitignored.',
  },
  {
    id: 'port',
    title: 'Listen port',
    category: 'deployment',
    envVar: 'PORT=3000',
    body: 'Default port is 3000. Override with PORT in .env. In production use npm run build then npm start (Express serves dist/ + API). Dev uses Vite on the same port with API middleware.',
  },
  {
    id: 'github-readme',
    title: 'Full install guide',
    category: 'general',
    body: 'See README.md in the repository root for the complete step-by-step Installationsanleitung (DE), environment table, nginx example, and GitHub deployment notes.',
  },
];