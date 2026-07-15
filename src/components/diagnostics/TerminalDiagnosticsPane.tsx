/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Bug, Volume2, VolumeX } from 'lucide-react';
import { LogLine } from '../../types';
import { generateAsciiArt } from '../../utils/ascii';
import { EmoteMenuButton } from './EmoteMenuButton';
import { UnifiedTerminalPanel } from './UnifiedTerminalPanel';
import { SystemTelemetrySection } from './SystemTelemetrySection';
import { formatTerminalCommand, isTerminalCommand, parseTerminalCommand } from '../../lib/terminalInputRouting';
import { registerShoutboxDraft } from '../../lib/shoutboxDraft';
import { registerShoutboxSend } from '../../lib/shoutboxSend';
import { registerTerminalAppend } from '../../lib/terminalLogBridge';
import {
  takeAchievementProof,
  requestAchievementProofRemint,
} from '../../lib/achievementProof';
import { getLiveStats } from '../../lib/liveStatsStore';
import {
  ALL_COMMANDS_ALIASES,
  FORTUNES,
  JOKES,
  getCompactCommandHintLogs,
  printCompactCommandReference,
} from '../../lib/terminalCommandKit';
import * as authApi from '../../lib/auth';
import { useAuth } from '../../context/AuthContext';
import type { SyncAchievementsOpts } from '../../lib/auth';

import type { TabId } from '../../config/menuItems';

export type ThemeColor = 'indigo' | 'emerald' | 'amber' | 'cyan' | 'rose';

export type TerminalDiagnosticsPaneProps = {
  renderTab: TabId;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  isLoggedIn: boolean;
  openAuth: (mode: 'login' | 'register') => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isMatrixOverlayActive: boolean;
  setIsMatrixOverlayActive: React.Dispatch<React.SetStateAction<boolean>>;
  isCrtEnabled: boolean;
  setIsCrtEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setBsodActive: (active: boolean) => void;
  setSelfDestructCountdown: React.Dispatch<React.SetStateAction<number>>;
  selfDestructCountdown: number;
  setIsShaking: (shaking: boolean) => void;
  playBeep: (
    freq: number,
    duration: number,
    type?: 'sine' | 'square' | 'sawtooth' | 'triangle',
  ) => void;
  syncAchievements: (opts?: SyncAchievementsOpts) => Promise<void>;
  synthTheme: 'clean-sine' | 'retro-8bit' | 'bit-crushed';
  onChangeSynthTheme: (theme: 'clean-sine' | 'retro-8bit' | 'bit-crushed') => void;
  onNavigateProfile?: (username: string) => void;
};

const THEME_TEXT: Record<ThemeColor, string> = {
  indigo: 'text-indigo-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  cyan: 'text-cyan-400',
  rose: 'text-rose-400',
};

const THEME_BORDER: Record<ThemeColor, string> = {
  indigo: 'border-indigo-500/30',
  emerald: 'border-emerald-500/30',
  amber: 'border-amber-500/30',
  cyan: 'border-cyan-500/30',
  rose: 'border-rose-500/30',
};

const THEME_BG: Record<ThemeColor, string> = {
  indigo: 'bg-indigo-500/10',
  emerald: 'bg-emerald-500/10',
  amber: 'bg-amber-500/10',
  cyan: 'bg-cyan-500/10',
  rose: 'bg-rose-500/10',
};

const THEME_HEX: Record<ThemeColor, string> = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  rose: '#f43f5e',
};

export const TerminalDiagnosticsPane = memo(function TerminalDiagnosticsPane({
  renderTab,
  themeColor,
  setThemeColor,
  isLoggedIn,
  openAuth,
  isMuted,
  setIsMuted,
  isMatrixOverlayActive,
  setIsMatrixOverlayActive,
  isCrtEnabled,
  setIsCrtEnabled,
  setBsodActive,
  setSelfDestructCountdown,
  selfDestructCountdown,
  setIsShaking,
  playBeep,
  syncAchievements,
  synthTheme,
  onChangeSynthTheme,
  onNavigateProfile,
}: TerminalDiagnosticsPaneProps) {
  const { handleUnlocks, refresh, patchUser } = useAuth();

  const recordTerminalAchievement = useCallback((command: string) => {
    if (!isLoggedIn) return;
    if (renderTab !== 'dashboard') {
      appendLogRef.current('⚠️ Terminal achievements require the Dashboard tab.', 'warn');
      return;
    }
    const proof = takeAchievementProof('dashboard');
    if (!proof) {
      appendLogRef.current('⚠️ Achievement proof expired — switch tabs to refresh proof.', 'warn');
      return;
    }
    authApi.recordTerminalCommand(command, proof)
      .then((data) => {
        handleUnlocks(data.newUnlocks ?? [], data.unlockRewards);
        if (data.user) patchUser(data.user);
      })
      .catch((e) => {
        requestAchievementProofRemint();
        appendLogRef.current(
          e instanceof Error ? `⚠️ Achievement claim failed: ${e.message}` : '⚠️ Achievement claim failed',
          'warn',
        );
      });
  }, [isLoggedIn, renderTab, handleUnlocks, patchUser]);

  const [commandInput, setCommandInput] = useState('');
  const [commandLogs, setCommandLogs] = useState<LogLine[]>(() => getCompactCommandHintLogs('08:14:04'));
  const [baudRate, setBaudRate] = useState(0);
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    terminal: true,
    telemetry: true,
  });
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');

  useEffect(() => {
    if (isLoggedIn) return;
    setCommandHistory([]);
    setHistoryIndex(-1);
    setCommandInput('');
    setTempInput('');
    setCommandLogs(getCompactCommandHintLogs());
  }, [isLoggedIn]);

  const appendLogRef = useRef<(msg: string, type?: LogLine['type'], commandToRun?: string) => void>(() => {});
  const sendChatRef = useRef<
    (text: string) => Promise<{ ok: true } | { ok: false; error: string }>
  >(async () => ({ ok: false, error: 'Chat not ready' }));
  const cliInputRef = useRef<HTMLInputElement>(null);
  const activeIntervalsRef = useRef(new Set<ReturnType<typeof setInterval>>());

  const trackInterval = useCallback((id: ReturnType<typeof setInterval>) => {
    activeIntervalsRef.current.add(id);
    return id;
  }, []);

  const clearTrackedInterval = useCallback((id: ReturnType<typeof setInterval>) => {
    clearInterval(id);
    activeIntervalsRef.current.delete(id);
  }, []);

  useEffect(() => {
    return () => {
      for (const id of activeIntervalsRef.current) clearInterval(id);
      activeIntervalsRef.current.clear();
    };
  }, []);

  const themeText = THEME_TEXT[themeColor];
  const themeBorder = THEME_BORDER[themeColor];
  const themeBg = THEME_BG[themeColor];
  const themeHexColor = THEME_HEX[themeColor];

  const appendLog = useCallback(
    (msg: string, type: 'info' | 'warn' | 'success' | 'alert' = 'info', commandToRun?: string) => {
      const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const logId = Math.random().toString();
      const ts = Date.now();

      if (baudRate === 0 || msg.length < 5 || msg.includes('\n')) {
        const newLog: LogLine = {
          id: logId,
          time: timeStr,
          message: msg,
          type,
          commandToRun,
          ts,
        };
        setCommandLogs((prev) => [...prev.slice(-200), newLog]);
        return;
      }

      const newLog: LogLine = {
        id: logId,
        time: timeStr,
        message: '',
        type,
        commandToRun,
        ts,
      };
      setCommandLogs((prev) => [...prev.slice(-200), newLog]);

      let currentIdx = 0;
      const intervalTime = Math.max(5, Math.floor(1000 / baudRate));

      const typeWriter = trackInterval(setInterval(() => {
        currentIdx++;
        if (currentIdx <= msg.length) {
          const text = msg.slice(0, currentIdx);
          setCommandLogs((prev) =>
            prev.map((log) => (log.id === logId ? { ...log, message: text } : log)),
          );
        } else {
          clearTrackedInterval(typeWriter);
        }
      }, intervalTime));
    },
    [baudRate, trackInterval, clearTrackedInterval],
  );

  appendLogRef.current = appendLog;

  useEffect(() => {
    registerTerminalAppend(appendLog);
    return () => registerTerminalAppend(null);
  }, [appendLog]);

  useEffect(() => {
    registerShoutboxDraft({
      insert: (fragment) => {
        setCommandInput((prev) => {
          const next = `${prev}${fragment}`;
          return next.length > 280 ? next.slice(0, 280) : next;
        });
      },
      focus: () => cliInputRef.current?.focus(),
    });
    return () => registerShoutboxDraft(null);
  }, []);

  const handleSendChatReady = useCallback(
    (send: (text: string) => Promise<{ ok: true } | { ok: false; error: string }>) => {
      sendChatRef.current = send;
      registerShoutboxSend(send);
    },
    [],
  );

  useEffect(() => {
    return () => registerShoutboxSend(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      let newIndex = historyIndex;
      if (historyIndex === -1) {
        setTempInput(commandInput);
        newIndex = commandHistory.length - 1;
      } else if (historyIndex > 0) {
        newIndex = historyIndex - 1;
      }

      setHistoryIndex(newIndex);
      setCommandInput(commandHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;

      if (historyIndex === commandHistory.length - 1) {
        setHistoryIndex(-1);
        setCommandInput(tempInput);
      } else {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[newIndex]);
      }
    }
  };

  const processCommand = useCallback(
    (cmdText: string) => {
      const body = parseTerminalCommand(cmdText);
      if (!body) return;
      const query = body.toLowerCase();
      const displayCmd = formatTerminalCommand(body);

      if (query !== 'clean') {
        appendLog(displayCmd, 'info');
        playBeep(900, 0.05, 'sine');
      }

      setCommandHistory((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === displayCmd) {
          return prev;
        }
        return [...prev, displayCmd];
      });
      setHistoryIndex(-1);
      setTempInput('');

      if (ALL_COMMANDS_ALIASES.has(query)) {
        printCompactCommandReference(appendLog);
      } else if (query === 'stats') {
        const stats = getLiveStats();
        appendLog(
          `📊 Live Context stats: Hits=${stats.hits} | Unique=${stats.unique} | Online=${stats.online}`,
          'success',
        );
      } else if (query === 'beep') {
        playBeep(880, 0.3, 'sawtooth');
        appendLog('🎵 Synthesizer beep played successfully at 880Hz.', 'success');
      } else if (query === 'clean') {
        setCommandLogs(getCompactCommandHintLogs());
        appendLog('🧹 Screen buffer cleared.', 'info');
      } else if (query === 'reboot') {
        appendLog('🔄 Initiating cold OS terminal restart...', 'warn');
        setTimeout(() => {
          setCommandLogs(getCompactCommandHintLogs());
          playBeep(1200, 0.4, 'sine');
        }, 800);
      } else if (query === 'hack') {
        appendLog('💀 CRITICAL: Elevating grid permissions... access GRANTED.', 'alert');
        playBeep(150, 0.5, 'square');
      } else if (query === 'autos' || query === 'autologs' || query === 'auto-messages') {
        appendLog('No auto-send messages registered.', 'info');
      } else if (query === 'history') {
        appendLog('⏳ --- INTERACTIVE COMMAND HISTORY (LAST 10) ---', 'success');
        if (commandHistory.length === 0) {
          appendLog('No commands in history yet. Execute some first!', 'warn');
        } else {
          const last10 = commandHistory.slice(-10);
          last10.forEach((cmd, idx) => {
            appendLog(`[${idx + 1}] ${cmd} (Click to re-run)`, 'success', cmd);
          });
        }
      } else if (query.startsWith('ascii ')) {
        const arg = body.slice(6).slice(0, 200);
        if (!arg.trim()) {
          appendLog('❌ Error: Please specify text to convert. (e.g. "!ascii HELLO")', 'warn');
        } else {
          const art = generateAsciiArt(arg);
          appendLog(`Generated ASCII Art for "${arg}":`, 'success');
          appendLog(art, 'success');
        }
      } else if (query === 'joke') {
        const idx = Math.floor(Math.random() * JOKES.length);
        appendLog('💬 Joke of the session:', 'success');
        appendLog(`"${JOKES[idx]}"`, 'info');
      } else if (query === 'fortune') {
        const idx = Math.floor(Math.random() * FORTUNES.length);
        appendLog('🔮 Retro Fortune cookie says:', 'success');
        appendLog(`"${FORTUNES[idx]}"`, 'info');
      } else if (query.startsWith('color ')) {
        const arg = query.replace('color ', '').trim();
        if (['indigo', 'emerald', 'amber', 'cyan', 'rose'].includes(arg)) {
          setThemeColor(arg as ThemeColor);
          appendLog(`🎨 Accent color updated to ${arg.toUpperCase()}.`, 'success');
          playBeep(600, 0.15, 'sine');
        } else {
          appendLog('❌ Error: Allowed colors are: indigo, emerald, amber, cyan, rose', 'warn');
        }
      } else if (query === 'matrix') {
        recordTerminalAchievement(query);
        appendLog('🟢 INITIALIZING MATRIX PROTOCOL CODES...', 'success');
        setIsMatrixOverlayActive(true);
        playBeep(400, 0.1, 'sawtooth');
        setTimeout(() => {
          appendLog('0 1 0 1 1 0 0 1 0 1 1 0 1 0 1 0 0 1 1 0', 'success');
          appendLog('1 0 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 1 0', 'success');
          appendLog('0 1 1 0 1 0 0 1 1 0 1 0 0 1 0 1 1 0 0 1', 'success');
          appendLog('ACCESS COMPLETED. GRID IS STREAMING.', 'success');
          playBeep(800, 0.2, 'sine');
        }, 300);
        setTimeout(() => {
          setIsMatrixOverlayActive(false);
        }, 8000);
      } else if (query === 'theme') {
        setIsCrtEnabled((prev) => !prev);
        appendLog(`📺 Scanlines filter ${!isCrtEnabled ? 'ENABLED' : 'DISABLED'}.`, 'success');
      } else if (query === 'cowsay') {
        const cow = `
  < Moo! >
  --------
         \\   ^__^
          \\  (oo)\\_______
             (__)\\       )\\/\\
                 ||----w |
                 ||     ||
      `.trim();
        appendLog(cow, 'success');
      } else if (query.startsWith('cowsay ')) {
        const arg = (body.slice(7).trim() || 'Moo!').slice(0, 200);
        const bubbleLine = '-'.repeat(arg.length + 2);
        const cow = `
  < ${arg} >
  ${bubbleLine}
         \\   ^__^
          \\  (oo)\\_______
             (__)\\       )\\/\\
                 ||----w |
                 ||     ||
      `.trim();
        appendLog(cow, 'success');
      } else if (query.startsWith('ping ')) {
        const host = body.slice(5).trim().slice(0, 200);
        if (!host) {
          appendLog('❌ Error: Specify a host to ping.', 'warn');
        } else {
          appendLog(`PING ${host} (10.0.0.42) 56(84) bytes of data.`, 'info');
          let seq = 1;
          const pingInterval = trackInterval(setInterval(() => {
            if (seq <= 4) {
              const time = (15 + Math.random() * 15).toFixed(1);
              appendLog(`64 bytes from ${host}: icmp_seq=${seq} ttl=64 time=${time} ms`, 'success');
              seq++;
            } else {
              clearTrackedInterval(pingInterval);
              appendLog(`--- ${host} ping statistics ---`, 'info');
              appendLog('4 packets transmitted, 4 received, 0% packet loss, time 1500ms', 'success');
            }
          }, 600));
        }
      } else if (query.startsWith('weather ') || query === 'weather') {
        const city = query === 'weather' ? 'Hamburg' : body.slice(8).trim();
        const temp = Math.floor(10 + Math.random() * 20);
        const conditions = [
          { desc: 'Clear / Cyber-Sunny', ascii: '   \\ _ /   \n  - ( ) -  \n   /   \\   ' },
          { desc: 'Acid Rain / Overcast', ascii: '  __   __  \n (  ) (  ) \n  / / / /  ' },
          { desc: 'Neon Thunderstorm', ascii: '  __   __  \n (  ) (  ) \n   /_ /    \n    /      ' },
        ];
        const selected = conditions[Math.floor(Math.random() * conditions.length)];
        appendLog(`☁️ ASCII weather report for ${city.toUpperCase()}:`, 'success');
        appendLog(selected.ascii, 'info');
        appendLog(`Temp: ${temp}°C | Condition: ${selected.desc} | Wind: 14 km/h North-Grid`, 'success');
      } else if (query === 'keygen') {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
        let key = 'lul_sec_';
        for (let i = 0; i < 24; i++) {
          key += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        appendLog('🔑 SECURE CREDENTIAL GENERATED:', 'success');
        appendLog(key, 'success');
      } else if (query.startsWith('colorconv ')) {
        const hex = body.slice(10).trim().replace('#', '');
        const num = parseInt(hex, 16);
        if (hex.length !== 6 || isNaN(num)) {
          appendLog('❌ Error: Please specify a valid 6-character hex color (e.g. "!colorconv #6366f1").', 'warn');
        } else {
          const r = (num >> 16) & 255;
          const g = (num >> 8) & 255;
          const b = num & 255;
          appendLog(`🎨 HEX #${hex.toUpperCase()} converts to RGB: rgb(${r}, ${g}, ${b})`, 'success');
        }
      } else if (query.startsWith('baudrate ')) {
        const rate = parseInt(query.replace('baudrate ', '').trim(), 10);
        if (isNaN(rate) || rate < 0) {
          appendLog('❌ Error: Specify a valid numeric speed or 0 for instant print (e.g. "!baudrate 300").', 'warn');
        } else if (rate === 0) {
          setBaudRate(0);
          appendLog('⚡ Baud rate disabled. Instant print speed engaged.', 'success');
        } else {
          setBaudRate(rate);
          appendLog(`📟 Baud rate set to ${rate} characters/second. Enjoy the retro speed!`, 'success');
        }
      } else if (query === 'self-destruct' || query === 'reboot self-destruct') {
        if (selfDestructCountdown > 0) {
          appendLog('🚨 Self-destruct sequence is already active!', 'warn');
        } else {
          recordTerminalAchievement(query);
          setSelfDestructCountdown(10);
          appendLog('🚨 WARNING: SELF-DESTRUCT INITIATED BY OPERATOR! T-MINUS 10 SECONDS...', 'alert');
          playBeep(440, 0.4, 'sawtooth');
        }
      } else if (query === 'bsod') {
        setBsodActive(true);
        playBeep(120, 1.0, 'sawtooth');
      } else if (query === 'loader' || query === 'loading') {
        appendLog('⏳ Starting grid buffer download process...', 'info');
        let progress = 0;
        const loadTimer = trackInterval(setInterval(() => {
          if (progress <= 100) {
            const filled = Math.floor(progress / 10);
            const bar =
              '='.repeat(filled) +
              '>'.repeat(progress < 100 ? 1 : 0) +
              ' '.repeat(10 - filled - (progress < 100 ? 1 : 0));
            appendLog(`[${bar}] Loading grid files: ${progress}%`, 'success');
            progress += 20;
          } else {
            clearTrackedInterval(loadTimer);
            appendLog('✅ Download completed. Container files initialized.', 'success');
          }
        }, 400));
      } else {
        appendLog(`❓ Unknown command "${displayCmd}". Type "!commands" for all commands.`, 'warn');
        setIsShaking(true);
        playBeep(220, 0.35, 'sawtooth');
        setTimeout(() => setIsShaking(false), 410);
      }
    },
    [
      appendLog,
      trackInterval,
      clearTrackedInterval,
      isLoggedIn,
      playBeep,
      setThemeColor,
      setIsMatrixOverlayActive,
      isCrtEnabled,
      setIsCrtEnabled,
      selfDestructCountdown,
      setSelfDestructCountdown,
      setBsodActive,
      setIsShaking,
      commandHistory,
      recordTerminalAchievement,
    ],
  );

  const executeCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commandInput.trim();
    if (!text) return;

    if (isTerminalCommand(text)) {
      processCommand(text);
      setCommandInput('');
      return;
    }

    if (!isLoggedIn) {
      openAuth('login');
      return;
    }

    const result = await sendChatRef.current(text);
    if (result.ok) {
      setCommandInput('');
      setCommandHistory((prev) => (prev.length > 0 && prev[prev.length - 1] === text ? prev : [...prev, text]));
      setHistoryIndex(-1);
      setTempInput('');
      return;
    }
    if (result.error === 'CHAT_AUTH_REQUIRED') {
      void refresh().finally(() => openAuth('login'));
      return;
    }
    if (result.retryAfterMs) {
      appendLog(`💬 Rate limited — wait a moment before sending again.`, 'warn');
      return;
    }
    appendLog(`💬 ${result.error}`, 'warn');
  };

  return (
    <div
      className="w-[36%] h-full flex flex-col bg-[#0c0d12] p-5 justify-between shrink-0"
      id="dashboard-right-pane"
    >
      <div className="flex flex-col h-full overflow-hidden text-[9px]" id="terminal-diagnostics">
        <div
          className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-2 shrink-0"
          id="terminal-pane-topbar"
        >
          <div className="flex items-center gap-2" id="logs-title-header">
            <Bug className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[9px] font-mono font-bold tracking-widest text-[#a5b4fc] uppercase">
              DIAGNOSTICS terminal
            </span>
          </div>

          <div className="flex items-center gap-1.5" id="diagnostics-audio-controls">
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                appendLog(`Audio output ${!isMuted ? 'MUTED' : 'ENABLED'}.`, 'info');
              }}
              className="p-1 px-2 rounded border border-indigo-500/20 hover:border-indigo-500/30 transition text-slate-400 text-xs flex items-center gap-1.5 font-mono bg-black/20"
              title="Toggle sound fx"
              id="audio-toggle-button"
            >
              {isMuted ? (
                <VolumeX className="w-3 h-3 text-red-400" />
              ) : (
                <Volume2 className="w-3 h-3 text-indigo-400 animate-pulse" />
              )}
              <span className="text-[9px] font-bold">FX SOUND</span>
            </button>

            <button
              onClick={() => setIsCrtEnabled((prev) => !prev)}
              className={`p-1 px-2 rounded border text-xs flex items-center gap-1 font-mono transition ${
                isCrtEnabled
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                  : 'border-slate-850 bg-black/20 text-slate-500 hover:border-slate-700'
              }`}
              title="Toggle CRT scanline effect"
              id="crt-toggle-button"
            >
              <span className="text-[9px] font-bold">CRT: {isCrtEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => {
                const nextTheme = synthTheme === 'clean-sine' ? 'retro-8bit' : synthTheme === 'retro-8bit' ? 'bit-crushed' : 'clean-sine';
                onChangeSynthTheme(nextTheme);
              }}
              className="p-1 px-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition text-xs flex items-center gap-1 font-mono"
              title="Cycle synthesizer sound themes"
              id="synth-theme-button"
            >
              <span className="text-[9px] font-bold uppercase">
                SYNTH: {synthTheme === 'clean-sine' ? 'SINE' : synthTheme === 'retro-8bit' ? '8-BIT' : 'CRUSH'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden pr-1" id="diagnostics-accordion-group">
          <SystemTelemetrySection
            expanded={expandedPanels.telemetry}
            onToggle={() => setExpandedPanels((p) => ({ ...p, telemetry: !p.telemetry }))}
            themeHexColor={themeHexColor}
            appendLogRef={appendLogRef}
          />

          <div
            className={`flex flex-col transition-all duration-150 min-h-0 flex-1 ${expandedPanels.terminal ? 'flex-1' : 'shrink-0'}`}
          >
            <button
              type="button"
              onClick={() => setExpandedPanels((p) => ({ ...p, terminal: !p.terminal }))}
              className="w-full text-left py-1.5 px-2 bg-[#11131c]/80 hover:bg-[#161a25]/80 border border-slate-800/80 text-[8px] font-mono font-bold tracking-widest text-[#a5b4fc] flex justify-between items-center rounded select-none shrink-0"
            >
              <span>📟 TERMINAL / SHOUTBOX</span>
              <span className="text-[6px] text-slate-500">{expandedPanels.terminal ? '▼' : '▶'}</span>
            </button>
            <div className={expandedPanels.terminal ? 'flex flex-col flex-1 min-h-0' : 'hidden'} aria-hidden={!expandedPanels.terminal}>
              <UnifiedTerminalPanel
                commandLogs={commandLogs}
                processCommand={processCommand}
                themeText={themeText}
                isMatrixOverlayActive={isMatrixOverlayActive}
                onCloseMatrix={() => setIsMatrixOverlayActive(false)}
                isMuted={isMuted}
                pollEnabled={expandedPanels.terminal}
                onSendChatReady={handleSendChatReady}
                onOpenProfile={onNavigateProfile}
                onChatUnlocks={(ids, rewards, coinsTotal) => {
                  handleUnlocks(ids, rewards);
                  if (coinsTotal || ids.length) {
                    void refresh();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={executeCommand}
          className="mt-2 flex items-center gap-2 bg-black/40 border border-slate-800/80 rounded p-1.5 shrink-0"
          id="diagnostic-cmd-form"
        >
          <span className={`${themeText} font-mono text-[8px] pl-1 select-none font-bold`}>[!]</span>
          <input
            ref={cliInputRef}
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoggedIn ? 'chat · ↑↓ history…' : 'sign in to chat…'}
            className="flex-1 bg-transparent border-0 text-slate-100 font-mono text-[8px] focus:ring-0 focus:outline-none placeholder-slate-700"
            maxLength={280}
            id="cli-input-field"
          />
          <EmoteMenuButton
            onEmotePicked={() => setExpandedPanels((p) => ({ ...p, terminal: true }))}
          />
          <button
            type="submit"
            className={`${themeBg} hover:bg-white/5 text-slate-200 text-[8px] font-medium font-mono px-2.5 py-1.5 rounded transition border ${themeBorder}`}
            id="execute-btn"
          >
            SEND
          </button>
        </form>
      </div>
    </div>
  );
});