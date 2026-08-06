/**
 * Generate 20 LUL Terminal guest index variants + catalog + German descriptions.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');

/** @type {Array<{
 *  id: string, name: string, angle: string, layout?: string,
 *  primary: string, primary2: string, accent: string, glow: string,
 *  kicker: string, title: string, lead: string,
 *  ctaPrimary: string, ctaSecondary: string,
 *  termLines: string[], lock: string,
 *  modules: [string, string, string, string][],
 *  stats: [string, string][],
 *  desc: { content: string, functions: string, purpose: string }
 * }>} */
const variants = [
  {
    id: '01-terminal-boot',
    name: 'Terminal Boot',
    angle: 'Klassischer System-Boot',
    kicker: 'guest session · read-only',
    title: 'Welcome to <span class="grad">LUL Terminal</span>',
    lead: 'Self-hosted community hub: tools, paste, image host, arcade and pulse stats. Browse as guest — save progress when you sign in.',
    ctaPrimary: 'Create free account',
    ctaSecondary: 'Browse public tools',
    primary: '#22d3ee', primary2: '#a78bfa', accent: '#34d399', glow: 'rgba(34,211,238,.3)',
    termLines: [
      '<span class="dim">$</span> <span class="hi">lul-terminal</span> --guest',
      '<span class="ok">✓</span> modules: paste · image · tools · games',
      '<span class="ok">✓</span> session: guest (no write persistence)',
      '<span class="warn">→</span> register to unlock coins, profile & queues',
    ],
    lock: 'Profiles, LULcoins, matchmaking and private pastes need an account.',
    modules: [
      ['📋', 'Paste', 'Share snippets with expiry & password options.', 'Guest: public reads'],
      ['☁️', 'Image Host', 'Upload & gallery when signed in.', 'Preview UI'],
      ['🎲', 'Arcade', 'RPS, dice, jackpot with LULcoins.', 'Login to play'],
      ['🛠️', 'Labs', 'Net toolkit, text lab, identity forge.', 'Many guest-safe'],
    ],
    stats: [['Live', 'pulse'], ['Arcade', 'ready'], ['Tools', 'online'], ['Auth', 'optional']],
    desc: {
      content: 'Boot-Hero mit Terminal-Panel, Modul-Kacheln (Paste/Image/Games/Labs), Live-Stats, Lock-Hinweis, CTA Register/Login.',
      functions: 'Öffentliche Bereiche ansehen, Tool-Teaser, FAQ/Changelog-Links (Konzept), Registrieren/Anmelden.',
      purpose: 'Sofortige Markenklarheit: „Was ist LUL Terminal?“ + sanfte Conversion.',
    },
  },
  {
    id: '02-arcade-first',
    name: 'Arcade First',
    angle: 'Games & LULcoins im Fokus',
    layout: 'layout-dense',
    kicker: 'LULcoins · fair play',
    title: 'Play the terminal. <span class="grad">Win the jackpot.</span>',
    lead: 'RPS, Tic-Tac-Toe, dice & more — escrow-safe stakes, streaks, leaderboards. Guests can watch the vibe; members queue up.',
    ctaPrimary: 'Sign up & claim daily',
    ctaSecondary: 'View Hall of Fame',
    primary: '#fb7185', primary2: '#fbbf24', accent: '#22d3ee', glow: 'rgba(251,113,133,.32)',
    termLines: [
      '<span class="hi">arcade</span> status: matchmakers online',
      'games: rps · ttt · dice · roulette · mines…',
      'escrow: <span class="ok">protected</span> · jackpot: <span class="warn">live</span>',
      'guest → browse boards · member → stake & play',
    ],
    lock: 'Join queues, claim daily bonus and keep win stats after registration.',
    modules: [
      ['🎲', 'Instant Duels', 'Quick bot or PvP rounds.', 'Login'],
      ['🏆', 'Hall of Fame', 'Top streaks & boards.', 'Public peek'],
      ['🎁', 'Daily reload', 'Claim LULcoins once ready.', 'Members'],
      ['📊', 'Coin feed', 'See what the community earns.', 'Public teaser'],
    ],
    stats: [['PvP', 'queues'], ['Jackpot', 'pool'], ['Streaks', 'tracked'], ['Fair', 'escrow']],
    desc: {
      content: 'Arcade-Hero, Matchmaker-Terminal, Game-Cards, Jackpot/Stats, CTA Daily Bonus.',
      functions: 'Leaderboard-Teaser, Game-Übersicht, Register zum Spielen.',
      purpose: 'Spieler:innen konvertieren über FOMO (Jackpot, Daily, Rankings).',
    },
  },
  {
    id: '03-tool-vault',
    name: 'Tool Vault',
    angle: 'Labs & Utility First',
    kicker: 'labs · net · text · color',
    title: 'A toolkit that <span class="grad">stays in the terminal</span>',
    lead: 'WHOIS, DNS, text transforms, color lab, identity forge, chaos generators — productive utilities with a dark ops UI.',
    ctaPrimary: 'Open as member',
    ctaSecondary: 'Tour the labs',
    primary: '#22d3ee', primary2: '#34d399', accent: '#a78bfa', glow: 'rgba(34,211,238,.28)',
    termLines: [
      'toolvault scan… <span class="ok">ok</span>',
      'net-toolkit · textlab · colorlab · identity',
      'guest mode: explore UI · limited writes',
      'member: history, prefs, achievement unlocks',
    ],
    lock: 'Saved outputs, preferences and achievement progress require login.',
    modules: [
      ['🛠️', 'Net Toolkit', 'WHOIS · DNS · IP helpers.', 'Often guest OK'],
      ['📝', 'Text Lab', 'Transform, count, slugify.', 'Guest-friendly'],
      ['🎨', 'Color Lab', 'Palettes & contrast checks.', 'Browse'],
      ['🎭', 'Identity Forge', 'Persona playground.', 'Fun teaser'],
    ],
    stats: [['20+', 'tools'], ['Fast', 'client'], ['Dark', 'UI'], ['No', 'bloat']],
    desc: {
      content: 'Utility-Hero, Tool-Grid, Terminal Scan-Log, CTA Account für History.',
      functions: 'Tool-Kategorien browsen, Demo-Feeling, Registrieren.',
      purpose: 'Power-User und Dev-Audience über nützliche Labs gewinnen.',
    },
  },
  {
    id: '04-paste-share',
    name: 'Paste Share',
    angle: 'Code & Snippets',
    kicker: 'paste · syntax · expiry',
    title: 'Ship snippets. <span class="grad">Control the burn.</span>',
    lead: 'Public, private and password pastes with languages, expiry and burn-after-read. Guests open public links; members create & manage.',
    ctaPrimary: 'Sign in to paste',
    ctaSecondary: 'See how it works',
    primary: '#34d399', primary2: '#22d3ee', accent: '#fbbf24', glow: 'rgba(52,211,153,.28)',
    termLines: [
      'GET /p/<span class="hi">demo</span> → public paste',
      'visibility: public | private | protected',
      'options: expiry · burn · pin · syntax',
      '<span class="warn">create</span> requires session cookie',
    ],
    lock: 'Create, edit, pin and private pastes after you register.',
    modules: [
      ['📋', 'Syntax views', 'Readable code sharing.', 'Public view'],
      ['⏱️', 'Expiry', 'Auto-clean sensitive dumps.', 'On create'],
      ['🔐', 'Protected', 'Password unlock flow.', 'Link works'],
      ['⭐', 'Gallery', 'Your pastes, pinned first.', 'Members'],
    ],
    stats: [['Fast', 'share'], ['Burn', 'ready'], ['QR', 'links'], ['Safe', 'defaults']],
    desc: {
      content: 'Paste-Hero, Feature-Cards zu Visibility/Expiry, Terminal API-Feeling, CTA Create.',
      functions: 'Konzept öffentlicher Pastes verstehen, Signup zum Erstellen.',
      purpose: 'Paste-User konvertieren (Create-Gate).',
    },
  },
  {
    id: '05-image-host',
    name: 'Image Host',
    angle: 'Upload & Gallery',
    kicker: 'host · gallery · tags',
    title: 'Host images <span class="grad">without the noise</span>',
    lead: 'Direct links, view pages, tags and personal gallery stats. Guests understand the product; members upload and organize.',
    ctaPrimary: 'Create account',
    ctaSecondary: 'Preview gallery UI',
    primary: '#22d3ee', primary2: '#818cf8', accent: '#fb7185', glow: 'rgba(34,211,238,.3)',
    termLines: [
      'image-host: mime check · size caps',
      'outputs: direct URL · view page · markdown',
      'gallery: favorites · tags · bulk',
      'guest: browse concept · member: upload',
    ],
    lock: 'Uploads, favorites, tags and my-gallery need login.',
    modules: [
      ['☁️', 'Direct links', 'Hotlink-ready URLs.', 'After upload'],
      ['🏷️', 'Tags', 'Find shots later.', 'Members'],
      ['📈', 'Views', 'Light stats per image.', 'Public meta'],
      ['🗂️', 'My gallery', 'Manage your files.', 'Login'],
    ],
    stats: [['SVG', 'safe'], ['Fast', 'CDN*'], ['Tags', '12 max'], ['Own', 'data']],
    desc: {
      content: 'Image-Host Hero, Output-Formate, Gallery-Teaser, CTA Upload via Account.',
      functions: 'Produkt verstehen, Register zum Hochladen.',
      purpose: 'Creator/Upload-Conversion.',
    },
  },
  {
    id: '06-community-pulse',
    name: 'Community Pulse',
    angle: 'Live Stats & Wire',
    kicker: 'pulse · wire · presence',
    title: 'Feel the <span class="grad">terminal breathe</span>',
    lead: 'Terminal Pulse, LUL Wire news and system status — the living side of the community before you even log in.',
    ctaPrimary: 'Join the community',
    ctaSecondary: 'Read LUL Wire',
    primary: '#22d3ee', primary2: '#34d399', accent: '#a78bfa', glow: 'rgba(34,211,238,.28)',
    termLines: [
      'pulse: counters · activity · media',
      'wire: bulletins · breaking notes',
      'status: probes · uptime',
      'join → shoutbox · profile · invites',
    ],
    lock: 'Shoutbox, profile customization and invites unlock with an account.',
    modules: [
      ['📡', 'Terminal Pulse', 'Live-ish community counters.', 'Often public'],
      ['📰', 'LUL Wire', 'News & bulletins.', 'Read'],
      ['📟', 'System Status', 'Service health.', 'Public'],
      ['💬', 'Shoutbox', 'Terminal chat energy.', 'Login'],
    ],
    stats: [['Online', 'vibe'], ['News', 'fresh'], ['Status', 'green'], ['Open', 'culture']],
    desc: {
      content: 'Pulse-Hero, News/Status-Karten, Community-CTAs.',
      functions: 'News/Status-Teaser lesen, Registrieren für Social.',
      purpose: 'Community-Belonging und wiederkehrende Besucher.',
    },
  },
  {
    id: '07-coin-economy',
    name: 'Coin Economy',
    angle: 'LULcoins & Rewards',
    kicker: 'economy · fair ledger',
    title: 'LULcoins with <span class="grad">real rules</span>',
    lead: 'Escrowed bets, daily reloads, achievements and feeds — a playful economy designed not to silently mint free money.',
    ctaPrimary: 'Start earning',
    ctaSecondary: 'How coins work',
    primary: '#fbbf24', primary2: '#fb923c', accent: '#34d399', glow: 'rgba(251,191,36,.28)',
    termLines: [
      'ledger: wins · refunds · jackpots · daily',
      'escrow: stake locked until settle',
      'achievements: proof-gated where needed',
      'guest: learn economy · member: balance',
    ],
    lock: 'Balance, claims and coin feed personalization after login.',
    modules: [
      ['🪙', 'Escrow play', 'Stakes held safely mid-match.', 'Members'],
      ['🎁', 'Daily bonus', 'Reload on cooldown.', 'Members'],
      ['🎖️', 'Achievements', 'Unlock rewards fairly.', 'Members'],
      ['📜', 'Feed', 'Transparent credit history.', 'Teaser'],
    ],
    stats: [['No', 'fake mint'], ['Escrow', 'first'], ['Daily', 'claim'], ['Proof', 'aware']],
    desc: {
      content: 'Economy-Hero, Ledger-Terminal, Reward-Cards, CTA Start earning.',
      functions: 'Regeln verstehen, Account für Balance.',
      purpose: 'Vertrauen in die Coin-Wirtschaft + Signup.',
    },
  },
  {
    id: '08-hall-of-fame',
    name: 'Hall of Fame',
    angle: 'Leaderboards & Awards',
    kicker: 'boards · trophies',
    title: 'Climb the <span class="grad">Hall of Fame</span>',
    lead: 'Public boards for wins, streaks and game mastery. Guests admire the podium — members compete for the top slots.',
    ctaPrimary: 'Compete now',
    ctaSecondary: 'Preview boards',
    primary: '#fbbf24', primary2: '#a78bfa', accent: '#22d3ee', glow: 'rgba(251,191,36,.3)',
    termLines: [
      'boards: wins · streaks · games · jackpots',
      'privacy: respect profile visibility flags',
      'awards: seasonal & persistent badges',
      'guest spectate · member rank',
    ],
    lock: 'Appear on boards and unlock award flows with a profile.',
    modules: [
      ['🏆', 'Top 3', 'Podium energy on every board.', 'Public'],
      ['🔥', 'Streaks', 'Consistency pays.', 'Play to rank'],
      ['🎖️', 'Awards', 'Show off trophies.', 'Profile'],
      ['👁️', 'Privacy', 'Hide stats if you want.', 'Settings'],
    ],
    stats: [['Ranked', 'games'], ['Live', 'tables'], ['Fair', 'filters'], ['Show', 'or hide']],
    desc: {
      content: 'Ranking-Hero, Board-Teaser-Cards, Award-Hinweise, CTA Compete.',
      functions: 'Boards ansehen (Konzept), Registrieren zum Mitspielen.',
      purpose: 'Wettbewerbs-Motivation und Retention.',
    },
  },
  {
    id: '09-minimal-glass',
    name: 'Minimal Glass',
    angle: 'Ruhig & premium-minimal',
    layout: 'layout-center',
    kicker: 'less noise · more signal',
    title: 'One terminal. <span class="grad">Everything useful.</span>',
    lead: 'A calmer entry: three actions only — explore tools, meet the arcade, or create an account. No clutter.',
    ctaPrimary: 'Register',
    ctaSecondary: 'Sign in',
    primary: '#e2e8f0', primary2: '#22d3ee', accent: '#34d399', glow: 'rgba(226,232,240,.12)',
    termLines: [
      'mode: minimal guest index',
      'paths: tools · games · account',
      'chrome: reduced · focus preserved',
      'ready when you are.',
    ],
    lock: 'Everything deeper lives behind a short registration.',
    modules: [
      ['01', 'Explore', 'Public-friendly modules first.', 'Free'],
      ['02', 'Play', 'Arcade when you are ready.', 'Login'],
      ['03', 'Belong', 'Profile, invites, shoutbox.', 'Login'],
      ['04', 'Build', 'Paste, host, labs.', 'Mixed'],
    ],
    stats: [['3', 'paths'], ['0', 'clutter'], ['1', 'account'], ['∞', 'tools']],
    desc: {
      content: 'Zentrierter Minimal-Hero, 4 schlichte Steps, wenig Chrome, starke CTAs.',
      functions: 'Register/Login, optionale Explore-Pfade.',
      purpose: 'Conversion mit maximaler Klarheit (Anti-Overload).',
    },
  },
  {
    id: '10-matrix-ops',
    name: 'Matrix Ops',
    angle: 'Cyberpunk / Ops-Ästhetik',
    kicker: 'ops channel · encrypted vibes',
    title: 'Drop into the <span class="grad">ops channel</span>',
    lead: 'Cyber-terminal energy for people who like scanlines, mono type and modular systems — still friendly for first-time guests.',
    ctaPrimary: 'Jack in (register)',
    ctaSecondary: 'Surface scan',
    primary: '#4ade80', primary2: '#22d3ee', accent: '#a3e635', glow: 'rgba(74,222,128,.28)',
    termLines: [
      '>> surface scan complete',
      '>> modules mounted: 12',
      '>> threat model: self-hosted trust',
      '>> elevate privileges: create identity',
    ],
    lock: 'Elevated modules and write ops need a session identity.',
    modules: [
      ['🛰️', 'Recon tools', 'Net toolkit flavor.', 'Guest peek'],
      ['🧬', 'Identity', 'Forge aliases safely.', 'Lab'],
      ['💾', 'Drops', 'Paste & image payloads.', 'Create=login'],
      ['⚔️', 'Arena', 'Coin combat zone.', 'Login'],
    ],
    stats: [['Self', 'hosted'], ['Cookie', 'session'], ['No', 'ads'], ['Dark', 'ops']],
    desc: {
      content: 'Matrix-Tone Hero, Scan-Terminal, Ops-Module, CTA Jack in.',
      functions: 'Atmosphäre erleben, Account für „elevate“.',
      purpose: 'Marken-Ästhetik & Nischen-Appeal (Hacker-UI Fans).',
    },
  },
  {
    id: '11-dashboard-preview',
    name: 'Dashboard Preview',
    angle: 'Product UI Teaser',
    kicker: 'your terminal · after login',
    title: 'Your dashboard is <span class="grad">one signup away</span>',
    lead: 'See how the signed-in shell feels: menu groups, pulse widgets and quick jumps — then claim it with an account.',
    ctaPrimary: 'Claim dashboard',
    ctaSecondary: 'Continue as guest',
    primary: '#a78bfa', primary2: '#22d3ee', accent: '#34d399', glow: 'rgba(167,139,250,.3)',
    termLines: [
      'shell: sidebar · header · modules',
      'main: pulse · games · paste · host',
      'labs: toolkit · forge · text · color',
      'guest shell limited · member full map',
    ],
    lock: 'Full navigation, settings and activity require login.',
    modules: [
      ['🏠', 'Home', 'Stats & shortcuts.', 'Members'],
      ['📜', 'Changelog', 'What shipped.', 'Public'],
      ['❓', 'FAQ', 'How things work.', 'Public'],
      ['👤', 'Profile', 'Customize later.', 'Login'],
    ],
    stats: [['Sidebar', 'map'], ['Labs', 'group'], ['Main', 'group'], ['You', 'center']],
    desc: {
      content: 'Dashboard-Teaser, Shell-Erklärung, Navigations-Karten, CTA Claim.',
      functions: 'Produkt-UI verstehen, Guest continue vs Register.',
      purpose: 'Product-led signup über UI-Vorschau.',
    },
  },
  {
    id: '12-meme-lab',
    name: 'Meme Lab',
    angle: 'Meme Generator Energy',
    kicker: 'memes · templates · export',
    title: 'Make memes. <span class="grad">Stay in the terminal.</span>',
    lead: 'Template catalog, editor flow and community fun energy — a lighter door into the same platform.',
    ctaPrimary: 'Join & create',
    ctaSecondary: 'Browse templates',
    primary: '#fb7185', primary2: '#a78bfa', accent: '#fbbf24', glow: 'rgba(251,113,133,.3)',
    termLines: [
      'meme-lab: catalog loaded',
      'editor: text layers · export',
      'fun & trap: gravity anomaly nearby',
      'save / achievements → account',
    ],
    lock: 'Saved memes and related achievements need a user session.',
    modules: [
      ['🖼️', 'Catalog', 'Pick a base image.', 'Browse'],
      ['✏️', 'Editor', 'Text, layout, export.', 'Create'],
      ['🎮', 'Fun zone', 'Playful side content.', 'Guest OK'],
      ['🏅', 'Unlocks', 'Track creative milestones.', 'Login'],
    ],
    stats: [['Templates', 'many'], ['Export', 'ready'], ['Fun', 'first'], ['Same', 'account']],
    desc: {
      content: 'Meme-Hero, Catalog/Editor-Cards, Fun-Hinweis, CTA Join.',
      functions: 'Templates ansehen, Register zum Speichern.',
      purpose: 'Leichte, virale Einstiegsemotion → Account.',
    },
  },
  {
    id: '13-wire-desk',
    name: 'Wire Desk',
    angle: 'News / Changelog Editorial',
    kicker: 'wire · changelog · trust',
    title: 'What shipped. <span class="grad">What matters.</span>',
    lead: 'LUL Wire and Changelog as the editorial front door — transparency builds trust before registration.',
    ctaPrimary: 'Get an account',
    ctaSecondary: 'Read latest notes',
    primary: '#e2e8f0', primary2: '#22d3ee', accent: '#818cf8', glow: 'rgba(34,211,238,.22)',
    termLines: [
      'wire: bulletins · updates',
      'changelog: P0–P9 priority tags',
      'status: probes green',
      'follow deeper features → register',
    ],
    lock: 'Personalized read state and some notifications after login.',
    modules: [
      ['📰', 'LUL Wire', 'Community bulletins.', 'Read'],
      ['📜', 'Changelog', 'Engineering honesty.', 'Read'],
      ['📟', 'Status', 'Uptime & health.', 'Read'],
      ['🔔', 'Follow-ups', 'Stay closer later.', 'Login'],
    ],
    stats: [['Open', 'notes'], ['Priority', 'tags'], ['No', 'hype'], ['Ship', 'log']],
    desc: {
      content: 'Editorial Hero, Wire/Changelog/Status Karten, Trust CTA.',
      functions: 'News lesen, Account für Personalisierung.',
      purpose: 'Trust-first Conversion über Transparenz.',
    },
  },
  {
    id: '14-status-pulse',
    name: 'Status Pulse',
    angle: 'Reliability & Health',
    kicker: 'uptime · probes · calm',
    title: 'Online. <span class="grad">Observable.</span> Yours to join.',
    lead: 'Lead with system status and calm reliability — then invite guests into the full terminal experience.',
    ctaPrimary: 'Create account',
    ctaSecondary: 'View status concept',
    primary: '#34d399', primary2: '#22d3ee', accent: '#a7f3d0', glow: 'rgba(52,211,153,.28)',
    termLines: [
      'probe auth… <span class="ok">ok</span>',
      'probe games… <span class="ok">ok</span>',
      'probe paste… <span class="ok">ok</span>',
      'all systems nominal · join when ready',
    ],
    lock: 'Interactive modules beyond status need a session for full use.',
    modules: [
      ['🟢', 'Health', 'Service probes at a glance.', 'Public'],
      ['📡', 'Pulse', 'Community counters.', 'Public-ish'],
      ['🛠️', 'Tools', 'Always nearby.', 'Explore'],
      ['👤', 'You', 'Profile after signup.', 'Login'],
    ],
    stats: [['Auth', 'up'], ['Games', 'up'], ['Paste', 'up'], ['Host', 'up']],
    desc: {
      content: 'Status-Hero mit Probe-Log, Health-Cards, ruhiger CTA.',
      functions: 'Vertrauen über Verfügbarkeit, dann Register.',
      purpose: 'Reliability-Signaling für self-hosted Audience.',
    },
  },
  {
    id: '15-invite-growth',
    name: 'Invite Growth',
    angle: 'Referral & Friends',
    kicker: 'invite · grow · rewards',
    title: 'Bring friends into the <span class="grad">terminal</span>',
    lead: 'Referral-friendly entry: explain invites and shared play, then convert both host and guest into accounts.',
    ctaPrimary: 'Register free',
    ctaSecondary: 'Learn invites',
    primary: '#a78bfa', primary2: '#fb7185', accent: '#22d3ee', glow: 'rgba(167,139,250,.3)',
    termLines: [
      'invite links: personal codes',
      'reward: community growth loops',
      'guest lands → explores → joins',
      'host tracks referrals after login',
    ],
    lock: 'Your invite code and referral stats appear after registration.',
    modules: [
      ['🎁', 'Invite page', 'Share a clean link.', 'Members'],
      ['🤝', 'Onboarding', 'Friends land on guest index.', 'Both'],
      ['🎲', 'Play together', 'Arcade queues.', 'Login'],
      ['📈', 'Stats', 'See who joined.', 'Host'],
    ],
    stats: [['Share', 'link'], ['Join', 'free'], ['Play', 'together'], ['Track', 'refs']],
    desc: {
      content: 'Invite-Hero, Growth-Steps, Referral-Teaser, CTA Register.',
      functions: 'Invite-Konzept verstehen, Account für eigenen Code.',
      purpose: 'Virales Wachstum und Dual-Sided Conversion.',
    },
  },
  {
    id: '16-security-trust',
    name: 'Security Trust',
    angle: 'Session, Privacy, Self-host',
    kicker: 'httpOnly · self-hosted · you own data',
    title: 'Your session. <span class="grad">Your server.</span>',
    lead: 'Cookie sessions, no token-in-localStorage theater, self-hosted data under your control — trust as the front door.',
    ctaPrimary: 'Create secure account',
    ctaSecondary: 'Why self-host',
    primary: '#818cf8', primary2: '#22d3ee', accent: '#34d399', glow: 'rgba(129,140,248,.28)',
    termLines: [
      'session: httpOnly cookie',
      'storage: local data/ on your host',
      'admin: role-gated APIs',
      'guest: limited surface · member: full',
    ],
    lock: 'Authenticated APIs and private data only after login.',
    modules: [
      ['🔐', 'Cookie auth', 'No JWT in localStorage.', 'Default'],
      ['🗄️', 'Your data dir', 'SQLite + JSON stores.', 'Ops'],
      ['🛡️', 'Roles', 'Admin surfaces protected.', 'Server'],
      ['👤', 'You', 'Own profile & pastes.', 'Login'],
    ],
    stats: [['HttpOnly', 'yes'], ['Self', 'host'], ['Role', 'ACL'], ['No', 'ads']],
    desc: {
      content: 'Trust-Hero, Security-Points, Self-host Hinweis, CTA Secure Account.',
      functions: 'Security-Story lesen, Register mit Vertrauen.',
      purpose: 'Privacy/Security-bewusste Nutzer überzeugen.',
    },
  },
  {
    id: '17-module-matrix',
    name: 'Module Matrix',
    angle: 'Feature-Grid Übersicht',
    layout: 'layout-dense',
    kicker: 'full map · guest safe labels',
    title: 'Every module. <span class="grad">Clearly labeled.</span>',
    lead: 'A structured map of main + labs with guest-safe vs login-required cues — orientation before commitment.',
    ctaPrimary: 'Unlock full map',
    ctaSecondary: 'Start with FAQ',
    primary: '#22d3ee', primary2: '#a78bfa', accent: '#fbbf24', glow: 'rgba(34,211,238,.28)',
    termLines: [
      'main: pulse status games paste host…',
      'labs: toolkit identity text color…',
      'labels: guest-safe · login · vip',
      'pick a door · or create account',
    ],
    lock: 'Login-required modules light up after registration.',
    modules: [
      ['📡', 'Pulse', 'Community counters.', 'Often guest'],
      ['🎲', 'Games', 'Coin arcade.', 'Login'],
      ['📋', 'Paste', 'Share code.', 'Create=login'],
      ['🛠️', 'Labs', 'Utilities cluster.', 'Mixed'],
    ],
    stats: [['Main', 'nav'], ['Labs', 'nav'], ['VIP', 'flags'], ['FAQ', 'help']],
    desc: {
      content: 'Matrix-Hero, kompaktes Modul-Grid mit Guest-Tags, CTA Unlock.',
      functions: 'Orientierung im Produkt, gezieltes Weiterstöbern.',
      purpose: 'Informationsarchitektur → informierte Registrierung.',
    },
  },
  {
    id: '18-mobile-stack',
    name: 'Mobile Stack',
    angle: 'Mobile-first Card Stack',
    layout: 'layout-center',
    kicker: 'thumb-first · fast path',
    title: 'Terminal energy. <span class="grad">Phone friendly.</span>',
    lead: 'Single-column guest journey optimized for mobile: short hero, stacked modules, sticky-feel CTAs.',
    ctaPrimary: 'Sign up free',
    ctaSecondary: 'Keep browsing',
    primary: '#22d3ee', primary2: '#34d399', accent: '#fb7185', glow: 'rgba(34,211,238,.28)',
    termLines: [
      'viewport: mobile-first',
      'actions: register · sign-in · explore',
      'content: stacked · scannable',
      'same account on desktop later',
    ],
    lock: 'Full multi-column shell after login on any device.',
    modules: [
      ['1', 'Glance', 'What LUL is in 10s.', 'Guest'],
      ['2', 'Touch', 'Public modules.', 'Guest'],
      ['3', 'Join', 'Create account.', 'CTA'],
      ['4', 'Return', 'Same session cookie.', 'Auth'],
    ],
    stats: [['Fast', 'scroll'], ['Big', 'CTAs'], ['Clear', 'type'], ['One', 'hand']],
    desc: {
      content: 'Mobile-zentrierter Flow, große CTAs, 4 Steps, wenig Ablenkung.',
      functions: 'Schnelles Signup oder Continue.',
      purpose: 'Mobile Conversion und Klarheit.',
    },
  },
  {
    id: '19-story-timeline',
    name: 'Story Timeline',
    angle: 'Narrative / Changelog Journey',
    kicker: 'story · ship · join',
    title: 'From idea to <span class="grad">living terminal</span>',
    lead: 'A short narrative: community tools → fair arcade → self-hosted control. Guests follow the story, then join the next chapter.',
    ctaPrimary: 'Write your chapter',
    ctaSecondary: 'Open changelog',
    primary: '#a78bfa', primary2: '#22d3ee', accent: '#fbbf24', glow: 'rgba(167,139,250,.28)',
    termLines: [
      'ch.1 tools & share',
      'ch.2 arcade economy',
      'ch.3 trust & self-host',
      'ch.4 you — after register',
    ],
    lock: 'Your personal chapter (profile, coins, pastes) starts at signup.',
    modules: [
      ['I', 'Share', 'Paste & images.', 'Core'],
      ['II', 'Play', 'Games & coins.', 'Core'],
      ['III', 'Know', 'Pulse & wire.', 'Core'],
      ['IV', 'You', 'Profile & invites.', 'Login'],
    ],
    stats: [['Story', 'led'], ['Ship', 'log'], ['Join', 'next'], ['Own', 'arc']],
    desc: {
      content: 'Narrative Hero, Kapitel-Karten, Changelog-CTA, Register als nächstes Kapitel.',
      functions: 'Story lesen, Changelog, Account.',
      purpose: 'Emotionale Markenbindung + Signup.',
    },
  },
  {
    id: '20-vip-gateway',
    name: 'VIP Gateway',
    angle: 'Premium Accounts & VIP Teaser',
    kicker: 'vip · vault · free premiums',
    title: 'Free premiums. <span class="grad">VIP when needed.</span>',
    lead: 'Tease the Free Premium Accounts vault and VIP-protected surfaces while keeping the rest of the terminal open to explore.',
    ctaPrimary: 'Register for vault access',
    ctaSecondary: 'Explore free tools',
    primary: '#fbbf24', primary2: '#a78bfa', accent: '#22d3ee', glow: 'rgba(251,191,36,.28)',
    termLines: [
      'vault: free premium listings',
      'vip surfaces: protected where configured',
      'rest of terminal: open to guests',
      'account: required for vault actions',
    ],
    lock: 'Vault submit/report flows and VIP gates require authentication.',
    modules: [
      ['👑', 'Premium vault', 'Community free accounts list.', 'Login use'],
      ['🛠️', 'Open tools', 'Labs without VIP.', 'Guest'],
      ['🎲', 'Arcade', 'Coin games for all members.', 'Login'],
      ['📜', 'Rules', 'Transparent VIP badges.', 'Read'],
    ],
    stats: [['VIP', 'badges'], ['Vault', 'live'], ['Tools', 'open'], ['Fair', 'access']],
    desc: {
      content: 'VIP/Vault-Hero, Access-Klarheit, Open-Tools-Ausgleich, CTA Register.',
      functions: 'Vault-Konzept verstehen, Tools weiterstöbern, Signup für Access.',
      purpose: 'Vault/VIP-Conversion ohne den Rest abzuschrecken.',
    },
  },
];

function pageHtml(v, i) {
  const n = String(i + 1).padStart(2, '0');
  const layout = v.layout ? ` ${v.layout}` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${v.name} · LUL Terminal Guest Index ${n}/20</title>
  <meta name="description" content="${v.lead.replace(/"/g, "'")}" />
  <link rel="stylesheet" href="../css/lul-landing.css" />
  <style>
    :root {
      --primary: ${v.primary};
      --primary-2: ${v.primary2};
      --accent: ${v.accent};
      --glow: ${v.glow};
    }
  </style>
</head>
<body class="${layout.trim()}">
  <div class="bg-glow" aria-hidden="true"></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="scanlines" aria-hidden="true"></div>

  <header class="nav">
    <a class="brand" href="../index.html">
      <span class="brand-dot" aria-hidden="true"></span>
      LUL Terminal
    </a>
    <div class="nav-meta">
      <span>guest index · ${n}/20</span>
      <span>${v.angle}</span>
    </div>
    <div class="nav-actions">
      <a class="btn btn-ghost" href="#cta">Sign in</a>
      <a class="btn btn-primary" href="#cta">${v.ctaPrimary}</a>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="wrap hero-grid">
        <div class="reveal">
          <div class="kicker">${v.kicker}</div>
          <h1>${v.title}</h1>
          <p class="lead">${v.lead}</p>
          <div class="cta-row">
            <a class="btn btn-primary btn-lg" href="#cta">${v.ctaPrimary}</a>
            <a class="btn btn-ghost btn-lg" href="#modules">${v.ctaSecondary}</a>
          </div>
          <div class="trust">
            <span><b>Guests welcome</b> — browse first</span>
            <span><b>Register</b> — save, play, create</span>
          </div>
          <div class="chips">
            <span class="chip on">Guest-safe</span>
            <span class="chip">Auth optional to explore</span>
            <span class="chip">Self-hosted</span>
          </div>
        </div>
        <div class="reveal d2">
          <div class="term">
            <div class="term-bar">
              <i></i><i></i><i></i>
              <span style="margin-left:0.5rem">guest@lul-terminal ~ ${v.id}</span>
            </div>
            <div class="term-body">
              ${v.termLines.map((l) => `<div>${l}</div>`).join('')}
              <div class="lock"><b>After register:</b> ${v.lock}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="stats reveal">
          ${v.stats.map(([a, b]) => `<div class="stat"><b>${a}</b><span>${b}</span></div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" id="modules">
      <div class="wrap">
        <div class="section-h reveal">
          <h2>What you can explore</h2>
          <p>Clear modules from the real LUL Terminal map — labeled for guests vs members.</p>
        </div>
        <div class="grid g2 g4">
          ${v.modules
            .map(
              ([ico, t, p, tag], mi) => `
          <article class="card reveal d${(mi % 3) + 1}">
            <div class="ico">${ico}</div>
            <h3>${t}</h3>
            <p>${p}</p>
            <span class="guest-tag">${tag}</span>
          </article>`,
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section" id="cta">
      <div class="wrap">
        <div class="cta reveal">
          <h2>Ready to enter the full terminal?</h2>
          <p>Create a free account to play, paste, host and keep progress — or sign in if you already have a session.</p>
          <div class="cta-row" style="justify-content:center">
            <a class="btn btn-primary btn-lg" href="#">${v.ctaPrimary}</a>
            <a class="btn btn-ghost btn-lg" href="#">Sign in</a>
          </div>
          <p style="margin:1rem 0 0;font-family:var(--mono);font-size:0.7rem;color:var(--muted)">
            Demo CTAs — wire to your AuthModal /api/auth in production.
          </p>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="wrap footer-row">
      <span>LUL Terminal · Guest index variant <b style="color:var(--text)">${v.name}</b> (${n}/20)</span>
      <span>
        <a href="../index.html">All variants</a>
        · <a href="../BESCHREIBUNGEN.md">Descriptions (DE)</a>
      </span>
    </div>
  </footer>
  <script src="../js/reveal.js"></script>
</body>
</html>
`;
}

function descriptions(variants) {
  let md = `# LUL Terminal — 20 Gäste-Indexvarianten

Gemeinsames Konzept: Einstieg für **nicht eingeloggte** Besucher, thematisch an **LUL Terminal** (Tools, Paste, Image Host, Arcade/LULcoins, Pulse, Wire, Self-Host, Auth).

**Shared Design:** Dark slate, Cyan/Violet/Emerald-Akzente, Mono-Terminal-Panel, Scanlines, Mesh-Glow, Hover-Cards, Scroll-Reveal, klare Guest-vs-Login Labels, duale CTAs.

**Dateien:** \`pages/*.html\` · \`css/lul-landing.css\` · Katalog \`index.html\`

---

`;
  variants.forEach((v, i) => {
    md += `## ${i + 1}. ${v.name} — ${v.angle}

**Datei:** [\`pages/${v.id}.html\`](pages/${v.id}.html)

### Inhalte
${v.desc.content}

### Funktionen (Gast)
${v.desc.functions}

### Zweck
${v.desc.purpose}

### Motivations-Hooks
- Terminal-Preview mit **Lock-Hinweis** (was nach Register frei wird)
- Modul-Karten mit **Guest-Tags**
- Stats / Trust-Row · Primary CTA **${v.ctaPrimary}**

---

`;
  });
  return md;
}

function indexHtml(variants) {
  const cards = variants
    .map(
      (v, i) => `
    <a class="cat-card reveal" href="pages/${v.id}.html" style="--primary:${v.primary};--primary-2:${v.primary2};--accent:${v.accent};--glow:${v.glow}">
      <div class="n">VARIANT ${String(i + 1).padStart(2, '0')}</div>
      <h3>${v.name}</h3>
      <p><strong style="color:var(--text)">${v.angle}</strong><br />${v.lead.slice(0, 100)}…</p>
    </a>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LUL Terminal — 20 Guest Index Variants</title>
  <link rel="stylesheet" href="css/lul-landing.css" />
</head>
<body>
  <div class="bg-glow"></div>
  <div class="bg-grid"></div>
  <header class="nav">
    <div class="brand"><span class="brand-dot"></span> LUL Terminal · Guest Indexes</div>
    <div class="nav-actions">
      <a class="btn btn-ghost" href="BESCHREIBUNGEN.md">DE Beschreibungen</a>
      <a class="btn btn-primary" href="pages/01-terminal-boot.html">Open #01</a>
    </div>
  </header>
  <main class="section">
    <div class="wrap">
      <div class="section-h reveal">
        <h2>20 Einstiegsseiten für Gäste</h2>
        <p>Ein Produkt — zwanzig kreative Türen. Modern, übersichtlich, mit Wow-Effekten ohne Überladung. Motiviert zum Stöbern und Registrieren.</p>
      </div>
      <div class="catalog">${cards}</div>
    </div>
  </main>
  <footer class="footer"><div class="wrap footer-row">
    <span>Shared framework · LUL palette · conversion CTAs</span>
    <span>Wire CTAs to AuthModal in the real app</span>
  </div></footer>
  <script src="js/reveal.js"></script>
</body>
</html>`;
}

fs.mkdirSync(pagesDir, { recursive: true });
variants.forEach((v, i) => fs.writeFileSync(path.join(pagesDir, `${v.id}.html`), pageHtml(v, i), 'utf8'));
fs.writeFileSync(path.join(root, 'index.html'), indexHtml(variants), 'utf8');
fs.writeFileSync(path.join(root, 'BESCHREIBUNGEN.md'), descriptions(variants), 'utf8');
fs.writeFileSync(path.join(root, 'README.md'), `# LUL Terminal — 20 Guest Index Variants

Creative **guest landing / index** concepts aligned with LUL Terminal (arcade, paste, tools, pulse, self-host).

## Run

\`\`\`bash
cd docs/guest-index-variants
npx --yes serve .
\`\`\`

Open the catalog, or any \`pages/*.html\`.

## Regenerate

\`\`\`bash
node scripts/generate.mjs
\`\`\`

## Docs

- German short descriptions (content / functions / purpose): **BESCHREIBUNGEN.md**
- Shared CSS: **css/lul-landing.css**

These are **static design prototypes**. Hook CTAs to the real \`AuthModal\` / session flow when integrating into \`src/\`.
`, 'utf8');
console.log(`OK: ${variants.length} LUL guest index variants`);
