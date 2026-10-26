// Flop texture for continuation bet sizing. Only clear cases get a label: everything in between is 'neither'.

import { rankValue, suitOf } from './cards';
import type { Card } from './types';

export type Texture = 'dry' | 'wet' | 'neither';

/** Rank values of the board, with the ace counted high. */
function ranksOf(board: readonly Card[]): number[] {
  return board.map(rankValue);
}

export function isPaired(board: readonly Card[]): boolean {
  const r = ranksOf(board);
  return new Set(r).size !== r.length;
}

/** The most cards of one suit on the board. */
export function maxSuitCount(board: readonly Card[]): number {
  const counts = new Map<string, number>();
  for (const c of board) counts.set(suitOf(c), (counts.get(suitOf(c)) ?? 0) + 1);
  return Math.max(...counts.values());
}

/** How far apart two ranks are, counting the ace as high or low, whichever is closer. */
function gap(a: number, b: number): number {
  const direct = Math.abs(a - b);
  if (a === 14) return Math.min(direct, Math.abs(1 - b));
  if (b === 14) return Math.min(direct, Math.abs(1 - a));
  return direct;
}

/** The smallest gap between any two board cards. */
export function closestGap(board: readonly Card[]): number {
  const r = ranksOf(board);
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    for (let j = i + 1; j < r.length; j++) best = Math.min(best, gap(r[i] as number, r[j] as number));
  }
  return best;
}

/** True when all board cards fit inside five consecutive ranks, the ace counting high or low. */
export function fitsFiveRanks(board: readonly Card[]): boolean {
  const high = ranksOf(board);
  const low = high.map((v) => (v === 14 ? 1 : v));
  const span = (r: number[]) => Math.max(...r) - Math.min(...r);
  return Math.min(span(high), span(low)) <= 4;
}

/**
 * Dry: three different suits, no pair, and no two cards within two ranks of each other (K 7 2 of three suits).
 * Wet: two or more cards of one suit, no pair, and all three inside five consecutive ranks (J T 8 with two hearts).
 */
export function classifyFlop(board: readonly Card[]): Texture {
  if (board.length !== 3) throw new Error('A flop has three cards');
  if (isPaired(board)) return 'neither';
  if (maxSuitCount(board) === 1 && closestGap(board) >= 3) return 'dry';
  if (maxSuitCount(board) >= 2 && fitsFiveRanks(board)) return 'wet';
  return 'neither';
}

/** A plain-words reason for the label, for feedback. */
export function textureReason(texture: Texture): string {
  if (texture === 'dry') return 'The flop is dry: three different suits and no cards close in rank.';
  if (texture === 'wet') return 'The flop is wet: two cards of one suit, and cards close in rank.';
  return 'The flop is neither clearly dry nor clearly wet.';
}
