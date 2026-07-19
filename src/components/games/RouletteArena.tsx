/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * European roulette (0–36) — solo vs terminal, chip board + wheel, instant spin.
 * Layout mirrors classic Stake-style roulette (manual, chip tray, board, history).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { GameCatalogEntry } from '../../lib/gameCatalog';
import { matchOutcomeForUser, type InstantMatch } from '../../lib/games';
import { ArenaDoneBanner } from './ArenaDoneBanner';
import { LulCoinAmount, LulCoinChip } from './LulCoinAmount';

const CHIP_VALUES = [1, 10, 100, 500] as const;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** European wheel order for visual spin */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

function colorOf(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

function cellClass(n: number) {
  const c = colorOf(n);
  if (c === 'green') return 'roulette-cell roulette-cell--green';
  if (c === 'red') return 'roulette-cell roulette-cell--red';
  return 'roulette-cell roulette-cell--black';
}

/**
 * Board layout (European visual): top row is 3rd column (3,6,9…), middle 2nd, bottom 1st.
 */
const NUMBER_GRID: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

/** Column keys aligned top→bottom with NUMBER_GRID rows (c3, c2, c1). */
const COLUMN_KEYS = ['c3', 'c2', 'c1'] as const;

type BetMap = Record<string, number>;

function encodeBets(bets: BetMap): string {
  return Object.entries(bets)
    .filter(([, a]) => a > 0)
    .map(([k, a]) => `${k}:${a}`)
    .join(',');
}

function totalBets(bets: BetMap): number {
  return Object.values(bets).reduce((s, a) => s + a, 0);
}

/** Conic-gradient stops for European wheel colors (visual only). */
function wheelConic(): string {
  const n = WHEEL_ORDER.length;
  const slice = 360 / n;
  const stops: string[] = [];
  WHEEL_ORDER.forEach((num, i) => {
    const c = colorOf(num);
    const color = c === 'green' ? '#16a34a' : c === 'red' ? '#dc2626' : '#1e293b';
    const a = i * slice;
    const b = (i + 1) * slice;
    stops.push(`${color} ${a}deg ${b}deg`);
  });
  return `conic-gradient(from -${slice / 2}deg, ${stops.join(', ')})`;
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
  onStart: (overrides?: { bet?: number }) => void;
  onCancel: () => void;
  onMove: (move: string) => void;
  onRematch: (overrides?: { bet?: number }) => void;
  onPlayAgain: () => void;
};

export function RouletteArena({
  catalog,
  isLoggedIn,
  userId,
  acting,
  waiting,
  match,
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
  const [chip, setChip] = useState<number>(10);
  const [bets, setBets] = useState<BetMap>({});
  const [spinning, setSpinning] = useState(false);
  const [wheelRot, setWheelRot] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [betTrail, setBetTrail] = useState<Array<{ key: string; amount: number }>>([]);
  const pendingMoveRef = useRef('');
  const submittedForMatchRef = useRef<string | null>(null);
  const wheelBg = useMemo(() => wheelConic(), []);

  const total = totalBets(bets);
  const outcome = match ? matchOutcomeForUser(match, userId) : null;
  const reveal = match?.status === 'done'
    ? (match.reveal as {
        spin?: number;
        color?: string;
        payout?: number;
        totalBet?: number;
        hits?: Array<{ key: string; amount: number; win: number }>;
      } | null)
    : null;

  const matchActive = Boolean(match && match.status === 'playing') || waiting || acting || spinning;
  const canBet = isLoggedIn && !matchActive;

  // Keep parent wager in sync with chip total
  useEffect(() => {
    if (total >= minBet) onBetChange(Math.min(maxBet, total));
  }, [total, minBet, maxBet, onBetChange]);

  // Animate wheel when result lands
  useEffect(() => {
    if (match?.status !== 'done' || reveal?.spin == null) {
      if (match?.status !== 'done') setSpinning(false);
      return;
    }
    const spin = Number(reveal.spin);
    const idx = WHEEL_ORDER.indexOf(spin);
    const slice = 360 / WHEEL_ORDER.length;
    // Extra spins + land selected pocket under the top pointer
    const target = 360 * 5 + (360 - idx * slice);
    setSpinning(true);
    setWheelRot((prev) => {
      // Keep rotation monotonically increasing so CSS transition always spins forward
      const base = Math.ceil(prev / 360) * 360;
      return base + target;
    });
    const t = window.setTimeout(() => {
      setSpinning(false);
      setHistory((h) => [spin, ...h].slice(0, 8));
    }, 2400);
    return () => window.clearTimeout(t);
  }, [match?.id, match?.status, reveal?.spin]);

  // Auto-submit bets once match starts
  useEffect(() => {
    if (!match || match.status !== 'playing' || acting) return;
    if (submittedForMatchRef.current === match.id) return;
    if (match.player1?.move || match.player1?.submitted) {
      submittedForMatchRef.current = match.id;
      return;
    }
    if (!pendingMoveRef.current) return;
    submittedForMatchRef.current = match.id;
    onMove(pendingMoveRef.current);
  }, [match?.id, match?.status, match?.player1?.move, match?.player1?.submitted, acting, onMove]);

  const addBet = (key: string) => {
    if (!canBet) return;
    setBets((prev) => {
      const nextTotal = totalBets(prev) + chip;
      if (nextTotal > maxBet) return prev;
      const next = { ...prev };
      next[key] = (next[key] ?? 0) + chip;
      setBetTrail((t) => [...t, { key, amount: chip }]);
      return next;
    });
  };

  const clearBets = () => {
    if (matchActive) return;
    setBets({});
    setBetTrail([]);
  };

  const undoLast = () => {
    if (matchActive) return;
    setBetTrail((trail) => {
      if (!trail.length) return trail;
      const last = trail[trail.length - 1];
      setBets((prev) => {
        const next = { ...prev };
        const cur = next[last.key] ?? 0;
        const left = cur - last.amount;
        if (left <= 0) delete next[last.key];
        else next[last.key] = left;
        return next;
      });
      return trail.slice(0, -1);
    });
  };

  const spin = () => {
    if (!isLoggedIn || total < minBet || matchActive) return;
    const encoded = encodeBets(bets);
    if (!encoded) return;
    const stake = Math.min(maxBet, total);
    pendingMoveRef.current = encoded;
    submittedForMatchRef.current = null;
    onBetChange(stake);
    if (match?.status === 'done') {
      onRematch({ bet: stake });
    } else {
      onStart({ bet: stake });
    }
  };

  const chipOn = (key: string) => bets[key] ?? 0;

  const ChipBadge = ({ amount }: { amount: number }) =>
    amount > 0 ? (
      <span className="roulette-chip-stack" title={`${amount} LUL`}>
        <span className="roulette-chip-stack__dot" aria-hidden />
        <span>{amount >= 1000 ? `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k` : amount}</span>
      </span>
    ) : null;

  return (
    <div className="roulette-arena rounded-2xl border border-slate-800/80 overflow-hidden">
      <div className="roulette-arena__layout">
        {/* Left controls — Manual / chips / stake / spin */}
        <aside className="roulette-panel">
          <div className="roulette-panel__mode">
            <span className="roulette-pill roulette-pill--on">Manual</span>
            <span className="roulette-pill" title="Auto mode coming later">Instant</span>
          </div>

          <div className="roulette-field">
            <span className="roulette-field__label">Chip value</span>
            <div className="roulette-chips">
              {CHIP_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={!isLoggedIn || matchActive}
                  className={`roulette-chip-pick ${chip === v ? 'roulette-chip-pick--on' : ''}`}
                  onClick={() => setChip(v)}
                  title={`${v} LUL`}
                >
                  {v >= 1000 ? '1K' : v}
                </button>
              ))}
            </div>
          </div>

          <div className="roulette-field">
            <span className="roulette-field__label">Total stake</span>
            <div className="roulette-total">
              <LulCoinAmount amount={total} variant="bet" size="sm" suffix="LUL" />
              <span className="text-[8px] font-mono text-slate-600">
                {Object.keys(bets).filter((k) => (bets[k] ?? 0) > 0).length} spots
              </span>
            </div>
          </div>

          {(streak ?? 0) > 0 && streakBonusHint ? (
            <LulCoinChip variant="streak" label={`🔥 +${streakBonusHint}`} />
          ) : null}

          <button
            type="button"
            className="roulette-spin-btn"
            disabled={!isLoggedIn || total < minBet || acting || spinning}
            onClick={spin}
          >
            {acting || spinning ? 'Spinning…' : match?.status === 'done' ? 'Spin again' : 'Spin'}
          </button>

          {!isLoggedIn && (
            <p className="roulette-panel__hint">Sign in to place chips and spin.</p>
          )}

          {waiting && (
            <button type="button" className="roulette-link" onClick={onCancel}>Cancel queue</button>
          )}
        </aside>

        {/* Stage: last · wheel · history + board */}
        <div className="roulette-stage">
          <div className="roulette-stage__top">
            <div className="roulette-last">
              {reveal?.spin != null && !spinning ? (
                <div className={`roulette-last__num roulette-last__num--${reveal.color ?? colorOf(Number(reveal.spin))}`}>
                  {reveal.spin}
                </div>
              ) : (
                <div className="roulette-last__num roulette-last__num--wait">
                  {spinning ? '…' : <Sparkles size={16} />}
                </div>
              )}
            </div>

            <div className="roulette-wheel-wrap">
              <div
                className={`roulette-wheel ${spinning ? 'roulette-wheel--spin' : ''}`}
                style={{
                  transform: `rotate(${wheelRot}deg)`,
                  background: wheelBg,
                }}
              >
                {WHEEL_ORDER.map((n, i) => {
                  const ang = (i / WHEEL_ORDER.length) * 360;
                  const c = colorOf(n);
                  return (
                    <span
                      key={n}
                      className={`roulette-wedge roulette-wedge--${c}`}
                      style={{ transform: `rotate(${ang}deg)` }}
                    >
                      <span className="roulette-wedge__n">{n}</span>
                    </span>
                  );
                })}
                <span className="roulette-wheel__rim" aria-hidden />
                <span className="roulette-wheel__hub" />
                {spinning && <span className="roulette-wheel__ball" aria-hidden />}
              </div>
              <span className="roulette-wheel__pointer" aria-hidden />
            </div>

            <div className="roulette-history" aria-label="Recent spins">
              {history.length === 0 && (
                <span className="roulette-hist roulette-hist--empty">—</span>
              )}
              {history.map((n, i) => (
                <span key={`${n}-${i}`} className={`roulette-hist roulette-hist--${colorOf(n)}`}>{n}</span>
              ))}
            </div>
          </div>

          {/* Betting table */}
          <div className="roulette-table">
            <button
              type="button"
              className={`${cellClass(0)} roulette-zero`}
              disabled={!canBet}
              onClick={() => addBet('n0')}
            >
              0
              <ChipBadge amount={chipOn('n0')} />
            </button>

            <div className="roulette-numbers">
              {NUMBER_GRID.map((row, ri) => (
                <div key={ri} className="roulette-numbers__row">
                  {row.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={cellClass(n)}
                      disabled={!canBet}
                      onClick={() => addBet(`n${n}`)}
                    >
                      {n}
                      <ChipBadge amount={chipOn(`n${n}`)} />
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="roulette-cols">
              {COLUMN_KEYS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="roulette-outside"
                  disabled={!canBet}
                  onClick={() => addBet(c)}
                >
                  2:1
                  <ChipBadge amount={chipOn(c)} />
                </button>
              ))}
            </div>

            <div className="roulette-dozens">
              {([
                ['d1', '1 to 12'],
                ['d2', '13 to 24'],
                ['d3', '25 to 36'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className="roulette-outside"
                  disabled={!canBet}
                  onClick={() => addBet(k)}
                >
                  {label}
                  <ChipBadge amount={chipOn(k)} />
                </button>
              ))}
            </div>

            <div className="roulette-even">
              {([
                ['low', '1 to 18'],
                ['even', 'Even'],
                ['red', 'Red'],
                ['black', 'Black'],
                ['odd', 'Odd'],
                ['high', '19 to 36'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`roulette-outside ${k === 'red' ? 'roulette-outside--red' : k === 'black' ? 'roulette-outside--black' : ''}`}
                  disabled={!canBet}
                  onClick={() => addBet(k)}
                >
                  {label}
                  <ChipBadge amount={chipOn(k)} />
                </button>
              ))}
            </div>
          </div>

          <div className="roulette-table-actions">
            <button type="button" className="roulette-link" disabled={matchActive || !betTrail.length} onClick={undoLast}>
              <RotateCcw size={11} /> Undo
            </button>
            <button type="button" className="roulette-link" disabled={matchActive || total === 0} onClick={clearBets}>
              <Trash2 size={11} /> Clear board
            </button>
          </div>

          {match?.status === 'done' && (
            <div className="mt-3 px-1">
              <ArenaDoneBanner
                catalog={catalog}
                outcome={outcome}
                streakBonus={match.streakBonus}
                jackpotHit={match.jackpotHit}
                jackpotAmount={match.jackpotAmount}
                onRematch={() => {
                  const t = Math.max(minBet, totalBets(bets));
                  if (t < minBet || !encodeBets(bets)) return;
                  pendingMoveRef.current = encodeBets(bets);
                  submittedForMatchRef.current = null;
                  onBetChange(t);
                  onRematch({ bet: t });
                }}
                onPlayAgain={() => {
                  onPlayAgain();
                }}
                detail={reveal ? (
                  <p className="text-[10px] font-mono text-slate-400">
                    Ball on{' '}
                    <span className={`font-bold ${reveal.color === 'red' ? 'text-rose-400' : reveal.color === 'green' ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {reveal.spin}
                    </span>
                    {typeof reveal.payout === 'number' && reveal.payout > 0 && (
                      <> · paid <LulCoinAmount amount={reveal.payout} variant="earn" size="xs" /></>
                    )}
                    {typeof reveal.totalBet === 'number' && (
                      <> · staked <LulCoinAmount amount={reveal.totalBet} variant="bet" size="xs" /></>
                    )}
                  </p>
                ) : null}
              />
            </div>
          )}
        </div>
      </div>

      <p className="roulette-footnote">
        {catalog.icon} European roulette · straight 35:1 · dozen/column 2:1 · even money 1:1 · 2% of every bet seeds jackpot · losses feed the pot
      </p>
    </div>
  );
}
