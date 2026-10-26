// Shared parts of the Area A skills (hands by seat). Every range, reason and source is read from the house chart.

import { lookupFor, type Lookup, type SpotShape } from '../../content/chart';
import { sourceLines } from '../../content';
import { ACTION_LABELS, type Action, type HouseChart, type Situation, type SituationId } from '../../content/types';
import { classOfCards, HAND_CLASSES, kindOf, nearEdge, pickByCombos, STRENGTH_ORDER } from '../../engine/ranges';
import type { Rng } from '../../engine/rng';
import { seatNames, seatsBefore } from '../../engine/seats';
import type { Card, RangeGridView, RingSeat, SeatRing, SituationBlock } from '../../engine/types';

export const AREA_A_READING = [
  { label: 'PokerCoaching preflop charts', url: 'https://pokercoaching.com/preflop-charts' },
  { label: 'EV Poker starting-hand ranges', url: 'https://www.evpoker.org/tips/starting-hands-range.html' },
];

export function actionLabel(action: Action): string {
  return ACTION_LABELS[action];
}

/** 'Raise', 'Raise or fold', 'Raise, call or fold'. */
export function labelList(actions: readonly Action[]): string {
  const words = actions.map((a, i) => (i === 0 ? ACTION_LABELS[a] : ACTION_LABELS[a].toLowerCase()));
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

const KIND_WORDS = { pair: 'a pair', suited: 'suited', offsuit: 'offsuit' } as const;
const RANK_WORD: Record<string, string> = {
  A: 'ace',
  K: 'king',
  Q: 'queen',
  J: 'jack',
  T: 'ten',
  '9': 'nine',
  '8': 'eight',
  '7': 'seven',
  '6': 'six',
  '5': 'five',
  '4': 'four',
  '3': 'three',
  '2': 'two',
};
const RANK_PLURAL: Record<string, string> = {
  A: 'aces',
  K: 'kings',
  Q: 'queens',
  J: 'jacks',
  T: 'tens',
  '9': 'nines',
  '8': 'eights',
  '7': 'sevens',
  '6': 'sixes',
  '5': 'fives',
  '4': 'fours',
  '3': 'threes',
  '2': 'twos',
};

/** 'AKs' as 'ace king suited', '77' as 'a pair of sevens'. */
export function classWords(cls: string): string {
  const kind = kindOf(cls);
  if (kind === 'pair') return `a pair of ${RANK_PLURAL[cls[0] as string]}`;
  return `${RANK_WORD[cls[0] as string]} ${RANK_WORD[cls[1] as string]} ${KIND_WORDS[kind]}`;
}

/** The two cards as the class name: 'AKs' for A♠ K♠. */
export function classOf(hole: readonly Card[]): string {
  return classOfCards(hole);
}

// ---- sampling ----

const edgeCache = new WeakMap<Lookup, string[]>();

/** Hands near the edge of any listed range, and every borderline hand. Falls back to all 169 when nothing is listed. */
export function edgeHands(lookup: Lookup): string[] {
  const cached = edgeCache.get(lookup);
  if (cached) return cached;
  const set = new Set<string>();
  for (const members of lookup.buckets.values()) for (const c of nearEdge(members, EDGE_RADIUS)) set.add(c);
  for (const e of lookup.either) for (const c of e.hands) set.add(c);
  const out = set.size > 0 ? STRENGTH_ORDER.filter((c) => set.has(c)) : [...HAND_CLASSES];
  edgeCache.set(lookup, out);
  return out;
}

/** How many places either side of a range's weakest hand count as near the edge. */
export const EDGE_RADIUS = 10;
/** The share of questions drawn from near the edge of a range. */
export const EDGE_SHARE = 0.6;

/** About 60% near the boundary of the chart, the rest across all 169 classes weighted by combinations. */
export function pickHandClass(rng: Rng, lookup: Lookup): string {
  if (rng.next() < EDGE_SHARE) return rng.pick(edgeHands(lookup));
  return pickByCombos(rng);
}

// ---- the picture ----

export interface SpotSeats {
  players: number;
  hero: string;
  limpers: string[];
  raiser?: string;
  /** The size of the raise in chips, when the question states one. Shown on the raiser's seat. */
  raiseTo?: number;
}

/** Pick one place where the situation comes up. */
export function pickSpot(rng: Rng, shapes: SpotShape[]): SpotSeats {
  const shape = rng.pick(shapes);
  const spot: SpotSeats = { players: shape.players, hero: shape.hero, limpers: [] };
  if (shape.limperPool.length > 0) {
    const n = rng.int(shape.minLimpers, shape.maxLimpers);
    const chosen = new Set(rng.shuffle(shape.limperPool).slice(0, n));
    spot.limpers = shape.limperPool.filter((s) => chosen.has(s));
  }
  if (shape.raisers.length > 0) spot.raiser = rng.pick(shape.raisers);
  return spot;
}

/** The ring for a spot: you, the limpers and the raiser marked, seats that already folded dimmed. */
export function spotRing(spot: SpotSeats): SeatRing {
  const names = seatNames(spot.players);
  const before = new Set(seatsBefore(spot.hero, spot.players));
  const seats: RingSeat[] = names.map((name) => {
    const seat: RingSeat = { name };
    if (name === 'BTN') seat.button = true;
    if (name === spot.hero) {
      seat.role = 'you';
      seat.tag = 'You';
    } else if (name === spot.raiser) {
      seat.role = 'raise';
      // The red seat is the raiser. With a size the label is the size, which keeps the seat narrow.
      seat.tag = spot.raiseTo === undefined ? 'Raise' : `${spot.raiseTo} chips`;
    } else if (spot.limpers.includes(name)) {
      seat.role = 'limp';
      seat.tag = 'Limp';
    } else if (before.has(name) || (spot.raiser !== undefined && spot.hero === 'BB' && name !== 'BB')) {
      seat.role = 'fold';
    }
    return seat;
  });
  return { seats, focus: names.indexOf(spot.hero) };
}

/** A ring with every name hidden except the button, and one seat highlighted. */
export function hiddenRing(players: number, focusSeat: string): SeatRing {
  const names = seatNames(players);
  const seats: RingSeat[] = names.map((name) => ({
    name: null,
    ...(name === 'BTN' ? { button: true } : {}),
    ...(name === focusSeat ? { role: 'focus' as const } : {}),
  }));
  return { seats, focus: names.indexOf(focusSeat) };
}

/** A ring with every name shown and one seat highlighted. */
export function namedRing(players: number, focusSeat: string, role: RingSeat['role'] = 'focus'): SeatRing {
  const names = seatNames(players);
  const seats: RingSeat[] = names.map((name) => ({
    name,
    ...(name === 'BTN' ? { button: true } : {}),
    ...(name === focusSeat ? { role } : {}),
  }));
  return { seats, focus: names.indexOf(focusSeat) };
}

// ---- the chart picture ----

/** The 13 by 13 grid for a situation. One action per class, borderline classes flagged. */
export function buildRangeGrid(chart: HouseChart, id: SituationId, yours?: string): RangeGridView {
  const situation = chart.situations[id];
  const lookup = lookupFor(situation);
  const cells: RangeGridView['cells'] = {};
  for (const cls of HAND_CLASSES) {
    const v = lookup.verdict(cls);
    cells[cls] = { action: v.primary, borderline: v.borderline };
  }
  return {
    title: situation.title,
    cells,
    legend: situation.choices.map((a) => ({ action: a, label: ACTION_LABELS[a] })),
    ...(yours ? { yours } : {}),
  };
}

/** Where the advice comes from, as lines of text. */
export function chartSources(chart: HouseChart, ids: readonly SituationId[]): string[] {
  const cited = new Set<string>();
  for (const id of ids) for (const s of chart.situations[id].sources) cited.add(s);
  return sourceLines(chart.sources, [...cited]);
}

// ---- explainer text, read from the chart ----

/** '7 to 9 players' or '6 players'. */
function playersText(range: readonly [number, number]): string {
  return range[0] === range[1] ? `${range[0]} players` : `${range[0]} to ${range[1]} players`;
}

/** A range string is printed in an explainer only when all the ranges of its situation add up to about this many characters. */
export const SHORT_RANGE_CHARS = 60;

/** The characters in every range string of a situation: its action ranges and its either hands. */
export function rangeLength(s: Situation): number {
  let n = 0;
  for (const action of s.choices) n += (s.ranges[action] ?? '').trim().length;
  for (const e of s.either ?? []) n += e.hands.trim().length;
  return n;
}

/**
 * One situation's ranges as sentences, read from the file:
 * 'Raise: 77+. Either is fine for 66 (Raise or fold). Every other hand: Fold.'
 */
export function rangeText(s: Situation): string {
  const parts: string[] = [];
  for (const action of s.choices) {
    const range = s.ranges[action];
    if (range !== undefined && range.trim() !== '') parts.push(`${ACTION_LABELS[action]}: ${range}.`);
  }
  for (const e of s.either ?? []) parts.push(`Either is fine for ${e.hands} (${labelList(e.accept)}).`);
  parts.push(`Every other hand: ${ACTION_LABELS[s.default]}.`);
  return parts.join(' ');
}

/**
 * One situation for an explainer: its title, where it applies, its reason and its 13 by 13 chart. The range string
 * is added only when it is short. Long ones (a small blind facing limpers runs to hundreds of characters) are left
 * to the grid.
 */
export function situationBlock(chart: HouseChart, id: SituationId): SituationBlock {
  const s = chart.situations[id];
  return {
    title: s.title,
    where: `${s.seats.join(', ')} at ${playersText(s.players)}`,
    reason: s.reason,
    ...(rangeLength(s) <= SHORT_RANGE_CHARS ? { range: rangeText(s) } : {}),
    grid: buildRangeGrid(chart, id),
  };
}

export const NOTATION_PARAGRAPH =
  'Hands are written by class. AKs is ace king suited, AKo is ace king offsuit, and TT is a pair. 77+ means 77 and every higher pair. ATs+ means ATs, AJs, AQs and AKs.';

export const GRID_PARAGRAPH =
  'Each chart is a 13 by 13 grid. Pairs run down the middle, suited hands sit above it and offsuit hands below. A dot in a corner marks a borderline hand. After you answer, the chart appears again with your hand outlined.';
