/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, RefreshCw, Swords } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { formatTimeLeft, matchOutcomeForUser, type InstantMatch } from '../../lib/games';
import { useMatchTimer } from './useMatchTimer';
import { ArenaDoneBanner } from './ArenaDoneBanner';
import { ArenaSetupBar } from './ArenaSetupBar';

type Props = {
  catalog: GameCatalogEntry;
  isLoggedIn: boolean;
  userId?: string;
  acting: boolean;
  waiting: boolean;
  match: InstantMatch | null;
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
  onMove: (cell: number) => void;
  onRematch: () => void;
  onPlayAgain: () => void;
};

export function MinesArena(props: Props) {
  const {
    catalog, isLoggedIn, userId, acting, waiting, match, bet, maxBet, minBet, mode,
    difficulty, roomCode, queueSize, streak, streakBonusHint,
    onBetChange, onModeChange, onDifficultyChange, onRoomCodeChange,
    onStart, onCancel, onMove, onRematch, onPlayAgain,
  } = props;
  const timeLeft = useMatchTimer(match);

  const amP1 = !match || match.mode === 'bot' || match.player1.userId === userId;
  const mySlot = match ? (amP1 ? match.player1 : match.player2) : null;
  const mySubmitted = Boolean(mySlot && 'submitted' in mySlot && mySlot.submitted);
  const outcome = match ? matchOutcomeForUser(match, userId) : null;
  const reveal = match?.reveal && 'mine' in match.reveal ? match.reveal : null;
  const mine = reveal?.mine ?? null;
  const myCell = reveal && 'p1Cell' in reveal
    ? Number(amP1 ? reveal.p1Cell : reveal.p2Cell)
    : null;
  const oppCell = reveal && 'p1Cell' in reveal
    ? Number(amP1 ? reveal.p2Cell : reveal.p1Cell)
    : null;

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
      <div className="rounded-2xl border border-slate-800/60 bg-[#080a0f]/80 min-h-[260px] flex flex-col justify-center p-4">
        {match?.status === 'playing' ? (
          <div className="space-y-3 text-center">
            <div className="text-[9px] font-mono text-slate-500 flex items-center justify-center gap-2">
              <Clock size={11} />{formatTimeLeft(timeLeft)}
            </div>
            <p className="text-[10px] font-mono text-slate-400">{mySubmitted ? 'Waiting for opponent…' : 'Pick a safe cell'}</p>
            <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
              {Array.from({ length: 9 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={acting || mySubmitted}
                  onClick={() => onMove(i)}
                  className="aspect-square rounded-xl border border-orange-500/30 bg-black/40 text-xl hover:bg-orange-500/15 hover:scale-[1.03] disabled:opacity-40 transition"
                >
                  ❓
                </button>
              ))}
            </div>
          </div>
        ) : match?.status === 'done' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
              {Array.from({ length: 9 }, (_, i) => {
                const isMine = mine === i;
                const isMyPick = myCell === i;
                const isOppPick = oppCell === i;
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl border flex items-center justify-center text-xl ${
                      isMine
                        ? 'border-rose-500 bg-rose-500/25 animate-pulse'
                        : isMyPick
                          ? 'border-emerald-500/50 bg-emerald-500/15'
                          : isOppPick
                            ? 'border-sky-500/40 bg-sky-500/10'
                            : 'border-slate-700 bg-black/40'
                    }`}
                  >
                    {isMine ? '💣' : isMyPick ? '✅' : isOppPick ? '🎯' : '·'}
                  </div>
                );
              })}
            </div>
            <ArenaDoneBanner
              catalog={catalog}
              outcome={outcome}
              acting={acting}
              streakBonus={match.streakBonus}
              jackpotHit={match.jackpotHit}
              jackpotAmount={match.jackpotAmount}
              detail={myCell != null && !Number.isNaN(myCell) ? (
                <p className="text-[9px] font-mono text-slate-500">
                  You: cell {myCell + 1}{oppCell != null && !Number.isNaN(oppCell) ? ` · Opp: cell ${oppCell + 1}` : ''}
                </p>
              ) : undefined}
              onRematch={onRematch}
              onPlayAgain={onPlayAgain}
            />
          </div>
        ) : waiting ? (
          <div className="text-center py-8">
            <RefreshCw className="mx-auto animate-spin mb-2 opacity-60" />
            <p className="text-[10px] font-mono text-slate-400">Matchmaking… · {queueSize} queued</p>
            <button type="button" disabled={acting} onClick={onCancel} className="mt-3 text-[9px] underline text-slate-500 disabled:opacity-40 disabled:pointer-events-none">Cancel</button>
          </div>
        ) : (
          <div className="text-center py-8">
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