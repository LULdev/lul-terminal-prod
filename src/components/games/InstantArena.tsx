/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw, Swords } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { formatTimeLeft, matchOutcomeForUser, type InstantMatch } from '../../lib/games';
import { useMatchTimer } from './useMatchTimer';
import { ArenaDoneBanner } from './ArenaDoneBanner';
import { ArenaSetupBar } from './ArenaSetupBar';
import { LulCoinChip } from './LulCoinAmount';

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
  myDisplayName?: string;
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

function revealText(match: InstantMatch) {
  const r = match.reveal;
  if (!r) return null;
  if ('flip' in r) return `Flip: ${r.flip}`;
  if ('p1Roll' in r) return `🎲 ${r.p1Roll} vs ${r.p2Roll}`;
  if ('roll' in r && 'parity' in r) return `Rolled ${r.roll} → ${r.parity}`;
  if ('p1Card' in r) return `Cards: ${match.player1.move} vs ${match.player2 && 'move' in match.player2 ? match.player2.move : '?'}`;
  if ('winning' in r) return `Winning color: ${r.winning}`;
  if ('target' in r && 'answer' in r) return `Target ${r.target} → ${r.answer}`;
  if ('mine' in r) return `Mine was cell ${r.mine}`;
  if ('p1Total' in r) return `BJ: ${r.p1Total} vs ${r.p2Total}`;
  return null;
}

export function InstantArena(props: Props) {
  const {
    catalog, isLoggedIn, userId, acting, waiting, match, bet, maxBet, minBet, mode,
    difficulty, roomCode, queueSize, streak, streakBonusHint,
    onBetChange, onModeChange, onDifficultyChange, onRoomCodeChange,
    onStart, onCancel, onMove, onRematch, onPlayAgain,
  } = props;

  const timeLeft = useMatchTimer(match);
  const [picked, setPicked] = useState<string | null>(null);
  const moves = catalog.moves ?? [];
  const single = catalog.singleAction;
  const gridCols = moves.length <= 2 ? 2 : moves.length <= 4 ? 2 : moves.length === 5 ? 5 : 5;

  useEffect(() => {
    if (match?.status !== 'playing') setPicked(null);
  }, [match?.id, match?.status]);

  const amP1 = !match || match.mode === 'bot' || match.player1.userId === userId;
  const mySlot = match ? (amP1 ? match.player1 : match.player2) : null;
  const mySubmitted = Boolean(mySlot && 'submitted' in mySlot && mySlot.submitted);
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

      <div className="relative rounded-2xl border border-slate-800/60 bg-[#080a0f]/80 min-h-[220px] flex flex-col justify-center">
        {match?.status === 'playing' ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-slate-500">
              <Clock size={11} />
              {formatTimeLeft(timeLeft)}
              {mySubmitted && <span className="text-amber-400/80">Waiting…</span>}
            </div>
            <p className="text-[10px] font-mono text-slate-400 text-center">
              {mySubmitted ? 'Locked in' : single ? 'Press to play' : 'Make your pick'}
            </p>
            {single ? (
              <button
                type="button"
                disabled={acting || mySubmitted}
                onClick={() => { setPicked(single.id); onMove(single.id); }}
                className={`mx-auto block px-8 py-4 rounded-2xl border text-lg font-mono ${catalog.borderClass}`}
              >
                {single.emoji} {single.label}
              </button>
            ) : (
              <div className={`grid gap-2 max-w-md mx-auto`} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                {moves.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={acting || mySubmitted}
                    onClick={() => { setPicked(m.id); onMove(m.id); }}
                    className={`py-3 rounded-xl border text-center transition-all hover:scale-[1.02] disabled:opacity-40 ${
                      picked === m.id ? catalog.borderClass : 'border-slate-700 bg-black/30'
                    }`}
                  >
                    <div className="text-2xl">{m.emoji}</div>
                    <div className="text-[8px] font-mono uppercase mt-1 text-slate-400">{m.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : match?.status === 'done' ? (
          <ArenaDoneBanner
            catalog={catalog}
            outcome={outcome}
            acting={acting}
            streakBonus={match.streakBonus}
            jackpotHit={match.jackpotHit}
            jackpotAmount={match.jackpotAmount}
            detail={(
              <>
                {revealText(match) && (
                  <p className="text-[10px] font-mono text-slate-400">{revealText(match)}</p>
                )}
                <div className="flex justify-center gap-4 text-sm font-mono text-slate-300">
                  <span>You: {String((amP1 ? match.player1.move : ('move' in (match.player2 ?? {}) ? match.player2.move : null)) ?? '—')}</span>
                  <span>Opp: {String((amP1 ? ('move' in (match.player2 ?? {}) ? match.player2.move : null) : match.player1.move) ?? '—')}</span>
                </div>
              </>
            )}
            onRematch={onRematch}
            onPlayAgain={onPlayAgain}
          />
        ) : waiting ? (
          <div className="text-center py-10">
            <RefreshCw size={28} className="mx-auto animate-spin mb-3 opacity-60" />
            <p className="text-[11px] font-mono text-slate-300">Matchmaking…</p>
            <p className="text-[9px] text-slate-600 mt-1 flex items-center justify-center gap-1">
              {queueSize} in queue · <LulCoinChip variant="bet" amount={bet} />
            </p>
            <button type="button" disabled={acting} onClick={onCancel} className="mt-4 text-[9px] text-slate-500 underline disabled:opacity-40 disabled:pointer-events-none">Cancel</button>
          </div>
        ) : (
          <div className="text-center py-10">
            <Swords size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-[11px] font-mono text-slate-400">{catalog.label}</p>
            <button
              type="button"
              disabled={!isLoggedIn || acting}
              onClick={onStart}
              className={`mt-5 px-8 py-3 rounded-xl border text-[11px] font-mono font-bold disabled:opacity-40 ${catalog.borderClass}`}
            >
              {mode === 'pvp' ? 'Enter matchmaking' : 'Challenge BOT'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}