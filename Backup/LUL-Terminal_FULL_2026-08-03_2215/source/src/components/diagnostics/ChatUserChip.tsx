/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AtSign,
  Ban,
  Clock,
  ExternalLink,
  Send,
  Trash2,
  User,
  VolumeX,
} from 'lucide-react';
import { ChatRoleBadges } from './ChatRoleBadges';
import { useAuth } from '../../context/AuthContext';

import { insertShoutboxDraft, focusShoutboxInput } from '../../lib/shoutboxDraft';
import { sendShoutboxCommand } from '../../lib/shoutboxSend';
import { adminDeleteShoutboxMessage, adminModerateShoutboxUser } from '../../lib/adminModules';
import { SessionExpiredError } from '../../lib/sessionFetch';
import { terminalAppend } from '../../lib/terminalLogBridge';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import type { UserRole } from '../../types/auth';

export type ChatUserChipTarget = {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  verified?: boolean;
};

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warn' | 'danger';
  onClick: () => void | Promise<void>;
  dividerBefore?: boolean;
};

type ChatUserChipProps = {
  user: ChatUserChipTarget;
  onOpenProfile: (username: string) => void;
  compact?: boolean;
  /** Use admin REST mod API instead of slash commands (admin monitor). */
  modViaApi?: boolean;
  /** Shoutbox message id — enables “Delete message” for admins. */
  messageId?: string;
  /** Called after server delete succeeds (remove line from local stream). */
  onMessageDeleted?: (messageId: string) => void;
};

const ROLE_STYLES: Record<UserRole, string> = {
  user: 'text-slate-300',
  vip: 'text-amber-300',
  admin: 'text-violet-300',
  bot: 'text-cyan-300',
};

const ROLE_RING: Record<UserRole, string> = {
  user: 'ring-slate-700/80',
  vip: 'ring-amber-500/50',
  admin: 'ring-violet-500/55',
  bot: 'ring-cyan-500/40',
};

type ContextMenuState = {
  x: number;
  y: number;
};

export function ChatUserChip({
  user,
  onOpenProfile,
  compact = false,
  modViaApi = false,
  messageId,
  onMessageDeleted,
}: ChatUserChipProps) {
  const { isLoggedIn, isAdmin, openAuth, refresh } = useAuth();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [acting, setActing] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const avatarSrc = safeAvatarUrl(user.avatarUrl, user.username);
  const roleStyle = ROLE_STYLES[user.role] ?? ROLE_STYLES.user;
  const ringStyle = ROLE_RING[user.role] ?? ROLE_RING.user;
  const isAdminUser = user.role === 'admin';
  const isBot = user.role === 'bot';
  const isVerified = Boolean(user.verified);

  const openProfile = useCallback(() => {
    onOpenProfile(user.username);
  }, [onOpenProfile, user.username]);

  const requireLogin = useCallback(() => {
    if (!isLoggedIn) {
      openAuth('login');
      return false;
    }
    return true;
  }, [isLoggedIn, openAuth]);

  const pingUser = useCallback(() => {
    if (!requireLogin()) return;
    insertShoutboxDraft(`@${user.username} `);
    focusShoutboxInput();
  }, [requireLogin, user.username]);

  const pingAndSend = useCallback(async () => {
    if (!requireLogin()) return;
    setActing(true);
    try {
      const result = await sendShoutboxCommand(`/ping ${user.username}`);
      if (result.ok === false && result.error === 'CHAT_AUTH_REQUIRED') {
        void refresh().finally(() => openAuth('login'));
        return;
      }
      if (result.ok === false) {
        terminalAppend(`❌ Ping failed: ${result.error}`, 'warn');
      }
    } finally {
      if (mountedRef.current) setActing(false);
    }
  }, [requireLogin, user.username, refresh, openAuth]);

  const runModAction = useCallback(async (
    action: 'ban' | 'unban' | 'mute' | 'unmute',
    minutes?: number,
  ) => {
    if (!isAdmin) return;
    setActing(true);
    try {
      if (modViaApi) {
        await adminModerateShoutboxUser({ action, username: user.username, minutes });
        terminalAppend(`✓ ${action} applied to @${user.username}`, 'info');
        return;
      }
      const command = action === 'mute'
        ? `/mute ${user.username} ${minutes ?? 30}`
        : `/${action} ${user.username}`;
      const result = await sendShoutboxCommand(command);
      if (result.ok === false && result.error === 'CHAT_AUTH_REQUIRED') {
        void refresh().finally(() => openAuth('login'));
        return;
      }
      if (result.ok === false) {
        terminalAppend(`❌ Mod action failed: ${result.error}`, 'warn');
      }
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        void refresh().finally(() => openAuth('login'));
        return;
      }
      terminalAppend(`❌ Mod action failed: ${e instanceof Error ? e.message : 'error'}`, 'warn');
    } finally {
      if (mountedRef.current) setActing(false);
    }
  }, [isAdmin, modViaApi, user.username, refresh, openAuth]);

  const closeMenu = useCallback(() => setMenu(null), []);

  const deleteMessage = useCallback(async () => {
    if (!isAdmin || !messageId) return;
    setActing(true);
    try {
      await adminDeleteShoutboxMessage(messageId);
      onMessageDeleted?.(messageId);
      terminalAppend(`✓ Message deleted (${messageId.slice(0, 6)}…)`, 'info');
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        void refresh().finally(() => openAuth('login'));
        return;
      }
      terminalAppend(`❌ Delete failed: ${e instanceof Error ? e.message : 'error'}`, 'warn');
    } finally {
      if (mountedRef.current) setActing(false);
    }
  }, [isAdmin, messageId, onMessageDeleted, refresh, openAuth]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Bots: only open menu for admins who can delete this message
    if (isBot && !(isAdmin && messageId)) return;

    const pad = 8;
    const menuW = 200;
    const menuH = isAdmin ? 360 : 160;
    const x = Math.min(e.clientX, window.innerWidth - menuW - pad);
    const y = Math.min(e.clientY, window.innerHeight - menuH - pad);
    setMenu({ x, y });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (menu) {
      closeMenu();
      return;
    }
    openProfile();
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button !== 1 || isBot) return;
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    void pingAndSend();
  };

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onScroll = () => closeMenu();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menu, closeMenu]);

  const menuItems: MenuItem[] = [];

  if (!isBot) {
    menuItems.push(
      {
        id: 'profile',
        label: 'View profile',
        icon: <ExternalLink size={12} />,
        onClick: () => {
          closeMenu();
          openProfile();
        },
      },
      {
        id: 'ping',
        label: `Ping @${user.username}`,
        icon: <AtSign size={12} />,
        onClick: () => {
          closeMenu();
          pingUser();
        },
      },
      {
        id: 'ping-send',
        label: 'Ping & send',
        icon: <Send size={12} />,
        onClick: async () => {
          closeMenu();
          await pingAndSend();
        },
      },
    );
  }

  if (isAdmin && messageId) {
    menuItems.push({
      id: 'delete-msg',
      label: 'Delete message',
      icon: <Trash2 size={12} />,
      tone: 'danger',
      dividerBefore: menuItems.length > 0,
      onClick: async () => {
        closeMenu();
        if (!confirm('Delete this shoutbox message?')) return;
        await deleteMessage();
      },
    });
  }

  if (isAdmin && !isBot && user.role !== 'admin' && user.role !== 'vip') {
    menuItems.push(
      {
        id: 'timeout-5',
        label: 'Timeout 5 min',
        icon: <Clock size={12} />,
        tone: 'warn',
        dividerBefore: !messageId,
        onClick: async () => {
          closeMenu();
          await runModAction('mute', 5);
        },
      },
      {
        id: 'timeout-30',
        label: 'Timeout 30 min',
        icon: <Clock size={12} />,
        tone: 'warn',
        onClick: async () => {
          closeMenu();
          await runModAction('mute', 30);
        },
      },
      {
        id: 'timeout-60',
        label: 'Timeout 60 min',
        icon: <Clock size={12} />,
        tone: 'warn',
        onClick: async () => {
          closeMenu();
          await runModAction('mute', 60);
        },
      },
      {
        id: 'unmute',
        label: 'Remove timeout',
        icon: <VolumeX size={12} />,
        onClick: async () => {
          closeMenu();
          await runModAction('unmute');
        },
      },
      {
        id: 'ban',
        label: 'Ban from shoutbox',
        icon: <Ban size={12} />,
        tone: 'danger',
        onClick: async () => {
          closeMenu();
          if (!confirm(`Ban @${user.username} from the shoutbox?`)) return;
          await runModAction('ban');
        },
      },
      {
        id: 'unban',
        label: 'Unban user',
        icon: <User size={12} />,
        onClick: async () => {
          closeMenu();
          await runModAction('unban');
        },
      },
    );
  }

  const size = compact ? 'w-5 h-5' : 'w-6 h-6';
  const textSize = compact ? 'text-[7px]' : 'text-[8px]';

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        onClick={handleClick}
        onAuxClick={handleAuxClick}
        onContextMenu={handleContextMenu}
        disabled={acting}
        className={`chat-user-chip shrink-0 inline-flex items-center gap-1 rounded-md border border-transparent hover:border-slate-700/80 hover:bg-white/[0.04] px-0.5 py-px transition group ${acting ? 'opacity-60' : ''}`}
        title={`${user.username} · ${user.displayName}\nLeft-click: profile · Middle-click: ping & send · Right-click: menu`}
        aria-label={`${user.username}, open profile`}
      >
        <img
          src={avatarSrc}
          alt=""
          className={`${size} rounded-md object-cover ring-1 ${ringStyle} bg-black/40 shrink-0 group-hover:ring-fuchsia-500/40 transition`}
          loading="lazy"
        />
        <ChatRoleBadges role={user.role} verified={isVerified} compact={compact} />
        <span className={`inline-flex items-center gap-0.5 font-semibold ${roleStyle} ${textSize} max-w-[88px] truncate`}>
          {isAdminUser ? (
            <span className="admin-username-style">{user.username}</span>
          ) : (
            <span>{user.username}</span>
          )}
        </span>
      </button>

      {menu && createPortal(
        <>
          <div
            className="fixed inset-0 z-[200]"
            onClick={closeMenu}
            onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
            aria-hidden
          />
          <div
            className="chat-user-context-menu fixed z-[201] min-w-[188px] rounded-xl border border-fuchsia-500/20 bg-[#0a0b10]/98 backdrop-blur-md shadow-2xl shadow-fuchsia-950/40 overflow-hidden py-1"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
          >
            <div className="px-3 py-2 border-b border-fuchsia-500/10 bg-fuchsia-500/5">
              <div className="flex items-center gap-2">
                <img src={avatarSrc} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700" />
                <div className="min-w-0">
                  <div className="text-[9px] font-mono font-bold text-fuchsia-200 truncate">{user.username}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ChatRoleBadges role={user.role} verified={isVerified} />
                  </div>
                  <div className="text-[7px] font-mono text-slate-500 truncate">{user.displayName}</div>
                </div>
              </div>
            </div>
            {menuItems.map((item) => {
              const toneClass =
                item.tone === 'danger'
                  ? 'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200'
                  : item.tone === 'warn'
                    ? 'text-amber-300 hover:bg-amber-500/10 hover:text-amber-200'
                    : 'text-slate-300 hover:bg-fuchsia-500/10 hover:text-fuchsia-100';
              return (
                <React.Fragment key={item.id}>
                  {item.dividerBefore && <div className="my-1 border-t border-slate-800/80" role="separator" />}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void item.onClick()}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[9px] font-mono transition ${toneClass}`}
                  >
                    <span className="shrink-0 opacity-70">{item.icon}</span>
                    {item.label}
                  </button>
                </React.Fragment>
              );
            })}
            {!isLoggedIn && (
              <p className="px-3 py-2 text-[7px] font-mono text-slate-600 border-t border-slate-800/60">
                Sign in to ping or use Ping &amp; send
              </p>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}