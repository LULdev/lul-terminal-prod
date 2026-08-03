/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auto-send console catalog (intentionally empty — no scheduled dumps).
 */

import type { LogLine } from '../types';

export type AutoConsoleMessage = {
  id: string;
  message: string;
  type: LogLine['type'];
  trigger: 'interval' | 'event' | 'system';
};

/** Auto-sent console messages. Empty: no catalog dump on login / !autos. */
export const AUTO_CONSOLE_MESSAGES: AutoConsoleMessage[] = [];

export const AUTO_INTERVAL_MESSAGES = AUTO_CONSOLE_MESSAGES.filter((m) => m.trigger === 'interval');

export function postAllAutoMessages(
  append: (msg: string, type?: LogLine['type']) => void,
) {
  if (AUTO_CONSOLE_MESSAGES.length === 0) {
    append('No auto-send messages registered.', 'info');
    return;
  }
  append('═══ AUTO STREAM CATALOG ═══', 'success');
  append(`${AUTO_CONSOLE_MESSAGES.length} auto-send messages registered:`, 'info');
  for (const entry of AUTO_CONSOLE_MESSAGES) {
    append(`[${entry.trigger.toUpperCase()}] ${entry.message}`, entry.type);
  }
  append('═══ END AUTO STREAM ═══', 'success');
}
