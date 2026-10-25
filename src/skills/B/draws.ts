import { SUITS, rankValue, suitOf } from '../../engine/cards';
import {
  flushCompleters,
  quickStraightFlushOuts,
  straightCompleters,
  straightFlushOuts,
} from '../../engine/outs';
import type { Rng } from '../../engine/rng';
import type { Card } from '../../engine/types';
import { cardOf, range, until } from './common';

export type DrawKind = 'flush' | 'oesd' | 'gutshot' | 'combo-oesd' | 'combo-gutshot';
export type Street = 'flop' | 'turn';

/** A dealt draw. Outs always come from the pokersolver brute force. */
export interface Draw {
  kind: DrawKind;
  street: Street;
  hole: Card[];
  board: Card[];
  /** Every unseen card that makes a straight or a flush, from pokersolver. */
  outs: Card[];
  /** Unseen cards that complete the flush. */
  flushOuts: Card[];
  /** Unseen cards that complete the straight. */
  straightOuts: Card[];
  flushSuit?: string;
  /** The four ranks held for the straight draw, low to high. Not set for plain flush draws. */
  runRanks?: number[];
  /** Ranks that complete the straight. */
  completeRanks?: number[];
}

const VALUES = range(2, 14);
const SUIT_LIST = [...SUITS];

export function unseenCount(street: Street): number {
  return street === 'flop' ? 47 : 46;
}

/** Number of cards still to come: two on the flop, one on the turn. */
export function cardsToCome(street: Street): 1 | 2 {
  return street === 'flop' ? 2 : 1;
}

export function dealDraw(rng: Rng, kind: DrawKind, street: Street): Draw {
  return until(`draw ${kind}`, () => tryDraw(rng, kind, street));
}

function tryDraw(rng: Rng, kind: DrawKind, street: Street): Draw | null {
  const n = street === 'flop' ? 5 : 6;
  return kind === 'flush' ? tryFlush(rng, street, n) : tryStraight(rng, kind, street, n);
}

function tryFlush(rng: Rng, street: Street, n: number): Draw | null {
  const flushSuit = rng.pick(SUIT_LIST);
  const others = SUIT_LIST.filter((s) => s !== flushSuit);
  const values = rng.shuffle(VALUES).slice(0, n);
  const boardIdx = rng.shuffle(range(2, n - 1));

  // Either both hole cards and two board cards, or one hole card and three board cards.
  const twoHole = rng.next() < 0.5;
  const suited = twoHole ? [0, 1, ...boardIdx.slice(0, 2)] : [rng.int(0, 1), ...boardIdx.slice(0, 3)];
  const cards = values.map((v, i) => cardOf(v, suited.includes(i) ? flushSuit : rng.pick(others)));
  const hole = cards.slice(0, 2);
  const board = cards.slice(2);

  if (flushCompleters(hole, board).length !== 9 || straightCompleters(hole, board).length !== 0) return null;
  const outs = straightFlushOuts(hole, board);
  if (outs.length !== 9 || !outs.every((c) => suitOf(c) === flushSuit)) return null;
  return { kind: 'flush', street, hole, board, outs, flushOuts: outs, straightOuts: [], flushSuit };
}

/** Four ranks held and the ranks that complete them. */
function straightShape(rng: Rng, open: boolean): { held: number[]; complete: number[] } {
  if (open) {
    const low = rng.int(3, 10); // runs from 3456 to TJQK, so both ends exist
    return { held: range(low, low + 3), complete: [low - 1, low + 4] };
  }
  const start = rng.int(2, 10);
  const missing = start + rng.int(1, 3); // the gap is inside the five ranks
  return { held: range(start, start + 4).filter((v) => v !== missing), complete: [missing] };
}

function tryStraight(rng: Rng, kind: DrawKind, street: Street, n: number): Draw | null {
  const open = kind === 'oesd' || kind === 'combo-oesd';
  const combo = kind === 'combo-oesd' || kind === 'combo-gutshot';
  const shape = straightShape(rng, open);

  // Four held ranks plus distinct filler ranks, split into two hole cards and the board.
  const fillers = rng.shuffle(VALUES.filter((v) => !shape.held.includes(v))).slice(0, n - 4);
  const values = rng.shuffle([...shape.held, ...fillers]);
  if (!values.slice(0, 2).some((v) => shape.held.includes(v))) return null; // needs a hole card in the run

  let suits: string[];
  let flushSuit: string | undefined;
  if (combo) {
    flushSuit = rng.pick(SUIT_LIST);
    const others = SUIT_LIST.filter((s) => s !== flushSuit);
    const suited = rng.shuffle(range(0, n - 1)).slice(0, 4);
    if (!suited.some((i) => i < 2)) return null; // the flush draw needs a hole card too
    suits = values.map((_, i) => (suited.includes(i) ? (flushSuit as string) : rng.pick(others)));
  } else {
    suits = values.map(() => rng.pick(SUIT_LIST));
  }

  const cards = values.map((v, i) => cardOf(v, suits[i] as string));
  const hole = cards.slice(0, 2);
  const board = cards.slice(2);

  const flushOuts = flushCompleters(hole, board);
  const straightOuts = straightCompleters(hole, board);
  const wantStraight = open ? 8 : 4;
  if (straightOuts.length !== wantStraight) return null;
  if (!straightOuts.every((c) => shape.complete.includes(rankValue(c)))) return null;
  if (flushOuts.length !== (combo ? 9 : 0)) return null;

  // The total also rules out a hand that already holds a flush or a straight, which has no outs.
  const total = quickStraightFlushOuts(hole, board).length;
  if (total !== (combo ? (open ? 15 : 12) : open ? 8 : 4)) return null;

  const outs = straightFlushOuts(hole, board);
  if (outs.length !== total) return null;
  const draw: Draw = {
    kind,
    street,
    hole,
    board,
    outs,
    flushOuts,
    straightOuts,
    runRanks: [...shape.held].sort((a, b) => a - b),
    completeRanks: shape.complete,
  };
  if (flushSuit) draw.flushSuit = flushSuit;
  return draw;
}
