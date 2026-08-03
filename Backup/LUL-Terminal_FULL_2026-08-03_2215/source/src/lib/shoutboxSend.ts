/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SendChatResult } from './chat';

type SendHandler = (text: string) => Promise<SendChatResult>;

let handler: SendHandler | null = null;

export function registerShoutboxSend(h: SendHandler | null) {
  handler = h;
}

export async function sendShoutboxCommand(text: string): Promise<SendChatResult> {
  if (!handler) return { ok: false, error: 'Chat not ready' };
  return handler(text);
}