/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MatrixOverlay } from '../MatrixOverlay';
import { ChatUserChip } from './ChatUserChip';
import { ChatRoleBadges } from './ChatRoleBadges';
import { ChatMessageBody, isBotSpeaker } from './ChatMessageBody';
import {
  ChatAuthRequiredError,
  ChatFetchError,
  ChatGatedError,
  ChatRateLimitError,
  fetchLobbyMessages,
  isBotCongratsMessage,
  playBotCongratsSound,
  playChatNotification,
  sendLobbyMessage,
  type ChatMessage,
  type SendChatResult,
} from '../../lib/chat';
import { useAuth } from '../../context/AuthContext';
import type { LogLine } from '../../types';

/** Match server DISPLAY_HISTORY — full shoutbox history load. */
const DISPLAY_LIMIT = 200;

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function ChatLine({
  msg,
  onOpenProfile,
  onMessageDeleted,
}: {
  msg: ChatMessage;
  onOpenProfile?: (username: string) => void;
  onMessageDeleted?: (messageId: string) => void;
}) {
  const botLine = isBotSpeaker(msg);
  const textClass = botLine
    ? 'shoutbox-msg-text shoutbox-msg-text--bot'
    : msg.kind === 'action' || msg.kind === 'ping'
      ? 'shoutbox-msg-text shoutbox-msg-text--action'
      : 'shoutbox-msg-text';

  return (
    <div className={`shoutbox-msg group ${botLine ? 'bot-message-row' : ''}`}>
      <span className="shoutbox-msg__time">[{formatTime(msg.createdAt)}]</span>

      {onOpenProfile ? (
        <ChatUserChip
          user={{
            userId: msg.userId,
            username: msg.username,
            displayName: msg.displayName,
            role: msg.role,
            avatarUrl: msg.avatarUrl ?? undefined,
            verified: msg.verified,
          }}
          onOpenProfile={onOpenProfile}
          messageId={msg.id}
          onMessageDeleted={onMessageDeleted}
        />
      ) : (
        <span className="shoutbox-msg__identity">
          <span className={`shoutbox-msg__name ${botLine ? 'bot-username-style' : ''}`}>@{msg.username}</span>
        </span>
      )}

      {/* Role badge + message on one line; message uses a different (non-mono) font */}
      <span className="shoutbox-msg__body">
        <ChatRoleBadges role={botLine ? 'bot' : msg.role} verified={msg.verified} compact />
        <span className={textClass}>
          <ChatMessageBody msg={msg} onOpenProfile={onOpenProfile} botMessage={botLine} />
        </span>
      </span>
    </div>
  );
}

function TerminalLogLine({
  log,
  themeText,
  onRun,
}: {
  log: LogLine;
  themeText: string;
  onRun?: (cmd: string) => void;
}) {
  const isClickable = !!log.commandToRun;
  return (
    <div
      className={`flex gap-2 items-start leading-tight ${isClickable ? 'group cursor-pointer' : ''}`}
      id={`log-item-${log.id}`}
      onClick={isClickable && onRun ? () => onRun(log.commandToRun!) : undefined}
    >
      <span className="text-slate-600 font-semibold shrink-0 select-none">[{log.time}]</span>
      <span
        className={`whitespace-pre-wrap leading-tight break-all min-w-0 ${
          isClickable
            ? `${themeText} hover:brightness-125 hover:underline decoration-dashed font-semibold transition-all duration-150`
            : log.type === 'success'
              ? 'text-green-400 font-semibold'
              : log.type === 'warn'
                ? 'text-amber-400'
                : log.type === 'alert'
                  ? 'text-red-500 font-extrabold animate-pulse'
                  : 'text-indigo-300'
        }`}
      >
        {log.message}
      </span>
    </div>
  );
}

type StreamEntry =
  | { kind: 'log'; ts: number; log: LogLine }
  | { kind: 'chat'; ts: number; msg: ChatMessage };

export type { SendChatResult };

type UnifiedTerminalPanelProps = {
  commandLogs: LogLine[];
  processCommand: (cmd: string) => void;
  themeText: string;
  isMatrixOverlayActive: boolean;
  onCloseMatrix: () => void;
  isMuted?: boolean;
  pollEnabled?: boolean;
  onSendChatReady?: (send: (text: string) => Promise<SendChatResult>) => void;
  onOpenProfile?: (username: string) => void;
  onChatUnlocks?: (ids: string[], rewards?: Record<string, number>, coinsTotal?: number) => void;
};

export function UnifiedTerminalPanel({
  commandLogs,
  processCommand,
  themeText,
  isMatrixOverlayActive,
  onCloseMatrix,
  isMuted = false,
  pollEnabled = true,
  onSendChatReady,
  onOpenProfile,
  onChatUnlocks,
}: UnifiedTerminalPanelProps) {
  const { isLoggedIn, refresh } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatStatus, setChatStatus] = useState<'ok' | 'offline' | 'rate_limited' | 'gated'>('ok');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef(0);
  const lobbyUpdatedAtRef = useRef<string | null>(null);
  const knownIdsRef = useRef(new Set<string>());
  const initialDoneRef = useRef(false);
  const loadGenRef = useRef(0);
  const pollBackoffRef = useRef(4000);
  const mountedRef = useRef(true);
  const isMutedRef = useRef(isMuted);
  const hadMessagesRef = useRef(false);

  const handleMessageDeleted = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    knownIdsRef.current.delete(messageId);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (isLoggedIn) return;
    setMessages([]);
    setChatStatus('ok');
    knownIdsRef.current.clear();
    hadMessagesRef.current = false;
    lastTsRef.current = 0;
    lobbyUpdatedAtRef.current = null;
    initialDoneRef.current = false;
  }, [isLoggedIn]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const applyDisplayWindow = useCallback((incoming: ChatMessage[], playNotify: boolean) => {
    if (!incoming.length) return;
    let played = false;
    let congrats = false;
    setMessages((prev) => {
      const byId = new Map<string, ChatMessage>();
      for (const m of prev) byId.set(m.id, m);
      for (const m of incoming) {
        if (!knownIdsRef.current.has(m.id)) {
          played = true;
          if (isBotCongratsMessage(m)) congrats = true;
        }
        byId.set(m.id, m);
        knownIdsRef.current.add(m.id);
      }
      const merged = [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
      const slice = merged.slice(-DISPLAY_LIMIT);
      knownIdsRef.current = new Set(slice.map((m) => m.id));
      return slice;
    });
    if (!playNotify || !played) return;
    if (congrats) {
      playBotCongratsSound(isMutedRef.current);
    } else {
      playChatNotification(isMutedRef.current);
    }
  }, []);

  const replaceDisplayWindow = useCallback((incoming: ChatMessage[], playNotify = false) => {
    let congrats = false;
    let anyNew = false;
    if (playNotify) {
      for (const m of incoming) {
        if (!knownIdsRef.current.has(m.id)) {
          anyNew = true;
          if (isBotCongratsMessage(m)) congrats = true;
        }
      }
    }
    const slice = incoming.slice(-DISPLAY_LIMIT);
    knownIdsRef.current = new Set(slice.map((m) => m.id));
    hadMessagesRef.current = slice.length > 0;
    if (mountedRef.current) setMessages(slice);
    if (playNotify && anyNew) {
      if (congrats) playBotCongratsSound(isMutedRef.current);
      else playChatNotification(isMutedRef.current);
    }
  }, []);

  const loadMessages = useCallback(async (initial = false) => {
    const gen = ++loadGenRef.current;
    try {
      const data = await fetchLobbyMessages({
        since: initial ? 0 : lastTsRef.current,
        limit: initial ? DISPLAY_LIMIT : 40,
      });
      if (gen !== loadGenRef.current || !mountedRef.current) return;

      setChatStatus('ok');
      pollBackoffRef.current = isLoggedIn ? 4000 : 30_000;

      const lobbyChanged = Boolean(
        data.updatedAt
        && lobbyUpdatedAtRef.current
        && data.updatedAt !== lobbyUpdatedAtRef.current,
      );

      if (!initial && lobbyChanged) {
        const full = await fetchLobbyMessages({ since: 0, limit: DISPLAY_LIMIT });
        if (gen !== loadGenRef.current || !mountedRef.current) return;
        replaceDisplayWindow(full.messages, true);
        lobbyUpdatedAtRef.current = full.updatedAt;
        const maxTs = full.messages.reduce((n, m) => Math.max(n, m.createdAt), 0);
        if (maxTs > lastTsRef.current) lastTsRef.current = maxTs;
        return;
      }

      lobbyUpdatedAtRef.current = data.updatedAt;

      if (initial) {
        replaceDisplayWindow(data.messages);
        initialDoneRef.current = true;
      } else if (data.messages.length) {
        applyDisplayWindow(data.messages, true);
      }

      const maxTs = data.messages.reduce((n, m) => Math.max(n, m.createdAt), lastTsRef.current);
      if (maxTs > lastTsRef.current) lastTsRef.current = maxTs;
    } catch (e) {
      if (gen !== loadGenRef.current || !mountedRef.current) return;
      if (e instanceof ChatFetchError && e.status === 429) {
        setChatStatus('rate_limited');
        pollBackoffRef.current = Math.min(pollBackoffRef.current * 2, 60_000);
      } else if (e instanceof ChatAuthRequiredError) {
        setChatStatus('offline');
        if (isLoggedIn) {
          void (async () => {
            await refresh();
            if (gen === loadGenRef.current && mountedRef.current) {
              await loadMessages(true);
            }
          })();
        }
      } else if (e instanceof ChatGatedError || (e instanceof ChatFetchError && e.status === 403)) {
        setChatStatus('gated');
      } else {
        setChatStatus('offline');
        pollBackoffRef.current = Math.min(pollBackoffRef.current * 2, 60_000);
      }
    } finally {
      if (gen === loadGenRef.current && mountedRef.current) setLoading(false);
    }
  }, [applyDisplayWindow, replaceDisplayWindow, isLoggedIn, refresh]);

  useEffect(() => {
    if (isLoggedIn && pollEnabled) setChatStatus('ok');
  }, [isLoggedIn, pollEnabled]);

  useEffect(() => {
    if (chatStatus !== 'gated' || !pollEnabled || !isLoggedIn) return;
    const probe = setInterval(() => {
      if (!document.hidden) void loadMessages(false);
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) void loadMessages(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(probe);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [chatStatus, pollEnabled, isLoggedIn, loadMessages]);

  useEffect(() => {
    if (!pollEnabled || chatStatus === 'gated') return;
    initialDoneRef.current = false;
    lobbyUpdatedAtRef.current = null;
    void loadMessages(true);
    let poll: ReturnType<typeof setTimeout> | null = null;
    const schedulePoll = () => {
      if (poll) clearTimeout(poll);
      poll = setTimeout(() => {
        if (!document.hidden) void loadMessages(!initialDoneRef.current);
        schedulePoll();
      }, pollBackoffRef.current);
    };
    schedulePoll();
    const onVisible = () => {
      if (!document.hidden) void loadMessages(!initialDoneRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (poll) clearTimeout(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadMessages, pollEnabled, isLoggedIn, chatStatus]);

  const sendChat = useCallback(async (text: string): Promise<SendChatResult> => {
    try {
      const { message, newUnlocks, unlockRewards, unlockCoinsTotal } = await sendLobbyMessage(text);
      if (!mountedRef.current) return { ok: true };
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        knownIdsRef.current.add(message.id);
        const merged = [...prev, message].sort((a, b) => a.createdAt - b.createdAt);
        return merged.slice(-DISPLAY_LIMIT);
      });
      hadMessagesRef.current = true;
      lastTsRef.current = Math.max(lastTsRef.current, message.createdAt);
      setChatStatus('ok');
      const hasUnlocks = Boolean(newUnlocks?.length);
      const hasRewards = Boolean(unlockRewards && Object.keys(unlockRewards).length);
      const hasCoins = Boolean(unlockCoinsTotal && unlockCoinsTotal > 0);
      if (hasUnlocks || hasRewards || hasCoins) {
        onChatUnlocks?.(newUnlocks ?? [], unlockRewards, unlockCoinsTotal);
      }
      return { ok: true };
    } catch (err) {
      if (err instanceof ChatAuthRequiredError) {
        return { ok: false, error: 'CHAT_AUTH_REQUIRED' };
      }
      if (err instanceof ChatRateLimitError) {
        return { ok: false, error: err.message, retryAfterMs: err.retryAfterMs };
      }
      if (err instanceof ChatGatedError) {
        setChatStatus('gated');
        return { ok: false, error: err.message };
      }
      return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  }, [onChatUnlocks]);

  useEffect(() => {
    onSendChatReady?.(sendChat);
  }, [sendChat, onSendChatReady]);

  const bootLog = useMemo(
    () => commandLogs.find((log) => log.id === 'boot-h') ?? null,
    [commandLogs],
  );

  const streamEntries = useMemo((): StreamEntry[] => {
    const logs: StreamEntry[] = commandLogs
      .filter((log) => log.id !== 'boot-h')
      .map((log, i) => ({
        kind: 'log',
        ts: log.ts ?? i,
        log,
      }));
    const chats: StreamEntry[] = messages.map((msg) => ({
      kind: 'chat',
      ts: msg.createdAt,
      msg,
    }));
    return [...logs, ...chats].sort((a, b) => a.ts - b.ts);
  }, [commandLogs, messages]);

  useEffect(() => {
    scrollToBottom();
  }, [streamEntries.length, scrollToBottom]);

  return (
    <div
      className="flex-1 min-h-[300px] mt-1 bg-black/50 rounded p-3 font-mono text-[8px] leading-relaxed border border-slate-800/60 shadow-inner flex flex-col relative animate-fade-in overflow-hidden"
      id="unified-terminal-stream"
    >
      {isMatrixOverlayActive && <MatrixOverlay onClose={onCloseMatrix} />}

      {/* Pinned boot header — stays visible; history scrolls below */}
      {bootLog && (
        <div className="terminal-boot-sticky shrink-0">
          <TerminalLogLine log={bootLog} themeText={themeText} onRun={processCommand} />
          <div className="shoutbox-history-divider shrink-0" aria-hidden />
        </div>
      )}

      {chatStatus !== 'ok' && (
        <p className={`text-[7px] font-mono text-center py-1 shrink-0 ${
          chatStatus === 'rate_limited' ? 'text-amber-400' : 'text-rose-400/80'
        }`}>
          {chatStatus === 'rate_limited'
            ? 'Shoutbox poll rate-limited — retrying…'
            : chatStatus === 'gated'
              ? 'Shoutbox unavailable — check tab access or permissions'
              : 'Shoutbox offline — logs still work, retrying…'}
        </p>
      )}

      {/* Scrollable shoutbox + command stream */}
      <div
        ref={scrollRef}
        className="terminal-stream-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-2 overscroll-contain"
      >
        {loading && streamEntries.length === 0 && isLoggedIn && (
          <p className="text-slate-600 text-center py-4">Initializing terminal stream…</p>
        )}

        {streamEntries.map((entry) => {
          if (entry.kind === 'chat') {
            return (
              <React.Fragment key={`chat-${entry.msg.id}`}>
                <ChatLine
                  msg={entry.msg}
                  onOpenProfile={onOpenProfile}
                  onMessageDeleted={handleMessageDeleted}
                />
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={`log-${entry.log.id}`}>
              <TerminalLogLine log={entry.log} themeText={themeText} onRun={processCommand} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}