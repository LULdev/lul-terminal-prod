/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, RefreshCw, Swords } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { formatTimeLeft, matchOutcomeForUser, type NimMatch } from '../../lib/games';
import { useMatchTimer } from './useMatchTimer';
import { ArenaDoneBanner } from './ArenaDoneBanner';
import { ArenaSetupBar } from './ArenaSetupBar';

type Props = {
  catalog: GameCatalogEntry;
  isLoggedIn: boolean;
  userId?: string;
  acting: boolean;
  waiting: boolean;
  match: NimMatch | null;
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
  onMove: (move: string) => void;
  onRematch: () => void;
  onPlayAgain: () => void;
};

export function NimArena(props: Props) {
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
      <div className="rounded-2xl border border-slate-800/60 bg-[#080a0f]/80 min-h-[280px] p-4">
        {match?.status === 'playing' ? (
          <div className="space-y-4">
            <div className="text-[9px] font-mono text-slate-500 text-center">
              <Clock size={11} className="inline" /> {formatTimeLeft(timeLeft)} · {myTurn ? 'Your turn — take stones' : 'Waiting…'}
            </div>
            {match.piles.map((count, pileIdx) => (
              <div key={pileIdx} className="rounded-xl border border-stone-700/40 bg-black/30 p-3">
                <div className="text-[9px] font-mono text-stone-400 mb-2">Pile {pileIdx + 1} · {count} stones</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {Array.from({ length: count }, (_, i) => (
                    <span key={i} className="w-4 h-4 rounded-full bg-stone-400/80 inline-block shadow-sm" />
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: count }, (_, i) => i + 1).map((take) => (
                    <button
                      key={take}
                      type="button"
                      disabled={!myTurn || acting}
                      onClick={() => onMove(`${pileIdx}:${take}`)}
                      className="px-2 py-1 rounded-lg border border-stone-600/40 text-[9px] font-mono text-stone-300 hover:bg-stone-500/15 disabled:opacity-40 transition"
                    >
                      Take {take}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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