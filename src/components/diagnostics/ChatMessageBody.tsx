/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { ChatMessage, ChatSegment, PinnedMessage } from '../../lib/chat';
import { safeHref } from '../../lib/safeHref';

export function shoutboxUsernameDisplay(username: string, label?: string): string {
  const raw = String(username || label || '').trim();
  return raw.replace(/^@+/, '');
}

export function safeEmoteUrl(url: string | undefined): string | null {
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('/api/chat/emotes/files/') && !raw.startsWith('//')) return raw;
  if (raw.startsWith('/emotes/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw, 'http://localhost');
    if (parsed.pathname.startsWith('/api/chat/emotes/files/')) return parsed.pathname;
    if (parsed.pathname.startsWith('/emotes/')) return parsed.pathname;
  } catch { /* invalid */ }
  return null;
}

function EmoteImg({ seg }: { seg: Extract<ChatSegment, { type: 'emote' }> }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return <span className="text-fuchsia-300/80 font-mono text-[9px]">:{seg.code}:</span>;
  }
  const src = safeEmoteUrl(seg.url);
  if (!src) {
    return <span className="text-fuchsia-300/80 font-mono text-[9px]">:{seg.code}:</span>;
  }
  return (
    <img
      src={src}
      alt={seg.label}
      title={`:${seg.code}:`}
      className="inline-block align-middle w-6 h-6 mx-0.5 object-contain rounded"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

export function SegmentView({
  seg,
  onOpenProfile,
}: {
  seg: ChatSegment;
  onOpenProfile?: (username: string) => void;
}) {
  if (seg.type === 'user') {
    const displayName = shoutboxUsernameDisplay(seg.username, seg.label);
    if (onOpenProfile && seg.username) {
      return (
        <button
          type="button"
          onClick={() => onOpenProfile(seg.username)}
          className="shoutbox-segment-link font-semibold hover:opacity-90 bg-transparent border-0 p-0 cursor-pointer font-inherit"
        >
          {displayName}
        </button>
      );
    }
    const href = safeHref(seg.href);
    if (!href) return <span className="font-semibold">{displayName}</span>;
    return (
      <a href={href} rel="noopener noreferrer" className="shoutbox-segment-link font-semibold hover:opacity-90">
        {displayName}
      </a>
    );
  }
  if (seg.type === 'link') {
    const href = safeHref(seg.href);
    if (!href) return <span className="font-semibold">{seg.label}</span>;
    return (
      <a href={href} rel="noopener noreferrer" className="shoutbox-segment-link font-semibold hover:opacity-90">
        {seg.label}
      </a>
    );
  }
  if (seg.type === 'emote') {
    return <EmoteImg seg={seg} />;
  }
  if (seg.type === 'text') {
    if (seg.style === 'command') {
      return <span className="shoutbox-segment-cmd">{seg.text}</span>;
    }
    if (seg.style === 'achievement') {
      return <span className="text-amber-300 font-semibold">{seg.text}</span>;
    }
    return <span>{seg.text}</span>;
  }
  return null;
}

export type ChatMessageBodySource = {
  text: string;
  segments?: ChatSegment[] | null;
};

export function ChatMessageBody({
  msg,
  onOpenProfile,
}: {
  msg: ChatMessageBodySource | ChatMessage | PinnedMessage;
  onOpenProfile?: (username: string) => void;
}) {
  if (msg.segments?.length) {
    return (
      <span className="break-words whitespace-pre-wrap">
        {msg.segments.map((seg, i) => (
          <React.Fragment key={i}>
            <SegmentView seg={seg} onOpenProfile={onOpenProfile} />
          </React.Fragment>
        ))}
      </span>
    );
  }
  return <span className="break-words whitespace-pre-wrap">{msg.text}</span>;
}

export function isBotSpeaker(msg: Pick<ChatMessage, 'role' | 'kind'>): boolean {
  return msg.role === 'bot';
}