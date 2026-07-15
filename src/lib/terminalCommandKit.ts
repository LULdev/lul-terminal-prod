/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { APP_VERSION } from '../config/version';
import type { LogLine } from '../types';

export const ALL_COMMANDS_ALIASES = new Set(['help', 'commands', 'cmds', 'befehle', 'liste']);

type CommandCatalogEntry = { label: string; hint: string; run: string };

export const COMMAND_CATALOG: { title: string; items: CommandCatalogEntry[] }[] = [
  {
    title: '🖥 System',
    items: [
      { label: '!commands', hint: 'this list', run: '!commands' },
      { label: '!stats', hint: 'Hits · Unique · Online', run: '!stats' },
      { label: '!reboot', hint: 'restart', run: '!reboot' },
      { label: '!clean', hint: 'clear console', run: '!clean' },
      { label: '!history', hint: 'last 10 commands', run: '!history' },
      { label: '!autos', hint: 'all auto messages', run: '!autos' },
    ],
  },
  {
    title: '🎨 UI',
    items: [
      { label: '!theme', hint: 'CRT Scanlines', run: '!theme' },
      { label: '!color <x>', hint: 'indigo emerald amber cyan rose', run: '!color emerald' },
      { label: '!matrix', hint: 'matrix overlay', run: '!matrix' },
      { label: '!ascii <txt>', hint: 'ASCII art', run: '!ascii LUL' },
      { label: '!beep', hint: '880Hz tone', run: '!beep' },
      { label: '!baudrate <n>', hint: '0=instant · 80=retro', run: '!baudrate 80' },
    ],
  },
  {
    title: '🌐 Network',
    items: [
      { label: '!ping <host>', hint: 'ICMP sim', run: '!ping google.com' },
      { label: '!weather <city>', hint: 'ASCII weather', run: '!weather Hamburg' },
    ],
  },
  {
    title: '🔒 Tools',
    items: [
      { label: '!hack', hint: 'Superuser (fake)', run: '!hack' },
      { label: '!keygen', hint: 'API-Token', run: '!keygen' },
      { label: '!colorconv <#hex>', hint: 'HEX→RGB', run: '!colorconv #6366f1' },
    ],
  },
  {
    title: '🎭 Fun',
    items: [
      { label: '!cowsay <txt>', hint: 'ASCII cow', run: '!cowsay Moo!' },
      { label: '!joke', hint: 'dev joke', run: '!joke' },
      { label: '!fortune', hint: 'fortune cookie', run: '!fortune' },
      { label: '!bsod', hint: 'blue screen', run: '!bsod' },
      { label: '!loader', hint: 'loading bar', run: '!loader' },
      { label: '!self-destruct', hint: 'Countdown', run: '!self-destruct' },
    ],
  },
];

export function printCompactCommandReference(
  append: (msg: string, type?: LogLine['type'], commandToRun?: string) => void,
) {
  append(`══ COMMANDS v${APP_VERSION} ══`, 'success');
  append('Click = run · Aliases: !help !cmds !befehle !liste', 'warn', '!commands');
  for (const { title, items } of COMMAND_CATALOG) {
    append(title, 'success');
    for (const { label, hint, run } of items) {
      append(` ${label.padEnd(17)} ${hint}`, 'info', run);
    }
  }
  append('UI: 🔋 Footer battery · 😈 Fun tab · 📟 Synth · 📺 CRT', 'info');
}

export function getCompactCommandHintLogs(time?: string): LogLine[] {
  const t = time ?? new Date().toLocaleTimeString('en-US', { hour12: false });
  const ts = Date.now();
  return [
    {
      id: 'boot-h',
      time: t,
      message: `LUL v${APP_VERSION} — shoutbox read open · sign in to chat · ↑↓ History`,
      type: 'success',
      ts,
    },
  ];
}

export const JOKES = [
  "Why do programmers wear glasses? Because they can't C#!",
  "There are 10 types of people in the world: those who understand binary, and those who don't.",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
  "A SQL query goes into a bar, walks up to two tables and asks, 'Can I join you?'",
  "['hip', 'hip'] (hip hip array!)",
  "Why did the programmer quit his job? Because he didn't get arrays.",
  "To understand what recursion is, you must first understand recursion.",
  "Hardware: The parts of a computer system that can be kicked.",
  "An optimist says: 'The glass is half-full.' A pessimist says: 'The glass is half-empty.' A programmer says: 'The glass is twice as large as necessary.'",
  "Why was the computer cold? It left its Windows open.",
];

export const FORTUNES = [
  "Your code will compile on the first try today. (Very high luck!)",
  "Beware of a missing semicolon in line 42.",
  "An unexpected prompt will bring you great laughter.",
  "You will find a bug that has been hiding since 2024.",
  "Great speed is in your future. Your algorithms will run in O(1) time.",
  "A clean compile is worth a thousand lines of documentation.",
  "The entity under your cursor is hungrier than usual today. Tread lightly.",
  "You will soon receive a pull request with zero merge conflicts.",
  "A coffee spill is imminent. Secure your perimeter.",
  "Your password hashes are secure, but you should still eat lasagna.",
];