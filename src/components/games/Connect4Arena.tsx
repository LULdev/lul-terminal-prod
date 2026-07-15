/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, RefreshCw, Swords } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { formatTimeLeft, matchOutcomeForUser, type Connect4Match } from '../../lib/games';
import { useMatchTimer } from './useMatchTimer';
import { ArenaDoneBanner } from './ArenaDoneBanner';
import { ArenaSetupBar } from './ArenaSetupBar';

type Props = {
  catalog: GameCatalogEntry;
  isLoggedIn: boolean;
  userId?: string;
  acting: boolean;
  waiting: boolean;
  match: Connect4Match | null;
  bet: number;
  maxBet: number;
  minBet: number;
  mode: 'pvp' | 'bot';
  difficulty: string;
  roomCode: string;
  queueSize: number;
  streak?: number;
  streakBonusHint?: number;
  onBetChange: (n: number) => void;
  onModeChange: (m: 'pvp' | 'bot') => void;
  onDifficultyChange: (d: string) => void;
  onRoomCodeChange: (c: string) => void;
  onStart: () => void;
  onCancel: () => void;
  onMove: (col: number) => void;
  onRematch: () => void;
  onPlayAgain: () => void;
};

export function Connect4Arena(props: Props) {
  const {
    catalog, isLoggedIn, userId, acting, waiting, match, bet, maxBet, minBet, mode,
    difficulty, roomCode, queueSize, streak, streakBonusHint,
    onBetChange, onModeChange, onDifficultyChange, onRoomCodeChange,
    onStart, onCancel, onMove, onRematch, onPlayAgain,
  } = props;
  const timeLeft = useMatchTimer(match);
  const myTurn = match?.status === 'playing' && (
    match.mode === 'bot'
      ? match.turn === 'p1'
      : match.turn === 'p1'
        ? match.player1.userId === userId
        : match.player2 && 'userId' in match.player2 && match.player2.userId === userId
  );
  const outcome = match ? matchOutcomeForUser(match, userId) : null;

  const colFull = (col: number) => match?.board?.[0]?.[col] != null;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-black/40 to-black/20 p-4 space-y-4">
      <ArenaSetupBar
        catalog={catalog}
        isLoggedIn={isLoggedIn}
        matchActive={Boolean(match) || waiting || acting}
        bet={bet}
        minBet={minBet}
        maxBet={maxBet}
        mode={mode}
        difficulty={difficulty}
        roomCode={roomCode}
        streak={streak}
        streakBonusHint={streakBonusHint}
        onBetChange={onBetChange}
        onModeChange={onModeChange}
        onDifficultyChange={onDifficultyChange}
        onRoomCodeChange={onRoomCodeChange}
      />
      <div className="rounded-2xl border border-slate-800/60 bg-[#080a0f]/80 min-h-[300px] p-4">
        {match?.status === 'playing' && match.board ? (
          <div className="space-y-3">
            <div className="text-[9px] font-mono text-slate-500 text-center">
              <Clock size={11} className="inline" /> {formatTimeLeft(timeLeft)} · {myTurn ? 'Drop a token' : 'Waiting…'}
            </div>
            <div className="flex justify-center gap-1">
              {Array.from({ length: 7 }, (_, col) => (
                <button
                  key={col}
                  type="button"
                  disabled={!myTurn || acting || colFull(col)}
                  onClick={() => onMove(col)}
                  className="w-8 h-8 rounded-full border border-red-500/30 bg-red-500/10 text-[10px] font-mono hover:bg-red-500/20 disabled:opacity-30 transition"
                >
                  ↓
                </button>
              ))}
            </div>
            <div className="grid gap-1 mx-auto w-fit" style={{ gridTemplateColumns: 'repeat(7, 2rem)' }}>
              {match.board.map((row, r) =>
                row.map((cell, c) => (
                  <div key={`${r}-${c}`} className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center">
                    <span className={`w-6 h-6 rounded-full transition-all ${
                      cell === 'X' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' : cell === 'O' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.35)]' : 'bg-slate-800/50'
                    }`} />
                  </div>
                )),
              )}
            </div>
          </div>
        ) : match?.status === 'done' ? (
          <ArenaDoneBanner
            catalog={catalog}
            outcome={outcome}
            streakBonus={match.streakBonus}
            jackpotHit={match.jackpotHit}
            jackpotAmount={match.jackpotAmount}
            acting={acting}
            onRematch={onRematch}
            onPlayAgain={onPlayAgain}
          />
        ) : waiting ? (
          <div className="text-center py-10">
            <RefreshCw className="mx-auto animate-spin mb-2 opacity-60" />
            <p className="text-[10px] font-mono text-slate-400">Matchmaking… · {queueSize} queued</p>
            <button type="button" disabled={acting} onClick={onCancel} className="mt-3 text-[9px] underline text-slate-500 disabled:opacity-40 disabled:pointer-events-none">Cancel</button>
          </div>
        ) : (
          <div className="text-center py-10">
            <button
              type="button"
              disabled={!isLoggedIn || acting}
              onClick={onStart}
              className={`px-8 py-3 rounded-xl border text-[11px] font-mono font-bold disabled:opacity-40 ${catalog.borderClass}`}
            >
              <Swords size={14} className="inline mr-1" />
              {mode === 'pvp' ? 'Find opponent' : 'Challenge BOT'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}