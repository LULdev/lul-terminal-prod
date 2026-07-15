/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bot, Clock, RefreshCw, RotateCcw, Swords, Users } from 'lucide-react';
import {
  formatTimeLeft,
  isMyTttTurn,
  outcomeLabel,
  outcomeTone,
  tttOutcomeForUser,
  type TttMark,
  type TttMatch,
} from '../../lib/games';
import { useMatchTimer } from './useMatchTimer';
import { QuickBetChips } from './QuickBetChips';
import { LulCoinAmount, LulCoinChip } from './LulCoinAmount';

type Props = {
  isLoggedIn: boolean;
  userId?: string;
  acting: boolean;
  waiting: boolean;
  match: TttMatch | null;
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
  onMove: (cell: number) => void;
  onRematch: () => void;
  onPlayAgain: () => void;
};

function OpponentLabel({ match, amPlayer1 }: { match: TttMatch; amPlayer1: boolean }) {
  if (match.mode === 'bot') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono text-sky-300">
        <Bot size={12} /> BOT · {match.botDifficulty}
      </span>
    );
  }
  const opp = amPlayer1 ? match.player2 : match.player1;
  if ('displayName' in opp) {
    return (
      <span className="text-[10px] font-mono text-teal-200 truncate max-w-[120px]">
        {opp.displayName}
      </span>
    );
  }
  return null;
}

function CellButton({
  idx,
  value,
  highlight,
  disabled,
  acting,
  onClick,
}: {
  idx: number;
  value: TttMark;
  highlight: boolean;
  disabled: boolean;
  acting: boolean;
  onClick: (i: number) => void;
}) {
  const mark = value === 'X' ? '✕' : value === 'O' ? '○' : '';
  const markColor = value === 'X' ? 'text-emerald-300' : value === 'O' ? 'text-sky-300' : 'text-transparent';
  return (
    <button
      type="button"
      disabled={disabled || acting || value !== null}
      onClick={() => onClick(idx)}
      className={`aspect-square rounded-xl border text-3xl font-bold font-mono transition-all hover:scale-[1.02] disabled:opacity-60 ${
        highlight
          ? 'border-amber-400/60 bg-amber-500/15 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
          : value
            ? 'border-slate-700/80 bg-black/50'
            : 'border-slate-700/60 bg-black/30 hover:border-teal-500/40 hover:bg-teal-500/5'
      }`}
    >
      <span className={markColor}>{mark}</span>
    </button>
  );
}

export function TttArena(props: Props) {
  const {
    isLoggedIn, userId, acting, waiting, match, bet, maxBet, minBet, mode,
    difficulty, roomCode, queueSize, myDisplayName, streak, streakBonusHint,
    onBetChange, onModeChange, onDifficultyChange, onRoomCodeChange,
    onStart, onCancel, onMove, onRematch, onPlayAgain,
  } = props;

  const setupLocked = Boolean(match) || waiting || acting;
  const timeLeft = useMatchTimer(match);
  const myTurn = match ? isMyTttTurn(match, userId) : false;
  const outcome = match ? tttOutcomeForUser(match, userId) : null;
  const amPlayer1 = !match || match.mode === 'bot' || match.player1.userId === userId;
  const myMarkLabel = amPlayer1 ? '✕' : '○';
  const oppMarkLabel = amPlayer1 ? '○' : '✕';

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-black/40 to-black/20 p-4 space-y-4 ttt-arena-glow">
      <div className="flex flex-wrap gap-2">
        {(['pvp', 'bot'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={!isLoggedIn || setupLocked}
            onClick={() => onModeChange(m)}
            className={`flex-1 min-w-[100px] py-2 rounded-xl border text-[10px] font-mono uppercase transition-all ${
              mode === m
                ? 'border-teal-500/40 bg-teal-500/15 text-teal-200 shadow-[0_0_16px_rgba(45,212,191,0.08)]'
                : 'border-slate-800 text-slate-500 hover:border-slate-700'
            }`}
          >
            {m === 'pvp' ? <><Users size={12} className="inline mr-1" />Multiplayer</> : <><Bot size={12} className="inline mr-1" />vs BOT</>}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-mono uppercase text-slate-600 flex items-center gap-1">
            Wager · <LulCoinAmount amount={minBet} variant="bet" size="xs" suffix={false} />–<LulCoinAmount amount={maxBet} variant="bet" size="xs" />
          </span>
          {(streak ?? 0) > 0 && streakBonusHint ? (
            <LulCoinChip variant="streak" label={`🔥 up to +${streakBonusHint} on win`} />
          ) : null}
        </div>
        <QuickBetChips bet={bet} maxBet={maxBet} disabled={!isLoggedIn || setupLocked} onSelect={onBetChange} />
        <input
          type="number"
          min={minBet}
          max={maxBet}
          value={bet}
          disabled={!isLoggedIn || setupLocked}
          onChange={(e) => onBetChange(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
          className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[11px] font-mono text-slate-200"
        />
      </div>

      {mode === 'bot' ? (
        <div className="flex gap-1.5">
          {(['easy', 'normal', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={!isLoggedIn || setupLocked}
              onClick={() => onDifficultyChange(d)}
              className={`flex-1 py-1.5 rounded-lg border text-[8px] font-mono uppercase ${
                difficulty === d ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-slate-800 text-slate-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      ) : (
        <input
          value={roomCode}
          disabled={!isLoggedIn || setupLocked}
          onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
          placeholder="Private room code (optional)"
          className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-black/40 text-[10px] font-mono text-slate-200 uppercase placeholder:normal-case placeholder:text-slate-600"
        />
      )}

      <div className="relative rounded-2xl border border-slate-800/60 bg-[#080a0f]/80 min-h-[280px] flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.06),transparent_70%)]" />

        {match?.status === 'playing' ? (
          <div className="relative p-4 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="text-center flex-1">
                <div className="text-[8px] font-mono uppercase text-slate-600">You · {myMarkLabel}</div>
                <div className="text-[10px] font-mono text-slate-300 truncate">{myDisplayName ?? 'Player'}</div>
              </div>
              <div className="rps-vs-badge px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-[10px] font-mono font-bold text-teal-200">
                VS
              </div>
              <div className="text-center flex-1">
                <div className="text-[8px] font-mono uppercase text-slate-600">Opponent · {oppMarkLabel}</div>
                <OpponentLabel match={match} amPlayer1={amPlayer1} />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-slate-500">
              <Clock size={11} className={timeLeft < 10000 ? 'text-rose-400' : 'text-slate-500'} />
              {formatTimeLeft(timeLeft)}
              {!myTurn && (
                <span className="text-amber-400/80 ml-2">Opponent&apos;s turn…</span>
              )}
            </div>

            <p className="text-[10px] font-mono text-slate-400 text-center">
              {myTurn ? 'Your move — pick a cell' : 'Waiting for opponent…'}
            </p>

            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
              {match.board.map((cell, idx) => (
                <div key={idx}>
                  <CellButton
                    idx={idx}
                    value={cell}
                    highlight={Boolean(match.winningLine?.includes(idx))}
                    disabled={!myTurn}
                    acting={acting}
                    onClick={onMove}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : match?.status === 'done' ? (
          <div className="relative p-6 text-center space-y-3">
            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
              {match.board.map((cell, idx) => (
                <div
                  key={idx}
                  className={`aspect-square rounded-xl border flex items-center justify-center text-2xl font-mono font-bold ${
                    match.winningLine?.includes(idx)
                      ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                      : 'border-slate-800 bg-black/40'
                  } ${cell === 'X' ? 'text-emerald-300' : cell === 'O' ? 'text-sky-300' : 'text-slate-700'}`}
                >
                  {cell === 'X' ? '✕' : cell === 'O' ? '○' : ''}
                </div>
              ))}
            </div>
            <div className={`text-sm font-mono font-bold uppercase tracking-widest ${outcomeTone(outcome)}`}>
              {outcomeLabel(outcome)}
            </div>
            {match.streakBonus > 0 && (
              <div className="text-[10px] font-mono flex items-center justify-center gap-1.5">
                🔥 Streak bonus <LulCoinAmount amount={match.streakBonus} variant="streak" size="sm" />
              </div>
            )}
            {match.jackpotHit && (
              <div className="lul-coin-jackpot-pool text-[11px] font-mono flex items-center justify-center">
                🎰 Jackpot <LulCoinAmount amount={match.jackpotAmount} variant="jackpot" size="md" />!
              </div>
            )}
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={acting}
                onClick={onRematch}
                className="px-4 py-2 rounded-xl border border-violet-500/35 bg-violet-500/10 text-[10px] font-mono text-violet-200 flex items-center gap-1.5 hover:border-violet-400/50 disabled:opacity-40"
              >
                <RotateCcw size={12} /> Rematch
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={onPlayAgain}
                className="px-4 py-2 rounded-xl border border-teal-500/35 bg-teal-500/10 text-[10px] font-mono text-teal-200 disabled:opacity-40"
              >
                New game
              </button>
            </div>
          </div>
        ) : waiting ? (
          <div className="relative text-center py-10 px-4">
            <RefreshCw size={28} className="mx-auto text-teal-400 animate-spin mb-3" />
            <p className="text-[11px] font-mono text-slate-300">Scanning for opponent…</p>
            <p className="text-[9px] font-mono text-slate-600 mt-1 flex items-center justify-center gap-1">
              {queueSize} players in queue · <LulCoinChip variant="bet" amount={bet} />
            </p>
            <button type="button" disabled={acting} onClick={onCancel} className="mt-4 text-[9px] font-mono text-slate-500 hover:text-teal-300 underline disabled:opacity-40 disabled:pointer-events-none">
              Cancel matchmaking
            </button>
          </div>
        ) : (
          <div className="relative text-center py-10 px-4">
            <Swords size={32} className="mx-auto text-teal-400/60 mb-3" />
            <p className="text-[11px] font-mono text-slate-400">Ready when you are</p>
            <p className="text-[9px] font-mono text-slate-600 mt-1 max-w-xs mx-auto">
              Three in a row wins · draw refunds both bets
            </p>
            <button
              type="button"
              disabled={!isLoggedIn || acting}
              onClick={onStart}
              className="mt-5 px-8 py-3 rounded-xl border border-teal-500/45 bg-gradient-to-r from-teal-600/25 to-cyan-600/15 text-[11px] font-mono font-bold text-teal-100 hover:border-teal-400/55 hover:shadow-[0_0_24px_rgba(45,212,191,0.12)] disabled:opacity-40 inline-flex items-center gap-2"
            >
              <Swords size={14} />
              {mode === 'pvp' ? 'Enter matchmaking' : 'Challenge BOT'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}