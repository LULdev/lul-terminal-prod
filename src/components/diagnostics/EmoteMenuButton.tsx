/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Smile } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChatEmotesAuthError, emoteToken, fetchChatEmotes, type ChatEmote } from '../../lib/chatEmotes';
import { safeEmoteUrl } from './ChatMessageBody';
import { focusShoutboxInput, insertShoutboxDraft } from '../../lib/shoutboxDraft';

type EmoteMenuButtonProps = {
  onEmotePicked?: () => void;
};

export function EmoteMenuButton({ onEmotePicked }: EmoteMenuButtonProps) {
  const { isLoggedIn, openAuth, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [emotes, setEmotes] = useState<ChatEmote[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchChatEmotes();
      if (!mountedRef.current) return;
      setEmotes(data.emotes.filter((e) => e.enabled !== false));
    } catch (e) {
      if (!mountedRef.current) return;
      if (e instanceof ChatEmotesAuthError) {
        void refresh().finally(() => openAuth('login'));
      }
      setEmotes([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [openAuth, refresh]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = emotes.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return e.code.toLowerCase().includes(q) || e.label.toLowerCase().includes(q);
  });

  const pickEmote = (emote: ChatEmote) => {
    if (!isLoggedIn) {
      openAuth('login');
      return;
    }
    onEmotePicked?.();
    insertShoutboxDraft(emoteToken(emote.code));
    focusShoutboxInput();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-[10px] font-mono px-2 py-1.5 rounded transition border flex items-center gap-1 shrink-0 ${
          open
            ? 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40 shadow-[0_0_8px_rgba(217,70,239,0.15)]'
            : 'bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30 cursor-pointer shadow-[0_0_5px_rgba(217,70,239,0.1)]'
        }`}
        id="emote-menu-btn"
        title="Insert custom emote"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Smile className="w-3.5 h-3.5" aria-hidden />
        <span className="text-[7px] font-bold tracking-wide hidden sm:inline">EMOTES</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-1.5 z-50 w-[min(280px,calc(100vw-2rem))] rounded-xl border border-fuchsia-500/25 bg-[#0a0b10]/98 backdrop-blur-md shadow-2xl shadow-fuchsia-950/50 overflow-hidden"
          role="menu"
          id="emote-menu-panel"
        >
          <div className="px-3 py-2 border-b border-fuchsia-500/15 bg-fuchsia-500/5">
            <p className="text-[7px] font-mono uppercase tracking-widest text-fuchsia-300/80 mb-1.5">
              Custom emotes
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code or label…"
              className="w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 focus:border-fuchsia-500/40 focus:outline-none"
            />
          </div>

          <div className="p-2 max-h-[200px] overflow-y-auto">
            {loading && (
              <p className="text-[9px] font-mono text-slate-500 text-center py-6">Loading emotes…</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="text-[9px] font-mono text-slate-500 text-center py-6">No emotes available</p>
            )}
            {!loading && filtered.length > 0 && (
              <div className="grid grid-cols-5 gap-1.5">
                {filtered.map((emote) => (
                  <button
                    key={emote.id}
                    type="button"
                    role="menuitem"
                    onClick={() => pickEmote(emote)}
                    className="group flex flex-col items-center gap-1 p-1.5 rounded-lg border border-transparent hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10 transition"
                    title={`${emote.label} — type ${emoteToken(emote.code)}`}
                  >
                    <span className="relative w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-slate-800/80 flex items-center justify-center">
                      {(() => {
                        const emoteSrc = safeEmoteUrl(emote.url);
                        return emoteSrc ? (
                        <img
                          src={emoteSrc}
                          alt={emote.label}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-[8px] font-mono text-fuchsia-300/70">{emoteToken(emote.code)}</span>
                      );
                      })()}
                      {emote.isPlaceholder && (
                        <span className="absolute bottom-0 inset-x-0 text-[5px] font-mono text-center bg-black/70 text-amber-300/90 py-px">
                          placeholder
                        </span>
                      )}
                    </span>
                    <span className="text-[6px] font-mono text-fuchsia-300/90 truncate max-w-full">
                      :{emote.code}:
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-fuchsia-500/10 bg-black/30 flex items-center gap-1.5 text-[7px] font-mono text-slate-500">
            <ImageIcon className="w-3 h-3 shrink-0" aria-hidden />
            <span>Type codes manually, e.g. <span className="text-fuchsia-300/80">:Emote1:</span></span>
          </div>
        </div>
      )}
    </div>
  );
}