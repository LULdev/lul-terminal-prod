/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogLine } from '../types';

export type TerminalAppendFn = (
  msg: string,
  type?: LogLine['type'],
  commandToRun?: string,
) => void;

let appendFn: TerminalAppendFn = () => {};

export function registerTerminalAppend(fn: TerminalAppendFn | null): void {
  appendFn = fn ?? (() => {});
}

export function terminalAppend(
  msg: string,
  type?: LogLine['type'],
  commandToRun?: string,
): void {
  appendFn(msg, type, commandToRun);
}