/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchMe } from './auth';
import { invalidateSession } from './sessionEvents';

const API = '/api/chat/emotes';

export class ChatEmotesAuthError extends Error {
  constructor() {
    super('CHAT_EMOTES_AUTH_REQUIRED');
    this.name = 'ChatEmotesAuthError';
  }
}

export type ChatEmote = {
  id: string;
  code: string;
  label: string;
  url: string;
  enabled: boolean;
  isPlaceholder?: boolean;
};

export type ChatEmotesResponse = {
  updatedAt: string | null;
  emotes: ChatEmote[];
};

export async function fetchChatEmotes(): Promise<ChatEmotesResponse> {
  const res = await fetch(API, { credentials: 'include' });
  if (res.status === 401) {
    const me = await fetchMe().catch(() => ({ user: null }));
    if (!me.user) invalidateSession();
    throw new ChatEmotesAuthError();
  }
  if (!res.ok) throw new Error('Emotes unavailable');
  return res.json() as Promise<ChatEmotesResponse>;
}

export function emoteToken(code: string): string {
  return `:${code}:`;
}