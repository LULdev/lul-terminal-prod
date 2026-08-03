/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchMe } from './auth';
import { getSessionEpoch, invalidateSession } from './sessionEvents';

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
    // Only wipe session when /me confirms logout — network/5xx must not force logout
    const epochAtStart = getSessionEpoch();
    try {
      const me = await fetchMe();
      if (!me.user) invalidateSession({ epoch: epochAtStart });
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 401) invalidateSession({ epoch: epochAtStart });
    }
    throw new ChatEmotesAuthError();
  }
  if (!res.ok) throw new Error('Emotes unavailable');
  return res.json() as Promise<ChatEmotesResponse>;
}

export function emoteToken(code: string): string {
  return `:${code}:`;
}