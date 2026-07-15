/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogLine } from '../types';

export type AutoConsoleMessage = {
  id: string;
  message: string;
  type: LogLine['type'];
  trigger: 'interval' | 'event' | 'system';
};

/** All auto-sent console messages (catalog). */
export const AUTO_CONSOLE_MESSAGES: AutoConsoleMessage[] = [
  { id: 'battery-low', message: '⚠️ CRITICAL: Auxiliary battery low. Mainframe grid power recommended.', type: 'alert', trigger: 'event' },
  { id: 'battery-15', message: '⚡ Discharge trigger: Forced system battery down to 15%.', type: 'warn', trigger: 'event' },
  { id: 'battery-5', message: '⚡ Discharge trigger: Forced system battery down to 5%.', type: 'warn', trigger: 'event' },
  { id: 'battery-full', message: '🔌 Grid connected: Battery power level restored to 100%.', type: 'success', trigger: 'event' },
  { id: 'self-destruct-tick', message: '🚨 SELF-DESTRUCT IN T-MINUS N SECONDS...', type: 'alert', trigger: 'event' },
  { id: 'self-destruct-abort', message: '❌ SELF-DESTRUCT ABORTED: Runtime exception in self_destruct.sh line 42: "operator is too cool to die". System cooling down...', type: 'success', trigger: 'event' },
  { id: 'cursor-snatch', message: '🎯 CURSOR SNATCHED! Gravity core localized. Escape probability: < 0.1%', type: 'alert', trigger: 'event' },
  { id: 'quantum-leak', message: '💨 Brief quantum leakage detected — claw re-arming...', type: 'warn', trigger: 'event' },
  { id: 'trap-btn', message: '🎉 TRAP BUTTON clicked! System over-excitation triggered!', type: 'success', trigger: 'event' },
  { id: 'trap-cool', message: '⚙️ System cooled down. Gravity grids restored. (The claw remembers.)', type: 'info', trigger: 'event' },
  { id: 'sign-out', message: '🔴 Sign-out triggered. Session ended.', type: 'warn', trigger: 'event' },
  { id: 'warm-reboot', message: '🔄 Warm reboot complete. CRT scanlines re-synchronized.', type: 'success', trigger: 'event' },
];

export const AUTO_INTERVAL_MESSAGES = AUTO_CONSOLE_MESSAGES.filter((m) => m.trigger === 'interval');

export function postAllAutoMessages(
  append: (msg: string, type?: LogLine['type']) => void,
) {
  append('═══ AUTO STREAM CATALOG ═══', 'success');
  append(`${AUTO_CONSOLE_MESSAGES.length} auto-send messages registered:`, 'info');
  for (const entry of AUTO_CONSOLE_MESSAGES) {
    append(`[${entry.trigger.toUpperCase()}] ${entry.message}`, entry.type);
  }
  append('═══ END AUTO STREAM ═══', 'success');
}