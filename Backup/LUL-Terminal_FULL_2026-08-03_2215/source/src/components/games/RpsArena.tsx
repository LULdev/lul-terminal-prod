/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Bot, Clock, RefreshCw, RotateCcw, Swords, Users } from 'lucide-react';
import {
  formatTimeLeft,
  matchOutcomeForUser,
  MOVE_META,
  outcomeLabel,
  outcomeTone,
  type RpsMatch,
  type RpsMove,
  type RpsSeriesType,
} from '../../lib/games';
import { useMatchTimer } from './useMatchTimer';
import { QuickBetChips } from './QuickBetChips';
import { LulCoinAmount, LulCoinChip } from './LulCoinAmount';

type Props = {
  isLoggedIn: boolean;
  userId?: string;
  acting: boolean;
  waiting: boolean;
  match: RpsMatch | null;
  bet: number;
  maxBet: number;
  minBet: number;
  mode: 'pvp' | 'bot';
  seriesType: RpsSeriesType;
  difficulty: string;
  roomCode: string;
  queueSize: number;
  myDisplayName?: string;
  streak?: number;
  streakBonusHint?: number;
  onBetChange: (n: number) => void;
  onModeChange: (m: 'pvp' | 'bot') => void;
  onSeriesChange: (s: RpsSeriesType) => void;
  onDifficultyChange: (d: string) => void;
  onRoomCodeChange: (c: string) => void;
  onStart: () => void;
  onCancel: () => void;
  onMove: (m: RpsMove) => void;
  onRematch: () => void;
  onPlayAgain: () => void;
};

function OpponentLabel({ match }: { match: RpsMatch }) {
  if (match.mode === 'bot') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono text-sky-300">
        <Bot size={12} /> BOT · {match.botDifficulty}
      </span>
    );
  }
  if ('displayName' in match.player2) {
    return (
      <span className="text-[10px] font-mono text-rose-200 truncate max-w-[120px]">
        {match.player2.displayName}
      </span>
    );
  }
  return null;
}

function SeriesScoreboard({ match, amP1 }: { match: RpsMatch; amP1: boolean }) {
  if (match.seriesType !== 'bo3') return null;
  const myScore = amP1 ? match.score.p1 : match.score.p2;
  const oppScore = amP1 ? match.score.p2 : match.score.p1;
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <div className={`px-3 py-1.5 rounded-lg border text-center ${myScore >= 1 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-black/30'}`}>
        <div className="text-[7px] font-mono uppercase text-slate-500">You</div>
        <div className="text-lg font-mono font-bold text-emerald-300">{myScore}</div>
      </div>
      <span className="text-[9px] font-mono text-slate-600">Bo3 · R{match.currentRound}</span>
      <div className={`px-3 py-1.5 rounded-lg border text-center ${oppScore >= 1 ? 'border-rose-500/40 bg-rose-500/10' : 'border-slate-800 bg-black/30'}`}>
        <div className="text-[7px] font-mono uppercase text-slate-500">Foe</div>
        <div className="text-lg font-mono font-bold text-rose-300">{oppScore}</div>
      </div>
    </div>
  );
}

function roundResultLabel(winner: string, amP1: boolean): string {
  if (winner === 'draw') return '=';
  const won = (winner === 'p1' && amP1) || (winner === 'p2' && !amP1);
  return won ? 'W' : 'L';
}

function RoundHistory({ match, amP1 }: { match: RpsMatch; amP1: boolean }) {
  if (!match.rounds?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {match.rounds.map((r) => {
        const wl = roundResultLabel(r.winner, amP1);
        return (
          <span
            key={r.round}
            className="px-2 py-0.5 rounded-md border border-slate-800 bg-black/40 text-[8px] font-mono text-slate-500"
            title={`R${r.round}`}
          >
            {MOVE_META[r.p1Move].emoji}{MOVE_META[r.p2Move].emoji}
            <span className={`ml-1 ${wl === 'W' ? 'text-emerald-400' : wl === 'L' ? 'text-rose-400' : 'text-slate-600'}`}>
              {wl}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function RpsArena(props: Props) {
  const {
    isLoggedIn, userId, acting, waiting, match, bet, maxBet, minBet, mode, seriesType,
    difficulty, roomCode, queueSize, myDisplayName, streak, streakBonusHint,
    onBetChange, onModeChange, onSeriesChange, onDifficultyChange, onRoomCodeChange,
    onStart, onCancel, onMove, onRematch, onPlayAgain,
  } = props;

  const setupLocked = Boolean(match) || waiting || acting;
  const amP1 = !match || match.mode === 'bot' || match.player1.userId === userId;
  const myPlayer = match ? (amP1 ? match.player1 : match.player2) : null;
  const oppPlayer = match ? (amP1 ? match.player2 : match.player1) : null;
  const outcome = match ? matchOutcomeForUser(match, userId) : null;

  const [reveal, setReveal] = useState(false);
  const [picked, setPicked] = useState<RpsMove | null>(null);
  const timeLeft = useMatchTimer(match);

  useEffect(() => {
    if (match?.status === 'done') {
      setReveal(true);
      const t = setTimeout(() => setReveal(false), 2400);
      return () => clearTimeout(t);
    }
    setPicked(null);
    return undefined;
  }, [match?.id, match?.status, match?.currentRound]);

  const handleMove = (m: RpsMove) => {
    setPicked(m);
    onMove(m);
  };

  const mySubmitted = Boolean(myPlayer && 'submitted' in myPlayer && myPlayer.submitted);
  const oppSubmitted = Boolean(oppPlayer && 'submitted' in oppPlayer && oppPlayer.submitted);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-black/40 to-black/20 p-4 space-y-4 rps-arena-glow">
      {/* Mode + series */}
      <div className="flex flex-wrap gap-2">
        {(['pvp', 'bot'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={!isLoggedIn || setupLocked}
            onClick={() => onModeChange(m)}
            className={`flex-1 min-w-[100px] py-2 rounded-xl border text-[10px] font-mono uppercase transition-all ${
              mode === m
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.08)]'
                : 'border-slate-800 text-slate-500 hover:border-slate-700'
            }`}
          >
            {m === 'pvp' ? <><Users size={12} className="inline mr-1" />Multiplayer</> : <><Bot size={12} className="inline mr-1" />vs BOT</>}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(['single', 'bo3'] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={!isLoggedIn || setupLocked}
            onClick={() => onSeriesChange(s)}
            className={`flex-1 py-1.5 rounded-lg border text-[9px] font-mono uppercase ${
              seriesType === s
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                : 'border-slate-800 text-slate-600 hover:border-slate-700'
            }`}
          >
            {s === 'single' ? '⚡ Quick duel' : '🏆 Best of 3'}
          </button>
        ))}
      </div>

      {/* Bet */}
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

      {/* Arena center */}
      <div className="relative rounded-2xl border border-slate-800/60 bg-[#080a0f]/80 min-h-[220px] flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.06),transparent_70%)]" />

        {match?.status === 'playing' ? (
          <div className="relative p-4 space-y-3">
            <div className="flex items-center justify-between px-2">
              <div className="text-center flex-1">
                <div className="text-[8px] font-mono uppercase text-slate-600">You</div>
                <div className="text-[10px] font-mono text-slate-300 truncate">
                  {myDisplayName ?? (amP1 && 'displayName' in match.player1 ? match.player1.displayName : 'Player')}
                </div>
              </div>
              <div className="rps-vs-badge px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-[10px] font-mono font-bold text-rose-200">
                VS
              </div>
              <div className="text-center flex-1">
                <div className="text-[8px] font-mono uppercase text-slate-600">Opponent</div>
                {match.mode === 'bot' ? (
                  <OpponentLabel match={match} />
                ) : (
                  <span className="text-[10px] font-mono text-rose-200 truncate max-w-[120px] block mx-auto">
                    {'displayName' in (oppPlayer ?? {}) ? (oppPlayer as { displayName: string }).displayName : 'Opponent'}
                  </span>
                )}
              </div>
            </div>

            <SeriesScoreboard match={match} amP1={amP1} />
            <RoundHistory match={match} amP1={amP1} />

            <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-slate-500">
              <Clock size={11} className={timeLeft < 10000 ? 'text-rose-400' : 'text-slate-500'} />
              {formatTimeLeft(timeLeft)}
              {match.mode === 'pvp' && mySubmitted && !oppSubmitted && (
                <span className="text-amber-400/80 ml-2">Opponent thinking…</span>
              )}
            </div>

            <p className="text-[10px] font-mono text-slate-400 text-center">
              {mySubmitted ? 'Locked in — waiting…' : 'Pick your weapon'}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(['rock', 'paper', 'scissors'] as RpsMove[]).map((m) => {
                const meta = MOVE_META[m];
                const active = picked === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={acting || mySubmitted}
                    onClick={() => handleMove(m)}
                    className={`rps-move-btn group py-5 rounded-2xl border bg-gradient-to-b ${meta.bg} ${meta.border} transition-all hover:scale-[1.03] disabled:opacity-40 ${
                      active ? 'rps-move-picked scale-[1.03]' : ''
                    }`}
                  >
                    <div className="text-4xl group-hover:scale-110 transition-transform">{meta.emoji}</div>
                    <div className={`text-[9px] font-mono mt-1.5 font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : match?.status === 'done' ? (
          <div className={`relative p-6 text-center space-y-3 ${reveal ? 'rps-reveal-shake' : ''}`}>
            <div className="flex items-center justify-center gap-4 text-5xl">
              <span className="rps-reveal-pop" style={{ animationDelay: '0ms' }}>
                {MOVE_META[(amP1 ? match.result?.p1Move : match.result?.p2Move) ?? 'rock']?.emoji}
              </span>
              <span className="text-2xl text-slate-600">⚔️</span>
              <span className="rps-reveal-pop" style={{ animationDelay: '120ms' }}>
                {MOVE_META[(amP1 ? match.result?.p2Move : match.result?.p1Move) ?? 'rock']?.emoji}
              </span>
            </div>
            <div className={`text-sm font-mono font-bold uppercase tracking-widest ${outcomeTone(outcome)}`}>
              {outcomeLabel(outcome)}
            </div>
            {match.seriesType === 'bo3' && match.result?.seriesScore && (
              <div className="text-[9px] font-mono text-violet-300">
                Series {amP1 ? match.result.seriesScore.p1 : match.result.seriesScore.p2}
                {' – '}
                {amP1 ? match.result.seriesScore.p2 : match.result.seriesScore.p1}
              </div>
            )}
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
                className="px-4 py-2 rounded-xl border border-rose-500/35 bg-rose-500/10 text-[10px] font-mono text-rose-200 disabled:opacity-40"
              >
                New game
              </button>
            </div>
          </div>
        ) : waiting ? (
          <div className="relative text-center py-10 px-4">
            <RefreshCw size={28} className="mx-auto text-rose-400 animate-spin mb-3" />
            <p className="text-[11px] font-mono text-slate-300">Scanning for opponent…</p>
            <p className="text-[9px] font-mono text-slate-600 mt-1 flex items-center justify-center gap-1 flex-wrap">
              {queueSize} players in queue · <LulCoinChip variant="bet" amount={bet} /> · {seriesType === 'bo3' ? 'Bo3' : '1 round'}
            </p>
            <button type="button" disabled={acting} onClick={onCancel} className="mt-4 text-[9px] font-mono text-slate-500 hover:text-rose-300 underline disabled:opacity-40 disabled:pointer-events-none">
              Cancel matchmaking
            </button>
          </div>
        ) : (
          <div className="relative text-center py-10 px-4">
            <Swords size={32} className="mx-auto text-rose-400/60 mb-3" />
            <p className="text-[11px] font-mono text-slate-400">Ready when you are</p>
            <p className="text-[9px] font-mono text-slate-600 mt-1 max-w-xs mx-auto">
              {seriesType === 'bo3' ? 'First to 2 round wins takes the pot' : 'One round · winner takes 2× bet'}
            </p>
            <button
              type="button"
              disabled={!isLoggedIn || acting}
              onClick={onStart}
              className="mt-5 px-8 py-3 rounded-xl border border-rose-500/45 bg-gradient-to-r from-rose-600/25 to-amber-600/15 text-[11px] font-mono font-bold text-rose-100 hover:border-rose-400/55 hover:shadow-[0_0_24px_rgba(244,63,94,0.12)] disabled:opacity-40 inline-flex items-center gap-2"
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