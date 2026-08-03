/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Seeds LUL Wire with feature launch articles + platform news.
 * Run: node scripts/seed-news-articles.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEWS_FILE = path.join(__dirname, '..', 'data', 'feeds', 'news.json');

const BASE = new Date('2026-07-08T12:00:00.000Z');

function tabLink(tab) {
  return `/?tab=${tab}`;
}

function profileLink() {
  return '/profile/username';
}

function articleBlock({ purpose, functionality, benefits, link, linkLabel }) {
  return [
    'AVAILABLE NOW — open the module from the sidebar or use the direct link below.',
    '',
    `Purpose: ${purpose}`,
    `Functionality: ${functionality}`,
    `Benefits: ${benefits}`,
    '',
    `→ ${linkLabel ?? 'Open'}: ${link}`,
  ].join('\n');
}

function daysAgo(n) {
  const d = new Date(BASE);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function feat(id, opts) {
  return {
    id,
    category: opts.category ?? 'FEATURE LAUNCH',
    icon: opts.icon ?? '📡',
    title: opts.title,
    body: articleBlock({
      purpose: opts.purpose,
      functionality: opts.functionality,
      benefits: opts.benefits,
      link: opts.link,
      linkLabel: opts.linkLabel,
    }),
    highlight: Boolean(opts.highlight),
    publishedAt: opts.publishedAt ?? daysAgo(opts.daysAgo ?? 0),
  };
}

const GAMES = [
  { id: 'game-rps', icon: '✊', title: 'Rock Paper Scissors — Live in the Arcade', purpose: 'Fast classic duels with LULcoin stakes.', functionality: 'Queue PvP or play the bot in best-of-three rounds; pick rock, paper, or scissors each turn.', benefits: 'Quick matches, jackpot chance on PvP wins, stats on your profile.', daysAgo: 12 },
  { id: 'game-ttt', icon: '⭕', title: 'Tic-Tac-Toe — Now Available', purpose: '3×3 grid strategy duels for members.', functionality: 'Place ✕ or ○; first three-in-a-row wins the pot, full board refunds both bets.', benefits: 'Simple rules, streak bonuses, leaderboard integration.', daysAgo: 13 },
  { id: 'game-connect4', icon: '🔴', title: 'Connect Four — Released', purpose: 'Drop-token strategy battles.', functionality: 'Take turns filling columns; connect four discs vertically, horizontally, or diagonally to win.', benefits: 'Deeper tactics than TTT, draw detection, full PvP escrow.', daysAgo: 14 },
  { id: 'game-nim', icon: '🪨', title: 'Nim — Strategy Mode Live', purpose: 'Mathematical pile-taking duels.', functionality: 'Piles of 3 · 5 · 7 — remove stones from one pile per turn; the player who takes the last stone wins.', benefits: 'Teaches optimal play, ranked stats, bot practice.', daysAgo: 15 },
  { id: 'game-coinflip', icon: '🪙', title: 'Coin Flip — Instant Duel', purpose: 'Binary luck duels in seconds.', functionality: 'Pick heads or tails; server flips; matching side wins.', benefits: 'Zero queue time, ideal for micro-bets, bot difficulty tiers.', daysAgo: 16 },
  { id: 'game-dice', icon: '🎲', title: 'Dice Duel — Roll for Glory', purpose: 'High-roll instant competition.', functionality: 'Both players roll 1d6; higher result wins, ties refund.', benefits: 'One-click rounds, clear odds, fast coin turnover.', daysAgo: 17 },
  { id: 'game-oddeven', icon: '🔢', title: 'Odd or Even — Parity Guessing', purpose: 'Predict the parity of a server roll.', functionality: 'Choose odd or even; server rolls d6; correct parity wins.', benefits: 'Easy onboarding for new players, instant resolution.', daysAgo: 18 },
  { id: 'game-war', icon: '🃏', title: 'Card War — High Card Wins', purpose: 'Single-flip card showdowns.', functionality: 'Both flip one card; higher rank wins, equal ranks draw.', benefits: 'No strategy curve — pure speed and suspense.', daysAgo: 19 },
  { id: 'game-rpsls', icon: '🦎', title: 'RPS Lizard Spock — Five-Way Duels', purpose: 'Extended Rock-Paper-Scissors variant.', functionality: 'Pick among five symbols with classic counter rules.', benefits: 'More variety than RPS, same instant duel engine.', daysAgo: 20 },
  { id: 'game-numberduel', icon: '🔟', title: 'Number Duel — Pick 1–10', purpose: 'Secret number showdowns.', functionality: 'Both pick 1–10; higher number wins, ties refund.', benefits: 'Mind-game meta, quick bot matches.', daysAgo: 21 },
  { id: 'game-colorpick', icon: '🎨', title: 'Color Pick — Lucky Hue', purpose: 'Guess the winning color.', functionality: 'Select red, blue, green, or yellow; server draws the winning color.', benefits: 'Visual flair, casual-friendly, instant feedback.', daysAgo: 22 },
  { id: 'game-highlow', icon: '📈', title: 'High or Low — Threshold Guess', purpose: 'Predict whether a random value is above or below 50.', functionality: 'Server picks 1–100; guess high or low against the midpoint.', benefits: 'Probability intuition, fast rounds.', daysAgo: 23 },
  { id: 'game-mines', icon: '💣', title: 'Minefield — Avoid the Blast', purpose: 'Risk-reward cell selection.', functionality: '3×3 grid with one hidden mine; pick a cell — hit the mine and lose.', benefits: 'Tension in one click, unique loss condition.', daysAgo: 24 },
  { id: 'game-blackjack', icon: '🂡', title: 'Blackjack Duel — Closest to 21', purpose: 'Auto-dealt card totals compared head-to-head.', functionality: 'Deal two cards each; closest to 21 without busting wins.', benefits: 'Casino familiarity, no manual hit/stand — pure duel speed.', daysAgo: 25 },
];

const FEATURES = [
  { id: 'feat-dashboard', icon: '🏠', title: 'Member Dashboard — Your Command Home', tab: 'dashboard', purpose: 'Personal home base after sign-in.', functionality: 'Quick stats, achievement progress, referral snippet, security shortcuts, and links to profile and activity.', benefits: 'One screen to resume where you left off — no hunting through menus.', daysAgo: 2 },
  { id: 'feat-stats', icon: '📡', title: 'Terminal Pulse — Live Community Stats', tab: 'stats', purpose: 'Real-time terminal and community metrics.', functionality: 'Counters for users, shoutbox, proxies, storage, and live activity feeds.', benefits: 'See platform health at a glance without admin access.', daysAgo: 3 },
  { id: 'feat-status', icon: '📟', title: 'System Status — Service Health Monitor', tab: 'status', purpose: 'Transparent uptime and probe results.', functionality: 'Live checks for shoutbox, auth, storage, scrapers, and core APIs with latency grades.', benefits: 'Know what works before you rely on it.', daysAgo: 4 },
  { id: 'feat-leaderboard', icon: '🏆', title: 'Hall of Fame — Leaderboards & Awards', tab: 'leaderboard', purpose: 'Celebrate top members across categories.', functionality: 'Top-3 boards for shoutbox, games, referrals, and more; award badges sync to profiles.', benefits: 'Competitive visibility and bragging rights.', daysAgo: 5 },
  { id: 'feat-faq', icon: '❓', title: 'FAQ — Help Center Now Online', tab: 'faq', purpose: 'Self-service documentation for every module.', functionality: 'Searchable sections covering access, tools, games, chat, and troubleshooting.', benefits: 'Answers without waiting for support.', daysAgo: 6 },
  { id: 'feat-invite', icon: '🎁', title: 'Invite Friends — Referral Network', tab: 'invite', purpose: 'Grow the community with personal invite links.', functionality: 'Copy referral URL and code; track referred signups on your profile.', benefits: 'Rewards social growth and unlocks referral achievements.', daysAgo: 7 },
  { id: 'feat-memegen', icon: '🖼️', title: 'Meme Generator — Create & Export', tab: 'memegen', purpose: 'Build memes from templates with custom text.', functionality: 'Imgflip template library, top/bottom text, export to image host, optional shoutbox announce.', benefits: 'Shareable content in minutes.', daysAgo: 8 },
  { id: 'feat-imagehost', icon: '☁️', title: 'Image Hosting — Upload & Gallery', tab: 'imagehost', purpose: 'Member image CDN with stats.', functionality: 'Upload PNG/JPEG/GIF/WebP, gallery view, view counts, and public links.', benefits: 'Reliable hosting tied to your account.', daysAgo: 9 },
  { id: 'feat-paste', icon: '📋', title: 'Paste — Share Code & Text', tab: 'paste', purpose: 'Syntax-friendly paste bin.', functionality: 'Create pastes with expiry, optional password, language tags, and view tracking.', benefits: 'Share snippets safely without external services.', daysAgo: 10 },
  { id: 'feat-proxydatabase', icon: '🗄️', title: 'Proxy Database — Working Proxy Index', tab: 'proxydatabase', purpose: 'Curated proxy list with daily checks.', functionality: 'Browse alive proxies, filter by type, export lists, auto-purge dead entries.', benefits: 'Skip broken proxies before your scrape runs.', daysAgo: 11 },
  { id: 'feat-premiumaccounts', icon: '👑', title: 'Free Premium Accounts — Member Vault', tab: 'premiumaccounts', purpose: 'Community-shared premium logins (VIP).', functionality: 'Category browser, quick-add submissions, report broken accounts, VIP gate protection.', benefits: 'Central vault instead of scattered shares.', daysAgo: 26 },
  { id: 'feat-tools', icon: '🛠️', title: 'Net Toolkit — WHOIS, DNS & IP Tools', tab: 'tools', purpose: 'Network diagnostics in one lab.', functionality: 'WHOIS, DNS lookup, IP info, deduplication utilities, and batch helpers.', benefits: 'No tab-hopping to external WHOIS sites.', daysAgo: 27 },
  { id: 'feat-textlab', icon: '📝', title: 'Text Laboratory — Transform & Analyze', tab: 'textlab', purpose: 'Text manipulation playground.', functionality: 'Case transforms, slugify, counters, encoding helpers, and copy-friendly output.', benefits: 'Writer and dev utilities in one panel.', daysAgo: 28 },
  { id: 'feat-colorlab', icon: '🎨', title: 'Color Spectrum — Palettes & Contrast', tab: 'colorlab', purpose: 'Color tooling for designers.', functionality: 'HEX/RGB conversion, palette generation, contrast checks, and export swatches.', benefits: 'Accessible color picks without leaving the terminal.', daysAgo: 29 },
  { id: 'feat-meme', icon: '🎲', title: 'Chaos Generator — Memes, Jokes & Oracles', tab: 'meme', purpose: 'Random fun content on demand.', functionality: 'Fortune cookies, jokes, ASCII art, and chaos oracles from the terminal.', benefits: 'Break the ice in shoutbox or streams.', daysAgo: 30 },
  { id: 'feat-toolvault', icon: '🧰', title: 'Tool Vault — 480+ Micro-Tools', tab: 'toolvault', purpose: 'Searchable catalog of tiny utilities.', functionality: 'Categories, subcategories, search, pagination, and recently-used tracking.', benefits: 'One search box for hundreds of one-off tools.', daysAgo: 31 },
  { id: 'feat-profile', icon: '👤', title: 'Public Profiles — Identity & Customization', tab: 'profile', purpose: 'Showcase your terminal persona.', functionality: 'Avatar, bio, arcade stats, achievements, leaderboards, and theme customization.', benefits: 'Readable at /profile/username — yours is editable, others are view-only.', daysAgo: 32, link: profileLink(), linkLabel: 'Example profile' },
  { id: 'feat-activity', icon: '📊', title: 'My Activity — Personal Analytics', tab: 'activity', purpose: 'Your usage history in one timeline.', functionality: 'Login streaks, tabs visited, shoutbox sends, changelog reads, and achievement context.', benefits: 'Understand your own engagement patterns.', daysAgo: 33 },
];

const PLATFORM_NEWS = [
  feat('news-chat-emotes', {
    category: 'PLATFORM UPDATE',
    icon: '😀',
    title: 'Custom Chat Emotes — Upload GIFs & Codes',
    highlight: true,
    daysAgo: 0,
    purpose: 'Replace unicode smileys with admin-uploaded emotes.',
    functionality: 'Admins upload images/GIFs; members pick from the emote menu or type :Code: in shoutbox.',
    benefits: 'Branded community expressions with zero client install.',
    link: tabLink('admin'),
    linkLabel: 'Admin emotes panel',
  }),
  feat('news-shoutbox-chips', {
    category: 'PLATFORM UPDATE',
    icon: '💬',
    title: 'Shoutbox User Chips — Profiles, Ping & Moderation',
    highlight: true,
    daysAgo: 0,
    purpose: 'Richer chat identity and faster moderation.',
    functionality: 'Avatar + username chips; left-click profile, right-click ping/mute/ban; middle-click ping & send.',
    benefits: 'Comfortable UX for members and admins in one control.',
    link: tabLink('news'),
  }),
  feat('news-arcade-hub', {
    category: 'GAME RELEASE',
    icon: '🎲',
    title: 'Game Arcade Hub — 14 Titles, One Lobby',
    daysAgo: 1,
    purpose: 'Unified coin-duel destination for all multiplayer games.',
    functionality: 'Browse classic, strategy, and instant games; queue PvP, challenge bots, track LULcoins and jackpots.',
    benefits: 'Single entry point instead of scattered mini-games.',
    link: tabLink('games'),
  }),
  feat('news-achievements', {
    category: 'COMMUNITY',
    icon: '🎖️',
    title: 'Achievements & Badge Showcase',
    daysAgo: 34,
    purpose: 'Reward exploration and skill across the platform.',
    functionality: 'Unlock badges for chat, games, profile completion, and leaderboards; showcase on your profile.',
    benefits: 'Visible progression beyond raw stats.',
    link: tabLink('profile'),
  }),
  feat('news-admin-center', {
    category: 'PLATFORM UPDATE',
    icon: '🛡️',
    title: 'Admin Command Center — Modular Ops Dashboard',
    daysAgo: 35,
    purpose: 'Centralized administration without scrolling megapanels.',
    functionality: 'Tabbed modules for users, shoutbox, emotes, analytics, visibility, and 25+ ops tools.',
    benefits: 'Admins find the right tool in seconds.',
    link: tabLink('admin'),
  }),
  feat('news-registration', {
    category: 'SECURITY BULLETIN',
    icon: '🔐',
    title: 'One Account Per Person — Registration Barriers',
    daysAgo: 36,
    purpose: 'Fair community with anti-alt protections.',
    functionality: 'Multi-layer signals: IP subnet, canvas fingerprint, email canonicalization, challenge tokens, honeypots.',
    benefits: 'Reduces abuse while keeping legitimate signups smooth.',
    link: tabLink('faq'),
  }),
  feat('news-changelog', {
    category: 'PLATFORM UPDATE',
    icon: '📜',
    title: 'Changelog Archive — Paginated Release History',
    daysAgo: 37,
    purpose: 'Transparent version history for every release.',
    functionality: 'Priority-tagged entries, 6 releases per page, keyboard navigation, view counters.',
    benefits: 'See exactly what shipped and when.',
    link: tabLink('changelog'),
  }),
  feat('news-lul-wire', {
    category: 'BULLETIN',
    icon: '📰',
    title: 'LUL Wire — Official News Portal',
    daysAgo: 38,
    purpose: 'Breaking updates and feature announcements.',
    functionality: 'Search, breaking filter, grid/list layouts, view tracking, and admin publishing.',
    benefits: 'Stay current without reading raw changelogs.',
    link: tabLink('news'),
  }),
];

const gameArticles = GAMES.map((g) =>
  feat(g.id, {
    category: 'GAME RELEASE',
    icon: g.icon,
    title: g.title,
    daysAgo: g.daysAgo,
    purpose: g.purpose,
    functionality: g.functionality,
    benefits: g.benefits,
    link: tabLink('games'),
    linkLabel: 'Open Arcade Hub',
  }),
);

const featureArticles = FEATURES.map((f) =>
  feat(f.id, {
    icon: f.icon,
    title: f.title,
    daysAgo: f.daysAgo,
    purpose: f.purpose,
    functionality: f.functionality,
    benefits: f.benefits,
    link: f.link ?? tabLink(f.tab),
  }),
);

const allRaw = [...PLATFORM_NEWS, ...featureArticles, ...gameArticles];

const now = new Date().toISOString();

function normalize(raw) {
  return {
    id: raw.id,
    title: raw.title,
    body: raw.body,
    category: raw.category,
    icon: raw.icon,
    highlight: Boolean(raw.highlight),
    active: true,
    publishedAt: raw.publishedAt,
    createdAt: now,
    updatedAt: now,
    authorId: 'system',
    authorName: 'LUL Wire',
  };
}

const articles = allRaw
  .map(normalize)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const db = {
  version: 1,
  feedVersion: new Date().toISOString().slice(0, 19),
  updatedAt: now,
  articles,
};

await fs.mkdir(path.dirname(NEWS_FILE), { recursive: true });
await fs.writeFile(NEWS_FILE, JSON.stringify(db, null, 2), 'utf8');

console.log(`Seeded ${articles.length} articles → ${NEWS_FILE}`);