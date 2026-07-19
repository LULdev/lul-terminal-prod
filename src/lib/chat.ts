/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserRole } from '../types/auth';
import { fetchMe } from './auth';
import { parseRetryAfterMs } from './retryAfter';
import { invalidateSession } from './sessionEvents';

const API = '/api/chat';

let chatAudioCtx: AudioContext | null = null;

export type ChatSegment =
  | { type: 'text'; text: string; style?: string }
  | { type: 'user'; username: string; href: string; label: string }
  | { type: 'link'; href: string; label: string }
  | { type: 'emote'; code: string; label: string; url: string };

export type ChatMessageKind = 'chat' | 'bot' | 'system' | 'action' | 'pinned' | 'ping' | 'achievement';

export type ChatMessage = {
  id: string;
  lobby: string;
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  verified?: boolean;
  avatarUrl?: string | null;
  kind: ChatMessageKind;
  text: string;
  segments: ChatSegment[] | null;
  createdAt: number;
};

export type PinnedMessage = {
  id: string;
  kind: 'pinned';
  text: string;
  segments: ChatSegment[] | null;
};

export type LobbyMessagesResponse = {
  lobby: string;
  pinned: PinnedMessage;
  messages: ChatMessage[];
  updatedAt: string | null;
};

export type SendChatResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterMs?: number };

export class ChatAuthRequiredError extends Error {
  constructor() {
    super('CHAT_AUTH_REQUIRED');
    this.name = 'ChatAuthRequiredError';
  }
}

export class ChatRateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs = 60_000) {
    super('Too many requests');
    this.name = 'ChatRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ChatFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ChatFetchError';
    this.status = status;
  }
}

export class ChatGatedError extends Error {
  constructor(message = 'Permission denied') {
    super(message);
    this.name = 'ChatGatedError';
  }
}

export async function fetchLobbyMessages(opts: { since?: number; limit?: number } = {}): Promise<LobbyMessagesResponse> {
  const params = new URLSearchParams();
  if (opts.since) params.set('since', String(opts.since));
  if (opts.limit) params.set('limit', String(opts.limit));
  const q = params.toString();
  const url = `${API}/lobby/messages${q ? `?${q}` : ''}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401) {
    const guestRes = await fetch(url, {
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
    });
    if (guestRes.ok) {
      const me = await fetchMe().catch(() => ({ user: null }));
      if (!me.user) invalidateSession();
      return guestRes.json() as Promise<LobbyMessagesResponse>;
    }
    invalidateSession();
    throw new ChatAuthRequiredError();
  }
  if (res.status === 403) {
    const err = await res.json().catch(() => ({}));
    throw new ChatGatedError((err as { error?: string }).error ?? 'Permission denied');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ChatFetchError(res.status, (err as { error?: string }).error ?? 'Chat unavailable');
  }
  return res.json() as Promise<LobbyMessagesResponse>;
}

export type SendLobbyMessageResult = {
  message: ChatMessage;
  newUnlocks?: string[];
  unlockRewards?: Record<string, number>;
  unlockCoinsTotal?: number;
};

const MAX_MESSAGE_LEN = 280;

export async function sendLobbyMessage(text: string): Promise<SendLobbyMessageResult> {
  const body = text.trim();
  if (!body) throw new Error('Message text required');
  if (body.length > MAX_MESSAGE_LEN) throw new Error('Message too long (max 280)');
  const res = await fetch(`${API}/lobby/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: body }),
  });
  if (res.status === 401) {
    invalidateSession();
    throw new ChatAuthRequiredError();
  }
  if (res.status === 429) {
    throw new ChatRateLimitError(parseRetryAfterMs(res.headers.get('Retry-After'), 60_000));
  }
  if (res.status === 403) {
    const err = await res.json().catch(() => ({}));
    throw new ChatGatedError((err as { error?: string }).error ?? 'Permission denied');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Send failed');
  }
  const data = await res.json() as SendLobbyMessageResult & { message: ChatMessage };
  return {
    message: data.message,
    newUnlocks: data.newUnlocks,
    unlockRewards: data.unlockRewards,
    unlockCoinsTotal: data.unlockCoinsTotal,
  };
}

export function closeChatAudioContext() {
  if (chatAudioCtx && chatAudioCtx.state !== 'closed') {
    void chatAudioCtx.close();
  }
  chatAudioCtx = null;
}

function getChatAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!chatAudioCtx || chatAudioCtx.state === 'closed') {
      chatAudioCtx = new AudioCtx();
    }
    if (chatAudioCtx.state === 'suspended') void chatAudioCtx.resume();
    return chatAudioCtx;
  } catch {
    return null;
  }
}

export function playChatNotification(muted = false) {
  if (muted) return;
  try {
    const ctx = getChatAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch { /* ignore */ }
}

/**
 * Cheerful arpeggio when the BOT posts an achievement congrats in shoutbox.
 * Distinct from the short chat ping so players notice unlocks.
 */
export function playBotCongratsSound(muted = false) {
  if (muted) return;
  try {
    const ctx = getChatAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // C5 → E5 → G5 → C6 sparkle
    const notes = [
      { f: 523.25, at: 0, dur: 0.12 },
      { f: 659.25, at: 0.09, dur: 0.12 },
      { f: 783.99, at: 0.18, dur: 0.14 },
      { f: 1046.5, at: 0.28, dur: 0.28 },
    ];
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.14, t0);
    master.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
    master.connect(ctx.destination);

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t0 + n.at);
      g.gain.setValueAtTime(0.0001, t0 + n.at);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + n.at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.02);
    }

    // Soft high shimmer on top
    const shimmer = ctx.createOscillator();
    const shGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1568, t0 + 0.32);
    shGain.gain.setValueAtTime(0.0001, t0 + 0.32);
    shGain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.36);
    shGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    shimmer.connect(shGain);
    shGain.connect(master);
    shimmer.start(t0 + 0.32);
    shimmer.stop(t0 + 0.58);
  } catch { /* ignore */ }
}

/** BOT achievement congrats posts use kind "achievement". */
export function isBotCongratsMessage(msg: Pick<ChatMessage, 'kind' | 'role' | 'text'>): boolean {
  if (msg.kind === 'achievement') return true;
  if (msg.role === 'bot' && /congrats|achievement unlocked/i.test(String(msg.text ?? ''))) {
    return true;
  }
  return false;
}