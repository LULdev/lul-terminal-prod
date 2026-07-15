/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BOT shoutbox auto-post catalog — live vs planned activity hooks.
 */

export type BotActivityEntry = {
  id: string;
  status: 'live' | 'planned';
  trigger: string;
  example: string;
};

export const BOT_ACTIVITY_CATALOG: BotActivityEntry[] = [
  {
    id: 'welcome',
    status: 'live',
    trigger: 'User registers',
    example: 'Welcome to our newest Member @username',
  },
  {
    id: 'referral',
    status: 'live',
    trigger: 'Register via invite / referral code',
    example: '@newbie joined LUL Terminal via @referrer\'s invite link',
  },
  {
    id: 'achievement',
    status: 'live',
    trigger: 'Achievement unlocked',
    example: '🎖️ Achievement unlocked! @username earned ✊ First Blood! Congrats — check your profile.',
  },
  {
    id: 'account_approved',
    status: 'live',
    trigger: 'Admin approves premium account',
    example: '@username has added new Netflix Premium Account in category …',
  },
  {
    id: 'account_submitted',
    status: 'live',
    trigger: 'User submits account for review',
    example: '@username has submitted a new {service} account for review in {category}',
  },
  {
    id: 'meme_created',
    status: 'live',
    trigger: 'Meme exported (PNG download / clipboard) while logged in',
    example: '@username has created a new {Meme} with the {Meme Generator}',
  },
  {
    id: 'image_hosted',
    status: 'live',
    trigger: 'Image uploaded via Image Hosting',
    example: '@username has uploaded a new {image} via Image Hosting',
  },
  {
    id: 'paste_published',
    status: 'live',
    trigger: 'Paste published via Paste module',
    example: '@username has published a new paste {title} via Paste',
  },
  {
    id: 'proxy_scrape',
    status: 'planned',
    trigger: 'Proxy scraper run finishes with results',
    example: '@username scraped {n} fresh proxies with the {Proxy Scraper}',
  },
  {
    id: 'persona_forged',
    status: 'planned',
    trigger: 'Identity Forge persona saved to database',
    example: '@username forged a new persona with the {Identity Forge}',
  },
  {
    id: 'claw_victim',
    status: 'planned',
    trigger: 'Claw catches cursor (Fun tab)',
    example: '@username was snatched by the claw in the {Fun} module',
  },
  {
    id: 'vip_granted',
    status: 'planned',
    trigger: 'Admin promotes user to VIP',
    example: '@username was crowned VIP by the grid operators',
  },
  {
    id: 'profile_milestone',
    status: 'planned',
    trigger: 'Profile views / online minutes milestone',
    example: '@username reached {n} profile views — grid famous!',
  },
];