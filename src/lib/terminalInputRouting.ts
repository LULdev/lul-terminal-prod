/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const TERMINAL_PREFIX = '!';

/** True when input should run a diagnostic terminal command (not shoutbox chat). */
export function isTerminalCommand(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith(TERMINAL_PREFIX) && trimmed.length > 1;
}

/** Strip leading ! markers and return the command body. */
export function parseTerminalCommand(text: string): string {
  return text.trim().replace(/^!+/, '').trim();
}

/** Normalize a command body to the canonical !command form for history and click-to-run. */
export function formatTerminalCommand(body: string): string {
  const normalized = parseTerminalCommand(body);
  return normalized ? `${TERMINAL_PREFIX}${normalized}` : TERMINAL_PREFIX;
}