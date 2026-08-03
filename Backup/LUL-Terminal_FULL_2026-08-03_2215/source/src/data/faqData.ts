/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FaqItem = { q: string; a: string };
export type FaqSection = { id: string; icon: string; title: string; items: FaqItem[] };

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'start',
    icon: '🚀',
    title: 'Getting Started',
    items: [
      {
        q: 'What is LUL Terminal?',
        a: 'LUL Terminal is a retro-inspired web dashboard with a terminal CLI, tools, labs, and community features. Everything runs in the browser — no download required. The interface combines news, stats, fun modules, network tools, paste hosting, proxy pipelines, and a member system with profiles and achievements.',
      },
      {
        q: 'How do I navigate the site?',
        a: 'The left sidebar has the main menu (Dashboard, Terminal Pulse, System Status, Hall of Fame, Games, News, FAQ, Paste, Proxy Database, Premium Accounts …) and below that the Creative Labs. Click a menu item — content appears in the center. At the bottom: Sign In/Register or your profile link. The console on the right accepts terminal commands with ! (e.g. !commands) or shoutbox chat without ! when logged in.',
      },
      {
        q: 'Do I need an account?',
        a: 'Some pages are public (News, FAQ, Change Log, Fun & Trap, profiles, Terminal Pulse, System Status, Hall of Fame — depending on admin settings). Most tools (Paste, Image Hosting, Proxy Database, Premium Vault, Labs, Dashboard) require sign-in. Admins can switch any page between public and members-only in Page Visibility.',
      },
      {
        q: 'What is the Member Dashboard?',
        a: 'Menu "Dashboard" (🏠) — your personal home when logged in. Shows quick stats, achievement progress, referral snippet, security actions, and shortcuts to profile, activity, and invite friends.',
      },
      {
        q: 'Can I open a specific page via URL?',
        a: 'Yes. Use ?tab=paste, ?tab=stats, ?tab=status, ?tab=admin, etc. Premium Vault also supports ?category=streaming and ?account={id} for deep links. Profile URLs: /profile/username.',
      },
      {
        q: 'Where can I find the version history?',
        a: 'Menu item "Change Log" — chronological releases with version numbers, highlights, and feature lists. Unread versions show a badge until you visit the page.',
      },
      {
        q: 'How do I invite friends?',
        a: 'Menu "Invite Friends" — personal link (?ref=LUL-…) and referral code with copy buttons. Referred registrations increase your profile counter. See the Referrals FAQ section for details.',
      },
      {
        q: 'Something looks locked — why?',
        a: 'The page may be set to members-only (login gate) or require VIP (Premium Vault). Sign in first. If you are logged in but still blocked, you may need a higher role — e.g. VIP for the vault or admin for the Admin Panel.',
      },
    ],
  },
  {
    id: 'access',
    icon: '👁️',
    title: 'Public vs Members-Only Pages',
    items: [
      {
        q: 'Which pages are public by default?',
        a: 'Terminal Pulse, System Status, Hall of Fame, News, FAQ, Change Log, Fun & Trap, and public profile links. Everything else defaults to members-only until an admin changes it.',
      },
      {
        q: 'What happens when a page is members-only?',
        a: 'Guests see a login gate with a description of the feature. After sign-in you are redirected to the page you tried to open.',
      },
      {
        q: 'Can admins change who sees which page?',
        a: 'Yes — Admin → Page Visibility. Toggle each menu page between Public and Members. Profile and Admin Panel cannot be made fully public (profile links stay public; admin always requires the admin role).',
      },
      {
        q: 'Does VIP unlock members-only pages?',
        a: 'VIP unlocks the Premium Accounts vault content, not every members-only tab. For locked menu items you still need to be signed in; VIP is an extra role on top of user.',
      },
    ],
  },
  {
    id: 'auth',
    icon: '🔐',
    title: 'Account, Roles & Verification',
    items: [
      {
        q: 'How do I register and sign in?',
        a: 'Sidebar: "Sign In" or "Register". Email + password (min. 6 characters). Optional "Stay signed in" (30-day HttpOnly cookie). After login: avatar, Dashboard, profile, and Admin button (if admin).',
      },
      {
        q: 'What roles are there?',
        a: 'User (default) · VIP (read Premium Vault) · Admin (full management + Admin Panel) · BOT (system account for shoutbox automation — not for login).',
      },
      {
        q: 'What does "Verified" mean?',
        a: 'Blue checkmark badge. Verified users may submit premium accounts to the vault. VIP alone lets you view — submitting requires verified status (or admin). Only admins assign verification.',
      },
      {
        q: 'How do profile URLs work?',
        a: 'Format: /profile/username (e.g. /profile/vipdemo). Your own profile is editable; others are read-only. Copy the URL from your profile page. Visiting someone else\'s profile counts toward achievements and analytics.',
      },
      {
        q: 'What does my profile show?',
        a: 'Avatar, cover, website, bio (160 chars), social links, role, verified badge, online indicator, stat counters (profile views, vault submissions, uploads, memes, pastes, referrals, LULcoins, RPS W/L/D, game streaks, jackpots …), achievements showcase, and edit form (own profile only). Email is never public.',
      },
      {
        q: 'How do I change my avatar or cover?',
        a: 'Edit profile → upload a custom avatar (stored on server) or paste an image URL. Cover supports gradient presets or custom image URL. Custom avatar unlocks the "Avatar Artist" achievement.',
      },
      {
        q: 'What does the green online dot mean?',
        a: 'The member was active within the last 5 minutes (last seen or last login). Shown on profiles and in admin Online Radar.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes — from profile settings (own account). The last remaining admin cannot delete themselves. Sessions and personal data are removed from the auth store.',
      },
      {
        q: 'What do profile counters mean?',
        a: 'Image Uploads = hosted images while logged in · Referred Members = completed sign-ups with your code · Premium/Free accounts = vault submissions credited to you · Shoutbox messages = lobby posts · Paste stats = created pastes and total paste views.',
      },
      {
        q: 'Demo accounts?',
        a: 'Fresh empty DB seeds random passwords (logged once) — override with SEED_ADMIN_PASSWORD and SEED_VIP_PASSWORD env vars before first boot.',
      },
      {
        q: 'I forgot my password — what now?',
        a: 'There is no automated reset email yet. Contact an admin to set a new password via User Management, or ask the server operator to edit data/auth/users.json in self-hosted setups.',
      },
    ],
  },
  {
    id: 'invite',
    icon: '🎁',
    title: 'Invite Friends & Referrals',
    items: [
      {
        q: 'What is "Invite Friends"?',
        a: 'Logged-in users get a personal invite link, referral code, copy buttons, and a live count of referred members.',
      },
      {
        q: 'What does my referral link look like?',
        a: 'https://your-domain/?ref=LUL-XXXXXXXX — always starts with LUL- plus 8 hex characters (e.g. LUL-A1B2C3D4). Shown on Invite Friends.',
      },
      {
        q: 'Is the code applied automatically on registration?',
        a: 'Yes when opening your link: ?ref= is stored in the browser and pre-fills the optional invite field. Cleared after successful registration.',
      },
      {
        q: 'When does someone count as referred?',
        a: 'Only after completed registration with a valid code. Clicks alone do not count. Self-referrals (same email) are ignored.',
      },
      {
        q: 'Can I see who I referred?',
        a: 'Members see only the total count on profile and Invite Friends. Admins see recent referred users with usernames in Admin → Referral Network.',
      },
      {
        q: 'Does my code ever change?',
        a: 'No — generated once on first access to Invite Friends and permanent for your account.',
      },
    ],
  },
  {
    id: 'pulse',
    icon: '📡',
    title: 'Terminal Pulse & System Status',
    items: [
      {
        q: 'What is Terminal Pulse?',
        a: 'Menu "Terminal Pulse" (📡) — live community stats from real databases: members online, registrations, uploads, proxy pool size, vault totals, shoutbox volume, changelog views, and more. Refreshes every 30 seconds. No fake numbers.',
      },
      {
        q: 'What is System Status?',
        a: 'Menu "System Status" (📟) — health dashboard for 20+ backend services. Each probe shows Operational, Degraded, or Down with latency and a short metric. Grouped: Core Platform, Community, Content, Network, Vault, Data & Analytics. Auto-refresh 30s.',
      },
      {
        q: 'What does "Degraded" mean on System Status?',
        a: 'The service responds but needs attention — e.g. analytics event log near capacity, proxy checker never run, or zero working proxies in the database. Not a full outage.',
      },
      {
        q: 'Who can see Pulse and Status?',
        a: 'Public by default (unless admin sets them to members-only in Page Visibility). No admin role required.',
      },
      {
        q: 'What is "My Activity"?',
        a: 'Personal analytics for logged-in members: tab visits, commands run, shoutbox sends, recent events, and visitor insights. Open from Dashboard or the activity menu entry.',
      },
    ],
  },
  {
    id: 'leaderboards',
    icon: '🏆',
    title: 'Hall of Fame & Leaderboards',
    items: [
      {
        q: 'What is the Hall of Fame?',
        a: 'Menu "Hall of Fame" — Top 3 podiums for 31 live leaderboards. Community boards: profile views, referrals, uploads, memes, online time, commands, achievements, shoutbox, page visits, vault, paste create/views, RPS/TTT losses & games played, LULcoin balance. Arcade Champions: Top-3 wins for all 14 games (RPS, TTT, Connect Four, Nim, Coin Flip, Dice, and more). Filter tabs: All · Community · Arcade Champions.',
      },
      {
        q: 'How do leaderboard awards work?',
        a: 'Top 3 in each board earn permanent lb_top_* achievements. The BOT may congratulate you in shoutbox. Awards sync periodically server-side.',
      },
      {
        q: 'Do bots appear on leaderboards?',
        a: 'No — BOT accounts are excluded from rankings. Only real members compete.',
      },
      {
        q: 'How often do leaderboards update?',
        a: 'Recalculated when you open the page and on a server sync interval. Stats come from live user records and activity counters.',
      },
    ],
  },
  {
    id: 'games',
    icon: '🎲',
    title: 'Games & LULcoins',
    items: [
      {
        q: 'What is the Games arcade?',
        a: 'Menu "Games" (🎲) — members-only LULcoin arcade with 14 multiplayer titles: RPS, Tic-Tac-Toe, Connect Four, Nim, Coin Flip, Dice, Odd/Even, Card War, RPSLS, Number Duel, Color Pick, High/Low, Mines, Blackjack. Category tabs, search, and variety progress toward meta achievements. Bet LULcoins, PvP or BOT, climb per-game leaderboards, chase the jackpot.',
      },
      {
        q: 'What are LULcoins?',
        a: 'Virtual currency for the Games arcade. Every new account starts with 1,000 LULcoins. Balances appear on your profile and in the Games header. Coins are not real money — they are for fun and leaderboard competition.',
      },
      {
        q: 'How does betting work?',
        a: 'Every match requires a bet of at least 1 LULcoin. In PvP both players stake the same amount upfront; the winner receives both bets (2× stake). Vs BOT: win → 2× bet back; loss → your bet goes to the jackpot pool; draw → full refund.',
      },
      {
        q: 'How does PvP matchmaking work?',
        a: 'Choose "Find opponent", set your bet, optionally enter a 6-character room code to play a friend, then pick rock, paper, or scissors. The server pairs you with another queued player or waits until someone joins your room. Matches resolve via polling — no WebSocket required.',
      },
      {
        q: 'What are BOT difficulty levels?',
        a: 'Easy — slightly favors you. Normal — fair random. Hard — slightly favors the BOT. BOT wins feed the jackpot; BOT losses pay you 2× your bet.',
      },
      {
        q: 'What is the jackpot pool?',
        a: 'A shared pot funded by BOT victories and tracked in data/games/jackpot.json. On every PvP win there is a 0.6% chance the entire pool is paid to the winner. The BOT may announce big jackpot hits in shoutbox.',
      },
      {
        q: 'What is the daily bonus?',
        a: 'Every 24 hours, claim +50 LULcoins from the Games page or your profile sidebar. A circular timer shows cooldown progress; when it hits zero the Claim button glows. Helps rebuild your balance without affecting jackpot odds.',
      },
      {
        q: 'Where are game stats shown?',
        a: 'Games page: per-title W/L/D, streak, coins, variety progress, recent matches, and mini leaderboards per selected game. Profile: LULcoins, game records, streaks, jackpots. Hall of Fame: 14 Arcade Champion win boards plus community boards (losses, games played, LULcoin balance) with permanent lb_top_* awards.',
      },
      {
        q: 'Which achievements relate to Games?',
        a: 'Games Explorer · RPS/TTT extended sets (debut, wins, milestones, moves, streaks) · Per-game Debut/Victor/Fighter for all 12 other titles · Meta: Arcade Tourist (5 games), Explorer (10), Completionist (14), Coin Duelist (100 matches), Terminal Gladiator (500) · Jackpot Hunter · Coin Baron — plus 14 lb_top_* Arcade Champion Hall of Fame awards.',
      },
      {
        q: 'Do achievements give LULcoins?',
        a: 'Yes — every newly unlocked achievement or award automatically credits LULcoins to your balance (typically 20–500 depending on difficulty). Hall of Fame lb_top_* awards pay 500 LUL. First-win and milestone badges pay more than explorer badges. The unlock popup shows the reward; coinReward is stored on the achievement entry. BOT may announce "+X LULcoins" in shoutbox.',
      },
      {
        q: 'Where can I see my recent LULcoin earnings?',
        a: 'Games page and your Profile include the Coin Earnings Feed — a scrollable timeline of every credit: PvP/BOT wins, streak bonuses, jackpot hits, daily reload, draw refunds, and achievement rewards. Filter by Wins · Badges · Jackpot · Daily. API: GET /api/games/coin-feed (signed in). Older achievement payouts appear automatically even before the ledger existed.',
      },
      {
        q: 'Can I run out of coins?',
        a: 'Yes — you need at least your bet amount to queue. Use the daily bonus, win PvP matches, or beat the BOT to rebuild. There is no real-money purchase path.',
      },
      {
        q: '✊ Rock Paper Scissors (RPS) — how does it work?',
        a: 'Classic rock-paper-scissors. Pick rock, paper, or scissors. PvP or BOT · single match or Best-of-3. Winner takes both bets. Extended achievements for move picks, streaks, and win milestones. Hall of Fame: RPS Champion (wins).',
      },
      {
        q: '⭕ Tic-Tac-Toe (TTT) — how does it work?',
        a: '3×3 grid — you play ✕, opponent ○. Three in a row wins; full board without winner = draw (refund). BOT uses Minimax on Hard. Achievements: Grid Debut, win milestones, streaks. HoF: TTT Champion.',
      },
      {
        q: '🔴 Connect Four — how does it work?',
        a: 'Drop tokens into 7 columns on a 6-row board. First to connect four horizontally, vertically, or diagonally wins. Full board = draw. Strategy category · PvP/BOT · private room codes. Achievements: C4 Debut, Victor, Fighter (10 wins).',
      },
      {
        q: '🪨 Nim — how does it work?',
        a: 'Three piles (3 · 5 · 7 stones). On your turn, take 1–N stones from one pile only. Whoever takes the last stone wins the pot. Classic strategy game — BOT difficulty affects play style. Last-move wins logic.',
      },
      {
        q: '🪙 Coin Flip — how does it work?',
        a: 'Pick Heads or Tails before the server flips. Match = win (2× bet in PvP/BOT win). Instant duel — both players pick, then reveal. No skill curve — pure 50/50 with BOT difficulty nudging odds slightly.',
      },
      {
        q: '🎲 Dice Duel — how does it work?',
        a: 'Both roll a six-sided die (1d6). Higher roll wins; equal rolls = draw (refund). Press Roll to submit. Reveal shows both dice. Fast instant duel — great for quick coin flips at higher stakes.',
      },
      {
        q: '🔢 Odd or Even — how does it work?',
        a: 'Guess whether the server\'s d6 roll will be odd or even. Correct parity wins. Simple binary choice — both players pick, server rolls once, winner takes pot. Tie on same wrong guess goes to higher underlying roll logic per server rules.',
      },
      {
        q: '🃏 Card War — how does it work?',
        a: 'Each player flips one card from a virtual deck. Higher rank wins; same rank = draw. Ace high. Single-action instant duel — press Flip to play. Reveal shows both cards.',
      },
      {
        q: '🦎 RPS Lizard Spock — how does it work?',
        a: 'Five-way RPS extension: Rock, Paper, Scissors, Lizard, Spock. Standard counter rules (e.g. Rock crushes Scissors & Lizard). Pick one symbol; server resolves vs opponent. More variety than classic RPS.',
      },
      {
        q: '🔟 Number Duel — how does it work?',
        a: 'Both secretly pick a number 1–10. Higher number wins; same number = draw. Grid of ten buttons — pick fast before the timer. Mind-game meta: nines and tens are popular.',
      },
      {
        q: '🎨 Color Pick — how does it work?',
        a: 'Choose Red, Blue, Green, or Yellow. Server picks a winning color at random. Match = win. Four-button grid. Instant reveal shows the lucky color.',
      },
      {
        q: '📈 High or Low — how does it work?',
        a: 'Server generates a random target 1–100. Guess High (>50) or Low (≤50). Correct guess wins. Reveal shows the target number and answer. Binary choice with transparent odds.',
      },
      {
        q: '💣 Minefield — how does it work?',
        a: '3×3 grid with one hidden mine. Pick a cell — hit the mine = loss, safe cell = win. PvP: both pick; worse outcome loses (or safer pick wins per server). BOT mode places mine based on difficulty. Reveal shows mine location after match.',
      },
      {
        q: '🂡 Blackjack Duel — how does it work?',
        a: 'Auto-deal two cards each. Closest to 21 without busting wins. Bust = automatic loss. Press Deal to start. Reveal shows both hand totals. Standard blackjack scoring (face cards = 10).',
      },
      {
        q: 'Where are per-game stats on my profile?',
        a: 'Profile → Arcade Career panel: all 14 titles with W/L/D, games played, win rate bar, current & best streak, LULcoin summary, jackpots, and coins won/lost. Filter by category or search. Public profiles show the same arcade stats.',
      },
      {
        q: 'What do the achievement badges on the game grid mean?',
        a: 'Each game tile shows up to 3 pip badges: Debut (first match), Victor (first win), Fighter (10 wins). Gold = unlocked, grey = locked. RPS/TTT use the same trio plus extended achievements in the catalog. Hover for names.',
      },
      {
        q: 'Games API endpoints?',
        a: 'GET /api/games/state · GET /api/games/leaderboard · GET /api/games/history · POST/DELETE /api/games/:id/queue · POST /api/games/:id/move · POST /api/games/daily-bonus — generic :id for all 14 games. Signed-in session required except public leaderboard data mirrors Hall of Fame boards.',
      },
    ],
  },
  {
    id: 'paste',
    icon: '📋',
    title: 'Paste — Share Code & Snippets',
    items: [
      {
        q: 'What is LUL Paste?',
        a: 'Create syntax-highlighted code snippets with title, language, expiry, and visibility. Share via /p/{id} links. Supports raw view and fork.',
      },
      {
        q: 'What visibility modes exist?',
        a: 'Public — anyone with the link, listed in trending · Private — only you (login required) · Password-protected — link works but needs password · Burn-after-read — deleted after first view.',
      },
      {
        q: 'Do I need an account to create pastes?',
        a: 'Yes — creation requires sign-in. Viewing public pastes works without login. Private pastes only appear in your account.',
      },
      {
        q: 'Can pastes expire?',
        a: 'Yes — optional TTL (10 min to 30 days) or never. Expired pastes are purged automatically.',
      },
      {
        q: 'Do pastes count toward achievements?',
        a: 'Yes — Paste Explorer (visit tab), Paste Pioneer (first paste), creation milestones (10 → 99,999), view milestones (10 → 99,999), plus Hall of Fame awards lb_top_paste_creator and lb_top_paste_views.',
      },
      {
        q: 'Does the BOT announce new pastes?',
        a: 'Yes — public and protected pastes trigger a shoutbox message with a clickable link. Private pastes are not announced.',
      },
    ],
  },
  {
    id: 'premium',
    icon: '👑',
    title: 'Free Premium Accounts (Vault)',
    items: [
      {
        q: 'Who can see Premium Accounts?',
        a: 'Signed-in VIP and admin users. Others see a VIP login gate.',
      },
      {
        q: 'Who may add accounts?',
        a: 'Verified users and admins via Quick-Add: website, email/username, password, category, free/premium status, optional VIP flag.',
      },
      {
        q: 'What account statuses exist?',
        a: 'Unchecked (pending admin review) · Working (premium) · Working free (marked FREE 💩) · Offline (reported dead) · Rejected. New submissions start unchecked — only admins see them until approved.',
      },
      {
        q: 'How do I report a dead account?',
        a: 'Logged-in members: "Report not working" on an account card. Creates a pending report for admin review in Moderation → Reports.',
      },
      {
        q: 'What is shown per account?',
        a: 'Service, category, status, credentials (copy buttons), creator @username, per-account view counter. VIP entries show a crown.',
      },
      {
        q: 'How do I export accounts?',
        a: 'Filter by category/status, then "Copy Working" (tab-separated) or "TXT" download.',
      },
      {
        q: 'Where are accounts stored?',
        a: 'data/premium-accounts/accounts.json and reports.json — persistent across restarts.',
      },
    ],
  },
  {
    id: 'proxy',
    icon: '🌐',
    title: 'Proxy Scraper, Checker & Database',
    items: [
      {
        q: 'What is the Proxy Scraper?',
        a: 'Admin/tooling area (also in Admin → Proxy Pipeline): scrape ~140 public proxy sources, deduplicate, run as background jobs with progress logs, export results. Members use the Proxy Database for ready-made working lists.',
      },
      {
        q: 'What is the Proxy Checker?',
        a: 'Tests proxies for alive status, latency, HTTPS support, and anonymity. Can pull from scraper results or paste a custom list. Results feed the database merge in the admin pipeline.',
      },
      {
        q: 'What is the Proxy Database (menu item)?',
        a: 'Persistent store of working proxies (data/proxy-database/). Daily auto-check marks offline entries; proxies offline 3+ consecutive days are purged. Filter by type, export TXT, view latency stats.',
      },
      {
        q: 'How does daily proxy health check work?',
        a: 'Server scheduler runs once per day. Offline streaks tracked per proxy. Admin → Proxy DB Inspector can trigger manual daily check.',
      },
      {
        q: 'Proxy Scraper vs Proxy Database — difference?',
        a: 'Scraper = fetch fresh lists from the internet (volatile pool). Database = curated working proxies that survived checks and persist on disk.',
      },
    ],
  },
  {
    id: 'main',
    icon: '📋',
    title: 'Main Menu — Modules',
    items: [
      {
        q: 'News',
        a: 'LUL Wire feed — ASCII bulletins, categories, search, unread tracking. Admins publish via Admin → News & Bulletin.',
      },
      {
        q: 'Fun & Trap',
        a: 'Gravity anomaly minigame — the Claw can grab your cursor. Only active in this tab. "Game Over" and cooldown are intentional.',
      },
      {
        q: 'Change Log',
        a: 'Full release history with version badges, highlight entries, priority pulsar dots, and unread indicator. Reading updates can unlock changelog achievements. See “Changelog priority dots (P0–P9)” below for the color legend.',
      },
      {
        q: 'Changelog priority dots (P0–P9)',
        a: 'Bug fixes use one pulsar dot per line. Each P level has its own color: P0 Red — Critical (security, exploits, auth bypass) · P1 Orange — High (escrow, farming, broken APIs) · P2 Yellow — Medium (privacy leaks, leaderboard exposure) · P3 Cyan — UX (errors, loading, fetch churn) · P4 Sky — Polish (a11y, empty states, retry buttons) · P5 Violet — Copy (German→English, locale) · P6 Indigo — Meta (OG tags, README, favicon) · P7 Fuchsia — Micro (placeholders, dead code) · P8 Zinc — Nitpick (minor inconsistencies) · P9 Emerald — Verified (audit pass clean). Feature releases may use emoji icons instead.',
      },
      {
        q: 'Meme Generator',
        a: 'Imgflip template library, top/bottom text, preview, export. Memes created while logged in count on your profile.',
      },
      {
        q: 'Image Hosting',
        a: 'Upload up to 10 MB (JPEG, PNG, GIF, WebP, AVIF, BMP, SVG). Links: /i/{id} viewer, /hosting/{id} direct. Tags, favorites, gallery, view counter, share snippets (Markdown/BBCode/HTML).',
      },
      {
        q: 'Paste',
        a: 'Code sharing with syntax highlight — see Paste FAQ section.',
      },
      {
        q: 'Proxy Database',
        a: 'Browse working proxies — see Proxy FAQ section.',
      },
      {
        q: 'Free Premium Accounts',
        a: 'VIP vault — see Premium FAQ section.',
      },
      {
        q: 'FAQ',
        a: 'This page — searchable help across all features, roles, admin tools, and achievements.',
      },
    ],
  },
  {
    id: 'labs',
    icon: '🧪',
    title: 'Creative Labs',
    items: [
      {
        q: 'Net Toolkit',
        a: 'WHOIS, DNS lookup (Google DNS), IP geolocation, duplicate-line remover for text lists.',
      },
      {
        q: 'Identity Forge',
        a: 'Fake personas from the persona database (250+ entries, 10 countries). Random address, per-field copy, JSON export. Visiting unlocks Lab Explorer when combined with other labs.',
      },
      {
        q: 'Text Laboratory',
        a: 'Encode/decode (Base64, ROT13, case transforms), character/word counts, slug generator.',
      },
      {
        q: 'Color Spectrum',
        a: 'Palette tools, HEX/RGB/HSL conversion, WCAG contrast checker, harmonies.',
      },
      {
        q: 'Chaos Generator',
        a: 'Random memes, jokes, ASCII art, oracles — entertainment only.',
      },
      {
        q: 'Tool Vault',
        a: '480+ searchable micro-tools: hashing, encoding, converters, generators, reference tables. Filter by category. CLI flag achievements when visiting all labs.',
      },
      {
        q: 'Do labs require login?',
        a: 'Usually members-only by default. Admins can set individual lab pages to public in Page Visibility.',
      },
    ],
  },
  {
    id: 'shoutbox',
    icon: '💬',
    title: 'Shoutbox & BOT',
    items: [
      {
        q: 'What is the shoutbox?',
        a: 'Lobby chat in the terminal console (bottom right). Type without ! prefix when logged in. Messages persist in data/chat/. Pinned welcome message always visible.',
      },
      {
        q: 'Who is BOT?',
        a: 'System user that posts welcome messages, achievement congratulations, referral notices, new paste alerts, leaderboard awards, and responds to admin /bot commands.',
      },
      {
        q: 'Can admins delete shoutbox messages?',
        a: 'Yes — Admin → Shoutbox Monitor: search, browse, delete by message ID (12 hex chars).',
      },
      {
        q: 'Do shoutbox messages count for achievements?',
        a: 'Yes — tiered milestones from 10 to 99,999 sent messages. Counter syncs from stored messages on send.',
      },
      {
        q: 'Is shoutbox moderated automatically?',
        a: 'No auto-filter — admins moderate manually. Rate limits may apply server-side for spam protection.',
      },
    ],
  },
  {
    id: 'cli',
    icon: '⌨️',
    title: 'Terminal & Console',
    items: [
      {
        q: 'How do I use the CLI?',
        a: 'Input bottom right. ENTER runs input. ↑↓ history. Prefix ! for commands (!help, !commands). Without ! → shoutbox when logged in. Many outputs are clickable links.',
      },
      {
        q: 'Important commands?',
        a: '!stats · !reboot · !clean · !theme · !matrix · !ascii · !ping · !weather · !hack · !keygen · !cowsay · !joke · !fortune · !bsod · !loader · !self-destruct · !baudrate — full list via !commands.',
      },
      {
        q: 'Admin-only commands?',
        a: 'Admins can post as BOT via /bot message in shoutbox (server-side). Some diagnostics are admin-only in API.',
      },
      {
        q: 'What is the Matrix overlay?',
        a: '!matrix or UI toggle — green code rain. !theme toggles CRT scanlines. Both are cosmetic.',
      },
      {
        q: 'Baud rate / retro typing?',
        a: '!baudrate 80 simulates slow console output. !baudrate 0 = instant.',
      },
      {
        q: 'Do commands count for achievements?',
        a: 'Yes — Command Rookie at 5, Command Master at 50. Matrix and self-destruct unlock special flags.',
      },
    ],
  },
  {
    id: 'admin',
    icon: '🛡️',
    title: 'Admin Dashboard — Overview',
    items: [
      {
        q: 'Who has admin access?',
        a: 'Users with role admin. Button in sidebar. API returns 403 for non-admins. Last admin cannot be deactivated or deleted.',
      },
      {
        q: 'How is the Admin Panel organized?',
        a: '30 modules in a tab shell with sidebar groups (Start, Monitor, Platform, Content, Community, Data, Ops), search, and keyboard shortcuts 1–9 for the first tabs. Tab choice persists in sessionStorage.',
      },
      {
        q: 'Command Center (Overview)',
        a: 'At-a-glance analytics summary and quick links to every admin module.',
      },
      {
        q: 'Analytics & Tracking',
        a: 'Admin overview stats, searchable user activity list, per-user detail (tabs visited, commands, achievements, visitor intel, recent events).',
      },
      {
        q: 'Page Visibility',
        a: 'Toggle each site page public vs members-only. Locked rules: profile stays public; admin stays members + role check.',
      },
      {
        q: 'Proxy Pipeline',
        a: 'Combined scraper + checker UI for operators — scrape sources, then verify and push to database.',
      },
      {
        q: 'Link Scraper (XML / Crawl)',
        a: 'Scan XML for URLs/colon tokens, crawl websites, save colon U:P pairs to Colon DB. Job progress and presets.',
      },
      {
        q: 'Paste Manager',
        a: 'All pastes — search, filter visibility, sort, inspect, edit metadata, delete.',
      },
      {
        q: 'News & Bulletin',
        a: 'Create, edit, publish, deactivate articles. Feed version bumps on change.',
      },
      {
        q: 'Moderation',
        a: 'Approve/reject unchecked vault submissions. Accept/reject member reports of dead accounts.',
      },
      {
        q: 'User Management',
        a: 'CRUD users, roles, verified flag, active toggle, password reset, delete. Search by name/email.',
      },
      {
        q: 'System Pulse (admin)',
        a: 'Same live stats as Terminal Pulse but with full operator-oriented breakdown.',
      },
      {
        q: 'Shoutbox Monitor',
        a: 'Browse/delete lobby messages. Search by username or content.',
      },
      {
        q: 'Leaderboards (admin)',
        a: 'Inspect Top 3 boards and award sync status.',
      },
      {
        q: 'Colon DB Browser',
        a: 'Search U:P tokens by website, view filtered totals, delete entries.',
      },
      {
        q: 'Image Gallery (admin)',
        a: 'All hosted images — views, size, uploader, delete.',
      },
      {
        q: 'Content Analytics',
        a: 'Changelog and news view counts per article; page view rankings.',
      },
      {
        q: 'Persona Database',
        a: 'Browse fake identity entries, filter by country, search addresses.',
      },
      {
        q: 'Premium Vault (admin)',
        a: 'Full account inventory with credential preview, filters, status management.',
      },
      {
        q: 'Proxy DB Inspector',
        a: 'Latency ranking, manual daily check, TXT export of working/offline lists.',
      },
      {
        q: 'Visitor Directory',
        a: 'Searchable session profiles — referrer, device, UTM, return visits. Overview syncs with active search filter.',
      },
      {
        q: 'Referral Network',
        a: 'Top referrers, invite codes, recently referred members (usernames, not raw IDs).',
      },
      {
        q: 'Event Ops',
        a: 'Analytics event log, type breakdown, purge old events, JSON export bundle.',
      },
      {
        q: 'Online Radar',
        a: 'Who is online now (5-minute window) and who was active today.',
      },
      {
        q: 'Tab Heatmap',
        a: 'Tab hit counts, dwell time per tab, visitor aggregate stats.',
      },
      {
        q: 'Achievements Hub',
        a: 'Badge popularity and collector leaderboard with real achievement IDs.',
      },
      {
        q: 'Scraper Pool',
        a: 'Proxy source list, merge pool stats, sample proxies from scraper store.',
      },
      {
        q: 'Checker Dashboard',
        a: 'Last check alive/dead counts, average latency from live results, sample table.',
      },
      {
        q: 'Reports Desk',
        a: 'Full history of vault account reports with status and linked account info.',
      },
      {
        q: 'Changelog Console',
        a: 'Parsed release list from changelog.ts — version, title, date, item counts. Bug-fix lines use P0–P9 pulsar dots (red→emerald); see FAQ → Changelog priority dots for the full legend.',
      },
      {
        q: 'Avatar CDN',
        a: 'Profile images on disk — size, owner, URLs.',
      },
      {
        q: 'Storage Explorer',
        a: 'Disk footprint for all data stores (auth, analytics, paste, proxies, chat, feeds …).',
      },
    ],
  },
  {
    id: 'awards',
    icon: '🎖️',
    title: 'Awards & Achievements',
    items: [
      {
        q: 'What are achievements and awards?',
        a: 'Achievements unlock through activity — login, profile, CLI, labs, vault, pastes, shoutbox, page visits, and more. Awards include exclusive admin honors and permanent Hall of Fame lb_top_* titles. Shown on profile with tier styles (Bronze → Mythic).',
      },
      {
        q: 'How many achievements exist?',
        a: 'Dozens of named achievements plus many milestone tiers (page visits, shoutbox sends, paste create/views, image uploads, online minutes, changelog reads …). The scrollable catalog below lists every entry with difficulty and unlock hints.',
      },
      {
        q: 'What do difficulty levels mean?',
        a: 'Trivial/Easy = first visit or one step · Medium = some effort · Hard = grind or timing · Legendary = rare totals · Exclusive = admins/BOT only.',
      },
      {
        q: 'How do I get achievement notifications?',
        a: 'Toast on unlock — click OK or X. Multiple unlocks queue one after another. The BOT also posts 🎖️ achievement congrats in shoutbox (single unlock or batched summary) with a link to your profile — including Paste and Rock Paper Scissors milestones.',
      },
      {
        q: 'Are achievements detected automatically?',
        a: 'Yes — sync on login, profile save, tab visit, commands, FAQ/changelog/news reads, uploads, pastes, claw grab, etc. POST /api/auth/achievements/sync.',
      },
      {
        q: 'Milestone achievements — examples?',
        a: 'Page Explorer tiers (10–99,999 visits) · Shoutbox tiers · Paste creator/viewer tiers · Image upload tiers · Online minutes tiers · Changelog reader tiers · Vault contributor/master/legend.',
      },
      {
        q: 'Can I see achievements on other profiles?',
        a: 'Yes — public showcase on their profile. Admin-only awards appear only for admin users (computed display).',
      },
    ],
  },
  {
    id: 'privacy',
    icon: '🔒',
    title: 'Privacy & Analytics',
    items: [
      {
        q: 'What is tracked when I browse?',
        a: 'Private-use analytics: tab visits, dwell time, session starts, logins, profile views, commands, FAQ/changelog reads. Stored locally in data/analytics/. No third-party ad trackers.',
      },
      {
        q: 'What is visitor intelligence?',
        a: 'Anonymous guest profiles (referrer, device type, landing path, UTM params) help admins understand traffic. Logged-in users link to username in admin Visitor Directory.',
      },
      {
        q: 'Can I opt out?',
        a: 'No per-user opt-out UI yet — analytics are part of the self-hosted terminal operator\'s private stats. Do not enter sensitive data in shoutbox or public pastes.',
      },
      {
        q: 'Are passwords stored in plain text?',
        a: 'User passwords are scrypt-hashed. Paste/vault passwords may be stored for feature functionality — treat shared credentials as sensitive.',
      },
    ],
  },
  {
    id: 'tech',
    icon: '⚙️',
    title: 'Tech, Data & Troubleshooting',
    items: [
      {
        q: 'What is the stack?',
        a: 'React 19, TypeScript, Vite, Tailwind 4, Node middleware APIs. Dev: npm run dev (port 3000). Production: npm run build && npm run start.',
      },
      {
        q: 'Where is data stored?',
        a: 'data/auth/ · data/analytics/ · data/games/ · data/paste/ · data/image-host/ · data/avatars/ · data/premium-accounts/ · data/proxy-database/ · data/proxy-scraper/ · data/proxy-checker/ · data/persona-database/ · data/colon-scraper-database/ · data/chat/ · data/feeds/ · data/access-control.json',
      },
      {
        q: 'Useful public APIs?',
        a: 'GET /api/terminal-stats · GET /api/status · GET /api/leaderboards · GET /api/games/state · GET /api/auth/stats · GET /api/proxy-db/stats · GET /api/paste/trending — admin routes under /api/admin/* require admin session.',
      },
      {
        q: 'Session & security?',
        a: 'HttpOnly cookie lul_session. Passwords: scrypt. HTTP 401 = not signed in · 403 = forbidden role.',
      },
      {
        q: 'Page feels slow or scales oddly?',
        a: 'Layout targets 1366×768 with responsive scale. Browser zoom affects fit. Hard reload (Ctrl+F5) clears stale assets.',
      },
      {
        q: 'System Status shows Degraded — is the site broken?',
        a: 'Usually not. Check the specific service message. Common: proxy checker never run on fresh install, or analytics log nearly full. Admin can address per module.',
      },
      {
        q: 'Something not working?',
        a: 'Check browser console, sign out/in, hard reload. Open System Status for service-level hints. Read Change Log for recent fixes. Server operators: check terminal logs.',
      },
      {
        q: 'How do I run locally?',
        a: 'Clone repo → npm install → npm run dev → open http://localhost:3000. Seed users: npm run seed:auth (if empty). Default admin/vip demos in FAQ auth section.',
      },
    ],
  },
];