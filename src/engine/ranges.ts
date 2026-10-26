// Starting-hand classes and the range notation used by the content files.
// Pure TypeScript, no DOM. A class is a pair ('77'), suited ('AKs') or offsuit ('AKo').

import { RANKS, SUITS } from './cards';
import type { Rng } from './rng';
import type { Card } from './types';

/** Ranks from the ace down: the order of rows and columns in the 13 by 13 grid. */
export const GRID_RANKS = 'AKQJT98765432';

const rankIndex = (r: string): number => RANKS.indexOf(r);

/**
 * All 169 classes in grid order: row by row from the ace, each row from the ace across.
 * Pairs sit on the diagonal, suited hands above it and offsuit hands below it.
 */
export const HAND_CLASSES: readonly string[] = (() => {
  const out: string[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const a = GRID_RANKS[row] as string;
      const b = GRID_RANKS[col] as string;
      if (row === col) out.push(a + b);
      else if (row < col) out.push(`${a}${b}s`);
      else out.push(`${b}${a}o`);
    }
  }
  return out;
})();

const CLASS_SET = new Set(HAND_CLASSES);

export function isHandClass(text: string): boolean {
  return CLASS_SET.has(text);
}

export type ClassKind = 'pair' | 'suited' | 'offsuit';

export function kindOf(cls: string): ClassKind {
  if (!CLASS_SET.has(cls)) throw new Error(`Bad hand class: ${cls}`);
  if (cls.length === 2) return 'pair';
  return cls[2] === 's' ? 'suited' : 'offsuit';
}

/** How many two-card combinations a class has: 6 for a pair, 4 suited, 12 offsuit. */
export function combos(cls: string): number {
  const kind = kindOf(cls);
  return kind === 'pair' ? 6 : kind === 'suited' ? 4 : 12;
}

export function totalCombos(classes: Iterable<string>): number {
  let n = 0;
  for (const c of classes) n += combos(c);
  return n;
}

/** Row and column (0 to 12) of a class in the grid. */
export function gridCell(cls: string): { row: number; col: number } {
  const kind = kindOf(cls);
  const a = GRID_RANKS.indexOf(cls[0] as string);
  const b = GRID_RANKS.indexOf(cls[1] as string);
  if (kind === 'pair') return { row: a, col: a };
  return kind === 'suited' ? { row: a, col: b } : { row: b, col: a };
}

/** The class of two cards, for example ['As', 'Kd'] gives 'AKo'. */
export function classOfCards(cards: readonly Card[]): string {
  if (cards.length !== 2) throw new Error('A hand has two cards');
  const [a, b] = cards as [Card, Card];
  const ra = rankIndex(a[0] as string);
  const rb = rankIndex(b[0] as string);
  if (ra < 0 || rb < 0 || !SUITS.includes(a[1] as string) || !SUITS.includes(b[1] as string)) {
    throw new Error(`Bad cards: ${a} ${b}`);
  }
  if (a === b) throw new Error('A hand needs two different cards');
  const [hi, lo] = ra >= rb ? [a, b] : [b, a];
  if (ra === rb) return (hi[0] as string) + (lo[0] as string);
  return (hi[0] as string) + (lo[0] as string) + (a[1] === b[1] ? 's' : 'o');
}

/** Two real cards for a class, with suits picked by the generator. The higher card comes first. */
export function dealHand(rng: Rng, cls: string): [Card, Card] {
  const kind = kindOf(cls);
  const hi = cls[0] as string;
  const lo = cls[1] as string;
  if (kind === 'suited') {
    const s = rng.pick([...SUITS]);
    return [hi + s, lo + s];
  }
  const [s1, s2] = rng.shuffle([...SUITS]) as [string, string];
  return [hi + s1, lo + s2];
}

/** A class picked with the chance of a random two-card deal: weighted by combinations. */
export function pickByCombos(rng: Rng, classes: readonly string[] = HAND_CLASSES): string {
  const total = totalCombos(classes);
  let roll = rng.int(1, total);
  for (const c of classes) {
    roll -= combos(c);
    if (roll <= 0) return c;
  }
  return classes[classes.length - 1] as string;
}

// ---- notation ----

const TOKEN = /^([2-9TJQKA])([2-9TJQKA])([so])?(\+)?$/;
const RUN = /^([2-9TJQKA])([2-9TJQKA])([so])?-([2-9TJQKA])([2-9TJQKA])([so])?$/;

function suffixes(kind: string | undefined): string[] {
  return kind === undefined ? ['s', 'o'] : [kind];
}

function addAll(out: Set<string>, hi: string, lo: string, kind: string | undefined): void {
  for (const k of suffixes(kind)) out.add(`${hi}${lo}${k}`);
}

function expandSingle(token: string, out: Set<string>): void {
  const m = TOKEN.exec(token);
  if (!m) throw new Error(`Unknown range token: "${token}"`);
  const [, a, b, kind, plus] = m as unknown as [string, string, string, string | undefined, string | undefined];
  const ia = rankIndex(a);
  const ib = rankIndex(b);
  if (ia === ib) {
    if (kind !== undefined) throw new Error(`A pair has no suit letter: "${token}"`);
    for (let i = ia; i <= (plus ? 12 : ia); i++) out.add((RANKS[i] as string).repeat(2));
    return;
  }
  if (ia < ib) throw new Error(`Write the higher card first: "${token}"`);
  if (plus) {
    for (let i = ib; i < ia; i++) addAll(out, a, RANKS[i] as string, kind);
  } else {
    addAll(out, a, b, kind);
  }
}

function expandRun(token: string, out: Set<string>): void {
  const m = RUN.exec(token);
  if (!m) throw new Error(`Unknown range token: "${token}"`);
  const [, a1, b1, k1, a2, b2, k2] = m as unknown as [string, string, string, string | undefined, string, string, string | undefined];
  if (k1 !== k2) throw new Error(`Both ends of a run need the same suit letter: "${token}"`);
  const [i1, j1, i2, j2] = [rankIndex(a1), rankIndex(b1), rankIndex(a2), rankIndex(b2)] as [number, number, number, number];
  const bothPairs = i1 === j1 && i2 === j2;
  if (bothPairs) {
    if (k1 !== undefined) throw new Error(`A pair has no suit letter: "${token}"`);
    for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) out.add((RANKS[i] as string).repeat(2));
    return;
  }
  if (i1 === j1 || i2 === j2 || i1 < j1 || i2 < j2) throw new Error(`Write the higher card first in a run: "${token}"`);
  if (i1 === i2) {
    // Same top card, a run of kickers: A2s-A5s.
    for (let j = Math.min(j1, j2); j <= Math.max(j1, j2); j++) addAll(out, a1, RANKS[j] as string, k1);
    return;
  }
  if (i1 - j1 !== i2 - j2) throw new Error(`The two ends of a run need the same gap: "${token}"`);
  // Same gap, a run of tops: T9s-54s.
  const gap = i1 - j1;
  for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) addAll(out, RANKS[i] as string, RANKS[i - gap] as string, k1);
}

/** The hand classes of one token. Throws on anything it does not understand. */
export function expandToken(token: string): string[] {
  const t = token.trim();
  const out = new Set<string>();
  if (t.includes('-')) expandRun(t, out);
  else expandSingle(t, out);
  return sortClasses([...out]);
}

/** Expand a comma separated range such as "77+, AJs+, KQs, AQo+". An empty string is an empty range. */
export function parseRange(text: string): Set<string> {
  const out = new Set<string>();
  if (text.trim() === '') return out;
  for (const token of text.split(',')) {
    for (const c of expandToken(token)) out.add(c);
  }
  return out;
}

/** True when the text parses. */
export function isValidRange(text: string): boolean {
  try {
    parseRange(text);
    return true;
  } catch {
    return false;
  }
}

const GRID_INDEX = new Map(HAND_CLASSES.map((c, i) => [c, i]));

export function sortClasses(classes: readonly string[]): string[] {
  return [...classes].sort((a, b) => (GRID_INDEX.get(a) as number) - (GRID_INDEX.get(b) as number));
}

// ---- a fixed strength order ----

/** Chen formula points. Only used to put the 169 classes in a fixed order for sampling, never to grade. */
function chenScore(cls: string): number {
  const hi = rankIndex(cls[0] as string) + 2;
  const lo = rankIndex(cls[1] as string) + 2;
  const points = (v: number): number => ({ 14: 10, 13: 8, 12: 7, 11: 6 }[v] ?? v / 2);
  if (hi === lo) return Math.max(points(hi) * 2, 5);
  let score = points(hi);
  if (cls[2] === 's') score += 2;
  const gap = hi - lo - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 12) score += 1;
  return Math.ceil(score);
}

/** All 169 classes from strongest to weakest by a fixed rule (Chen points, then high card, low card, suited first). */
export const STRENGTH_ORDER: readonly string[] = [...HAND_CLASSES].sort((a, b) => {
  const d = chenScore(b) - chenScore(a);
  if (d !== 0) return d;
  const hi = rankIndex(b[0] as string) - rankIndex(a[0] as string);
  if (hi !== 0) return hi;
  const lo = rankIndex(b[1] as string) - rankIndex(a[1] as string);
  if (lo !== 0) return lo;
  return (a[2] === 's' ? 0 : 1) - (b[2] === 's' ? 0 : 1);
});

const STRENGTH_INDEX = new Map(STRENGTH_ORDER.map((c, i) => [c, i]));

/** 0 is the strongest class (AA). */
export function strengthIndex(cls: string): number {
  const i = STRENGTH_INDEX.get(cls);
  if (i === undefined) throw new Error(`Bad hand class: ${cls}`);
  return i;
}

/**
 * The classes near the edge of a range in the strength order: those within `radius` places of the weakest member.
 * They are the hands a player is most likely to get wrong, so generators sample them often.
 */
export function nearEdge(members: ReadonlySet<string>, radius: number): string[] {
  if (members.size === 0) return [];
  let weakest = 0;
  for (const c of members) weakest = Math.max(weakest, strengthIndex(c));
  const from = Math.max(0, weakest - radius);
  return STRENGTH_ORDER.slice(from, weakest + radius + 1);
}
