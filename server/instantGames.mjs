/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createInstantDuelGame } from './instantDuelFactory.mjs';

const RPSLS_BEATS = {
  rock: ['scissors', 'lizard'],
  paper: ['rock', 'spock'],
  scissors: ['paper', 'lizard'],
  lizard: ['spock', 'paper'],
  spock: ['scissors', 'rock'],
};

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rpslsWinner(a, b) {
  if (a === b) return 'draw';
  if (RPSLS_BEATS[a]?.includes(b)) return 'p1';
  return 'p2';
}

function biasedBotPick(moves, playerMove, difficulty, beatFn) {
  if (!playerMove || difficulty === 'easy') return randPick(moves);
  const roll = Math.random();
  if (difficulty === 'hard' && roll < 0.38) {
    const winning = moves.find((m) => beatFn(m, playerMove) === 'p1');
    if (winning) return winning;
  }
  if (difficulty === 'normal' && roll < 0.3) return randPick(moves);
  return randPick(moves);
}

export const coinflip = createInstantDuelGame({
  gameId: 'coinflip',
  statKey: 'Coinflip',
  achievementFlag: 'coinflip_played',
  chatLabel: 'Coin Flip',
  validateMove: (m) => ['heads', 'tails'].includes(m),
  resolveWinner: (m) => {
    const flip = Math.random() < 0.5 ? 'heads' : 'tails';
    m.reveal = { flip };
    const p1 = m.player1.move === flip;
    const p2 = m.player2.move === flip;
    if (p1 && p2) return 'draw';
    if (p1) return 'p1';
    if (p2) return 'p2';
    return 'draw';
  },
  botMove: (playerMove, difficulty) => {
    if (difficulty === 'hard' && Math.random() < 0.35) {
      return playerMove === 'heads' ? 'tails' : 'heads';
    }
    return randPick(['heads', 'tails']);
  },
});

export const dice = createInstantDuelGame({
  gameId: 'dice',
  statKey: 'Dice',
  achievementFlag: 'dice_played',
  chatLabel: 'Dice Duel',
  validateMove: (m) => m === 'roll',
  resolveWinner: (m) => {
    const bias = m.botDifficulty === 'hard' && m.mode === 'bot' ? 1 : 0;
    const p1Roll = 1 + Math.floor(Math.random() * 6);
    let p2Roll = 1 + Math.floor(Math.random() * 6);
    if (bias && p2Roll <= p1Roll && Math.random() < 0.5) p2Roll = Math.min(6, p1Roll + 1);
    m.player1.move = String(p1Roll);
    m.player2.move = String(p2Roll);
    m.reveal = { p1Roll, p2Roll };
    if (p1Roll === p2Roll) return 'draw';
    return p1Roll > p2Roll ? 'p1' : 'p2';
  },
  botMove: () => 'roll',
});

export const oddeven = createInstantDuelGame({
  gameId: 'oddeven',
  statKey: 'Oddeven',
  achievementFlag: 'oddeven_played',
  chatLabel: 'Odd or Even',
  validateMove: (m) => ['odd', 'even'].includes(m),
  resolveWinner: (m) => {
    const roll = 1 + Math.floor(Math.random() * 6);
    const parity = roll % 2 === 0 ? 'even' : 'odd';
    m.reveal = { roll, parity };
    const p1 = m.player1.move === parity;
    const p2 = m.player2.move === parity;
    if (p1 && p2) return 'draw';
    if (p1) return 'p1';
    if (p2) return 'p2';
    return 'draw';
  },
  botMove: (playerMove, difficulty) => {
    if (difficulty === 'hard' && playerMove && Math.random() < 0.35) {
      return playerMove === 'odd' ? 'even' : 'odd';
    }
    return randPick(['odd', 'even']);
  },
});

const CARD_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const war = createInstantDuelGame({
  gameId: 'war',
  statKey: 'War',
  achievementFlag: 'war_played',
  chatLabel: 'Card War',
  validateMove: (m) => m === 'flip',
  resolveWinner: (m) => {
    let p1Card = 1 + Math.floor(Math.random() * 13);
    let p2Card = 1 + Math.floor(Math.random() * 13);
    if (m.mode === 'bot' && m.botDifficulty === 'hard' && p2Card <= p1Card && Math.random() < 0.45) {
      p2Card = Math.min(13, p1Card + 1 + Math.floor(Math.random() * 2));
    }
    m.player1.move = CARD_LABELS[p1Card - 1];
    m.player2.move = CARD_LABELS[p2Card - 1];
    m.reveal = { p1Card, p2Card };
    if (p1Card === p2Card) return 'draw';
    return p1Card > p2Card ? 'p1' : 'p2';
  },
  botMove: () => 'flip',
});

const RPSLS_MOVES = ['rock', 'paper', 'scissors', 'lizard', 'spock'];

export const rpsls = createInstantDuelGame({
  gameId: 'rpsls',
  statKey: 'Rpsls',
  achievementFlag: 'rpsls_played',
  chatLabel: 'RPS Lizard Spock',
  validateMove: (m) => RPSLS_MOVES.includes(m),
  resolveWinner: (m) => rpslsWinner(m.player1.move, m.player2.move),
  botMove: (playerMove, difficulty) =>
    biasedBotPick(RPSLS_MOVES, playerMove, difficulty, (a, b) => (RPSLS_BEATS[a]?.includes(b) ? 'p1' : 'p2')),
});

export const numberduel = createInstantDuelGame({
  gameId: 'numberduel',
  statKey: 'Numberduel',
  achievementFlag: 'numberduel_played',
  chatLabel: 'Number Duel',
  validateMove: (m) => {
    const n = Number(m);
    return Number.isInteger(n) && n >= 1 && n <= 10;
  },
  resolveWinner: (m) => {
    const p1 = Number(m.player1.move);
    const p2 = Number(m.player2.move);
    if (p1 === p2) return 'draw';
    return p1 > p2 ? 'p1' : 'p2';
  },
  botMove: (playerMove, difficulty) => {
    const p = Number(playerMove);
    if (difficulty === 'hard' && p >= 1 && p <= 10 && Math.random() < 0.4) {
      return String(Math.min(10, p + 1 + Math.floor(Math.random() * 2)));
    }
    return String(1 + Math.floor(Math.random() * 10));
  },
});

const COLORS = ['red', 'blue', 'green', 'yellow'];

export const colorpick = createInstantDuelGame({
  gameId: 'colorpick',
  statKey: 'Colorpick',
  achievementFlag: 'colorpick_played',
  chatLabel: 'Color Pick',
  validateMove: (m) => COLORS.includes(m),
  resolveWinner: (m) => {
    const winning = randPick(COLORS);
    m.reveal = { winning };
    const p1 = m.player1.move === winning;
    const p2 = m.player2.move === winning;
    if (p1 && p2) return 'draw';
    if (p1) return 'p1';
    if (p2) return 'p2';
    return 'draw';
  },
  botMove: (playerMove, difficulty) => {
    if (difficulty === 'hard' && playerMove && Math.random() < 0.3) {
      return randPick(COLORS.filter((c) => c !== playerMove));
    }
    return randPick(COLORS);
  },
});

export const highlow = createInstantDuelGame({
  gameId: 'highlow',
  statKey: 'Highlow',
  achievementFlag: 'highlow_played',
  chatLabel: 'High or Low',
  validateMove: (m) => ['high', 'low'].includes(m),
  resolveWinner: (m) => {
    const target = 1 + Math.floor(Math.random() * 100);
    const answer = target > 50 ? 'high' : 'low';
    m.reveal = { target, answer };
    const p1 = m.player1.move === answer;
    const p2 = m.player2.move === answer;
    if (p1 && p2) return 'draw';
    if (p1) return 'p1';
    if (p2) return 'p2';
    return 'draw';
  },
  botMove: (playerMove, difficulty) => {
    if (difficulty === 'hard' && playerMove && Math.random() < 0.35) {
      return playerMove === 'high' ? 'low' : 'high';
    }
    return randPick(['high', 'low']);
  },
});

export const mines = createInstantDuelGame({
  gameId: 'mines',
  statKey: 'Mines',
  achievementFlag: 'mines_played',
  chatLabel: 'Minefield',
  validateMove: (m) => {
    const n = Number(m);
    return Number.isInteger(n) && n >= 0 && n <= 8;
  },
  resolveWinner: (m) => {
    const mine = Math.floor(Math.random() * 9);
    const p1Cell = Number(m.player1.move);
    const p2Cell = Number(m.player2.move);
    m.reveal = { mine, p1Cell, p2Cell };
    const p1Hit = p1Cell === mine;
    const p2Hit = p2Cell === mine;
    if (p1Hit && p2Hit) return 'draw';
    if (p1Hit) return 'p2';
    if (p2Hit) return 'p1';
    return 'draw';
  },
  botMove: (_playerMove, difficulty) => {
    const cell = Math.floor(Math.random() * 9);
    if (difficulty === 'hard' && Math.random() < 0.2) {
      return String(Math.floor(Math.random() * 9));
    }
    return String(cell);
  },
});

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c === 1) { aces += 1; total += 11; }
    else if (c >= 10) total += 10;
    else total += c;
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

/** Stake-style over/under dice: move = "over:50" | "under:50" (target 1–99). */
const DICE100_HOUSE_EDGE = 0.01;

export function parseDice100Move(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  const m = s.match(/^(over|under):(\d{1,2}(?:\.\d{1,2})?)$/);
  if (!m) return null;
  const dir = m[1];
  const target = Number(m[2]);
  if (!Number.isFinite(target) || target < 1 || target > 99) return null;
  return { dir, target: Math.round(target * 100) / 100 };
}

export function dice100Odds(dir, target) {
  const t = Number(target);
  const chance = dir === 'over'
    ? Math.max(0.01, (100 - t) / 100)
    : Math.max(0.01, t / 100);
  const multiplier = Math.max(1.01, Math.floor(((1 - DICE100_HOUSE_EDGE) / chance) * 10000) / 10000);
  return { chance, chancePct: Math.round(chance * 10000) / 100, multiplier };
}

const dice100Base = createInstantDuelGame({
  gameId: 'dice100',
  statKey: 'Dice100',
  achievementFlag: 'dice100_played',
  chatLabel: 'Dice 100',
  validateMove: (m) => Boolean(parseDice100Move(m)),
  resolveWinner: (m) => {
    const parsed = parseDice100Move(m.player1.move);
    if (!parsed) return 'p2';
    // Roll 0.00–100.00 inclusive (2 decimals)
    const roll = Math.floor(Math.random() * 10001) / 100;
    const { dir, target } = parsed;
    const won = dir === 'over' ? roll > target : roll < target;
    const { chancePct, multiplier } = dice100Odds(dir, target);
    m.payoutMultiplier = won ? multiplier : 0;
    m.player2.move = roll.toFixed(2);
    m.reveal = {
      roll,
      dir,
      target,
      chancePct,
      multiplier,
      won,
    };
    return won ? 'p1' : 'p2';
  },
  botMove: () => 'house',
});

/** Single-player house game — always bot mode (instant result vs terminal). */
export const dice100 = {
  ...dice100Base,
  joinQueue: (userId, opts = {}) =>
    dice100Base.joinQueue(userId, { ...opts, mode: 'bot' }),
};

export const blackjack = createInstantDuelGame({
  gameId: 'blackjack',
  statKey: 'Blackjack',
  achievementFlag: 'blackjack_played',
  chatLabel: 'Blackjack Duel',
  validateMove: (m) => m === 'deal',
  resolveWinner: (m) => {
    const deal = () => 1 + Math.floor(Math.random() * 10);
    const p1Cards = [deal(), deal()];
    let p2Cards = [deal(), deal()];
    if (m.mode === 'bot' && m.botDifficulty === 'hard' && handValue(p2Cards) <= handValue(p1Cards)) {
      p2Cards.push(deal());
    }
    const p1Total = handValue(p1Cards);
    const p2Total = handValue(p2Cards);
    m.reveal = { p1Cards, p2Cards, p1Total, p2Total };
    m.player1.move = String(p1Total);
    m.player2.move = String(p2Total);
    const p1Bust = p1Total > 21;
    const p2Bust = p2Total > 21;
    if (p1Bust && p2Bust) return 'draw';
    if (p1Bust) return 'p2';
    if (p2Bust) return 'p1';
    if (p1Total === p2Total) return 'draw';
    return p1Total > p2Total ? 'p1' : 'p2';
  },
  botMove: () => 'deal',
});

export const INSTANT_GAMES = {
  coinflip,
  dice,
  oddeven,
  war,
  rpsls,
  numberduel,
  colorpick,
  highlow,
  mines,
  blackjack,
  dice100,
};