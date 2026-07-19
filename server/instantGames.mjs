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

/** European roulette 0–36. Move encodes chip map, e.g. "n15:100,red:50,d2:20,even:10" */
const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
/** Visual wheel order (European). */
export const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export function rouletteColor(n) {
  const num = Number(n);
  if (num === 0) return 'green';
  return ROULETTE_RED.has(num) ? 'red' : 'black';
}

/**
 * Parse move into list of { key, amount }.
 * Keys: n0–n36, red, black, odd, even, low, high, d1, d2, d3, c1, c2, c3
 */
export function parseRouletteMove(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length || parts.length > 40) return null;
  const bets = [];
  let total = 0;
  for (const part of parts) {
    const m = part.match(/^(n(?:[0-9]|[12][0-9]|3[0-6])|red|black|odd|even|low|high|d[123]|c[123]):(\d+)$/);
    if (!m) return null;
    const amount = Number(m[2]);
    if (!Number.isInteger(amount) || amount < 1 || amount > 500) return null;
    bets.push({ key: m[1], amount });
    total += amount;
  }
  if (total < 1 || total > 500) return null;
  return { bets, total };
}

/** Payout multiple of stake returned on win (includes stake). */
function roulettePayoutMult(key) {
  if (key.startsWith('n')) return 36; // 35:1
  if (key === 'd1' || key === 'd2' || key === 'd3' || key === 'c1' || key === 'c2' || key === 'c3') return 3; // 2:1
  return 2; // even money 1:1
}

function rouletteBetHits(key, spin) {
  if (key.startsWith('n')) return Number(key.slice(1)) === spin;
  if (spin === 0) return false; // outside bets lose on 0
  if (key === 'red') return ROULETTE_RED.has(spin);
  if (key === 'black') return !ROULETTE_RED.has(spin);
  if (key === 'odd') return spin % 2 === 1;
  if (key === 'even') return spin % 2 === 0;
  if (key === 'low') return spin >= 1 && spin <= 18;
  if (key === 'high') return spin >= 19 && spin <= 36;
  if (key === 'd1') return spin >= 1 && spin <= 12;
  if (key === 'd2') return spin >= 13 && spin <= 24;
  if (key === 'd3') return spin >= 25 && spin <= 36;
  // columns: 1=1,4,7… 2=2,5,8… 3=3,6,9…
  if (key === 'c1') return spin % 3 === 1;
  if (key === 'c2') return spin % 3 === 2;
  if (key === 'c3') return spin % 3 === 0;
  return false;
}

const rouletteBase = createInstantDuelGame({
  gameId: 'roulette',
  statKey: 'Roulette',
  achievementFlag: 'roulette_played',
  chatLabel: 'Roulette',
  validateMove: (m) => Boolean(parseRouletteMove(m)),
  resolveWinner: (m) => {
    const parsed = parseRouletteMove(m.player1.move);
    if (!parsed) return 'p2';
    // Ensure match bet matches total chips (join should set bet = total)
    if (Number(m.bet) !== parsed.total) {
      // Still resolve, but trust move total for payout math if mismatched
    }
    const spin = Math.floor(Math.random() * 37); // 0–36
    let payout = 0;
    const hits = [];
    for (const b of parsed.bets) {
      if (rouletteBetHits(b.key, spin)) {
        const win = b.amount * roulettePayoutMult(b.key);
        payout += win;
        hits.push({ key: b.key, amount: b.amount, win });
      }
    }
    const won = payout > 0;
    m.payoutExact = won ? payout : 0;
    m.payoutMultiplier = won && parsed.total > 0 ? payout / parsed.total : 0;
    m.player2.move = String(spin);
    m.reveal = {
      spin,
      color: rouletteColor(spin),
      bets: parsed.bets,
      hits,
      payout,
      totalBet: parsed.total,
      won,
    };
    return won ? 'p1' : 'p2';
  },
  botMove: () => 'house',
});

export const roulette = {
  ...rouletteBase,
  joinQueue: (userId, opts = {}) =>
    rouletteBase.joinQueue(userId, { ...opts, mode: 'bot' }),
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
  roulette,
};