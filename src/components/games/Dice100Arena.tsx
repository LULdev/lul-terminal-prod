/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stake-style Over/Under dice (0–100), solo vs terminal, variable multiplier.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Dices, RefreshCw, Sparkles } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { matchOutcomeForUser, type InstantMatch } from '../../lib/games';
import { ArenaDoneBanner } from './ArenaDoneBanner';
import { QuickBetChips } from './QuickBetChips';
import { LulCoinAmount, LulCoinChip } from './LulCoinAmount';

const HOUSE_EDGE = 0.01;

export function dice100Odds(dir: 'over' | 'under', target: number) {
  const t = Math.min(99, Math.max(1, Number(target) || 50));
  const chance = dir === 'over' ? Math.max(0.01, (100 - t) / 100) : Math.max(0.01, t / 100);
  const multiplier = Math.max(1.01, Math.floor(((1 - HOUSE_EDGE) / chance) * 10000) / 10000);
  return {
    target: t,
    chance,
    chancePct: Math.round(chance * 10000) / 100,
    multiplier,
  };
}

function encodeMove(dir: 'over' | 'under', target: number) {
  const t = Math.min(99, Math.max(1, Math.round(target * 100) / 100));
  return `${dir}:${t}`;
}

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
  streak?: number;
  streakBonusHint?: number;
  onBetChange: (n: number) => void;
  onStart: () => void;
  onCancel: () => void;
  onMove: (move: string) => void;
  onRematch: () => void;
  onPlayAgain: () => void;
};

export function Dice100Arena({
  catalog,
  isLoggedIn,
  userId,
  acting,
  waiting,
  match,
  bet,
  maxBet,
  minBet,
  streak,
  streakBonusHint,
  onBetChange,
  onStart,
  onCancel,
  onMove,
  onRematch,
  onPlayAgain,
}: Props) {
  const [dir, setDir] = useState<'over' | 'under'>('over');
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);
  const pendingMoveRef = useRef(encodeMove('over', 50));
  const submittedForMatchRef = useRef<string | null>(null);

  const odds = useMemo(() => dice100Odds(dir, target), [dir, target]);
  const profit = Math.max(0, Math.round(bet * odds.multiplier) - bet);
  const outcome = match ? matchOutcomeForUser(match, userId) : null;
  const reveal = match?.status === 'done' ? (match.reveal as {
    roll?: number;
    dir?: string;
    target?: number;
    chancePct?: number;
    multiplier?: number;
    won?: boolean;
  } | null) : null;

  // Animate roll when match completes
  useEffect(() => {
    if (match?.status !== 'done' || reveal?.roll == null) {
      if (match?.status !== 'playing' && match?.status !== 'done') setDisplayRoll(null);
      return;
    }
    const final = Number(reveal.roll);
    setRolling(true);
    let frame = 0;
    const frames = 18;
    const iv = window.setInterval(() => {
      frame += 1;
      if (frame >= frames) {
        window.clearInterval(iv);
        setDisplayRoll(final);
        setRolling(false);
        return;
      }
      setDisplayRoll(Math.floor(Math.random() * 10001) / 100);
    }, 45);
    return () => window.clearInterval(iv);
  }, [match?.id, match?.status, reveal?.roll]);

  // Solo: auto-submit locked-in move once match starts
  useEffect(() => {
    if (!match || match.status !== 'playing' || acting) return;
    if (submittedForMatchRef.current === match.id) return;
    if (match.player1?.move || match.player1?.submitted) {
      submittedForMatchRef.current = match.id;
      return;
    }
    submittedForMatchRef.current = match.id;
    onMove(pendingMoveRef.current);
  }, [match?.id, match?.status, match?.player1?.move, match?.player1?.submitted, acting, onMove]);

  const matchActive = Boolean(match && match.status === 'playing') || waiting || acting || rolling;
  const markerPct = displayRoll != null
    ? Math.min(100, Math.max(0, displayRoll))
    : target;
  const overGreen = dir === 'over';

  const half = () => onBetChange(Math.max(minBet, Math.floor(bet / 2)));
  const double = () => onBetChange(Math.min(maxBet, bet * 2));

  return (
    <div className="dice100-arena rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#0a0e16] to-black/40 overflow-hidden">
      <div className="dice100-arena__layout">
        {/* Left: bet panel */}
        <aside className="dice100-panel">
          <div className="dice100-panel__mode">
            <span className="dice100-panel__mode-pill dice100-panel__mode-pill--active">Manual</span>
            <span className="dice100-panel__mode-pill" title="Auto mode coming soon">Instant</span>
          </div>

          <label className="dice100-field">
            <span className="dice100-field__label">Wager · LULcoins</span>
            <div className="dice100-field__row">
              <input
                type="number"
                min={minBet}
                max={maxBet}
                value={bet}
                disabled={!isLoggedIn || matchActive}
                onChange={(e) => onBetChange(Math.max(minBet, Math.min(maxBet, Number(e.target.value) || minBet)))}
                className="dice100-input"
              />
              <button type="button" className="dice100-chip-btn" disabled={!isLoggedIn || matchActive} onClick={half}>½</button>
              <button type="button" className="dice100-chip-btn" disabled={!isLoggedIn || matchActive} onClick={double}>2×</button>
            </div>
            <QuickBetChips bet={bet} maxBet={maxBet} disabled={!isLoggedIn || matchActive} onSelect={onBetChange} />
          </label>

          {(streak ?? 0) > 0 && streakBonusHint ? (
            <LulCoinChip variant="streak" label={`🔥 Streak +${streakBonusHint}`} />
          ) : null}

          <div className="dice100-field">
            <span className="dice100-field__label">Profit on win</span>
            <div className="dice100-profit">
              <LulCoinAmount amount={profit} variant="earn" size="sm" suffix="LUL" />
              <span className="dice100-profit__mult">×{odds.multiplier.toFixed(4)}</span>
            </div>
          </div>

          {!match || match.status === 'done' ? (
            <button
              type="button"
              disabled={!isLoggedIn || acting}
              onClick={() => {
                pendingMoveRef.current = encodeMove(dir, target);
                submittedForMatchRef.current = null;
                if (match?.status === 'done') {
                  onRematch();
                } else {
                  onStart();
                }
              }}
              className="dice100-bet-btn"
            >
              {acting ? (
                <><RefreshCw size={14} className="animate-spin inline" /> Rolling…</>
              ) : match?.status === 'done' ? (
                <><Dices size={14} className="inline" /> Bet again</>
              ) : (
                <><Dices size={14} className="inline" /> Bet</>
              )}
            </button>
          ) : (
            <button type="button" disabled className="dice100-bet-btn dice100-bet-btn--busy">
              <RefreshCw size={14} className="animate-spin inline" /> Resolving…
            </button>
          )}

          {waiting && (
            <button type="button" onClick={onCancel} className="dice100-cancel">
              Cancel
            </button>
          )}
        </aside>

        {/* Center: slider + result */}
        <div className="dice100-stage">
          <div className="dice100-stage__history" aria-hidden>
            {/* decorative recent rolls strip */}
            {[96.4, 90.59, 51.31, 68.12, 26.33, 55.58].map((n, i) => (
              <span
                key={i}
                className={`dice100-hist ${n > 50 ? 'dice100-hist--hi' : 'dice100-hist--lo'}`}
              >
                {n.toFixed(2)}
              </span>
            ))}
          </div>

          <div className="dice100-roll-display">
            {displayRoll != null ? (
              <span className={`dice100-roll-num ${rolling ? 'dice100-roll-num--spin' : outcome === 'win' ? 'dice100-roll-num--win' : outcome === 'loss' ? 'dice100-roll-num--loss' : ''}`}>
                {displayRoll.toFixed(2)}
              </span>
            ) : (
              <span className="dice100-roll-placeholder">
                <Sparkles size={16} /> Set target · hit Bet
              </span>
            )}
          </div>

          <div className="dice100-slider-wrap">
            <div className="dice100-slider-labels">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
            <div className="dice100-slider-track">
              <div
                className="dice100-slider-fill dice100-slider-fill--red"
                style={{
                  left: overGreen ? '0%' : `${target}%`,
                  width: overGreen ? `${target}%` : `${100 - target}%`,
                }}
              />
              <div
                className="dice100-slider-fill dice100-slider-fill--green"
                style={{
                  left: overGreen ? `${target}%` : '0%',
                  width: overGreen ? `${100 - target}%` : `${target}%`,
                }}
              />
              <div
                className="dice100-slider-thumb"
                style={{ left: `calc(${target}% - 10px)` }}
              />
              {displayRoll != null && !rolling && (
                <div
                  className={`dice100-result-marker ${outcome === 'win' ? 'dice100-result-marker--win' : 'dice100-result-marker--loss'}`}
                  style={{ left: `calc(${markerPct}% - 6px)` }}
                  title={`Roll ${displayRoll.toFixed(2)}`}
                />
              )}
              <input
                type="range"
                min={1}
                max={99}
                step={0.01}
                value={target}
                disabled={!isLoggedIn || matchActive}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="dice100-slider-input"
                aria-label="Target number"
              />
            </div>
          </div>

          <div className="dice100-controls">
            <label className="dice100-ctrl">
              <span>Multiplier</span>
              <input
                type="text"
                readOnly
                value={odds.multiplier.toFixed(4)}
                className="dice100-ctrl-input"
              />
            </label>
            <button
              type="button"
              className="dice100-dir-btn"
              disabled={!isLoggedIn || matchActive}
              onClick={() => setDir((d) => (d === 'over' ? 'under' : 'over'))}
              title="Toggle Over / Under"
            >
              <ArrowDownUp size={14} />
              <span>{dir === 'over' ? 'Over' : 'Under'}</span>
              <strong>{target.toFixed(2)}</strong>
            </button>
            <label className="dice100-ctrl">
              <span>Win chance</span>
              <input
                type="text"
                readOnly
                value={`${odds.chancePct.toFixed(4)} %`}
                className="dice100-ctrl-input"
              />
            </label>
          </div>

          {match?.status === 'done' && (
            <div className="mt-3">
              <ArenaDoneBanner
                catalog={catalog}
                outcome={outcome}
                streakBonus={match.streakBonus}
                jackpotHit={match.jackpotHit}
                jackpotAmount={match.jackpotAmount}
                onRematch={() => {
                  pendingMoveRef.current = encodeMove(dir, target);
                  submittedForMatchRef.current = null;
                  onRematch();
                }}
                onPlayAgain={onPlayAgain}
                detail={reveal ? (
                  <p className="text-[10px] font-mono text-slate-400">
                    Roll <span className="text-amber-200 font-bold">{Number(reveal.roll).toFixed(2)}</span>
                    {' · '}
                    {reveal.dir === 'over' ? 'Over' : 'Under'} {Number(reveal.target).toFixed(2)}
                    {' · ×'}{Number(reveal.multiplier).toFixed(4)}
                  </p>
                ) : null}
              />
            </div>
          )}
        </div>
      </div>

      <p className="dice100-footnote">
        {catalog.icon} {catalog.label} · solo instant · 1% house edge · 2% of every bet seeds the pot · losses feed jackpot
      </p>
    </div>
  );
}
