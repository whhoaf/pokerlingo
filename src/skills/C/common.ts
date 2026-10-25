import { cardText, deal, rankValue } from '../../engine/cards';
import { compareSolved, describeSolved, solve, type Evaluated } from '../../engine/handEval';
import type { Rng } from '../../engine/rng';
import type { Answer, Card, GradeResult, Question, TableView } from '../../engine/types';
import { choiceOf, rankWord, rankWordPlural, until } from '../B/common';

export const AREA_C_READING = [
  { label: 'PokerRift trainer (hand ranks drill)', url: 'https://pokerrift.com/learn-poker/' },
  { label: 'Upswing hand rankings', url: 'https://upswingpoker.com/poker-hands-rankings' },
];

/** Hand categories 1 to 9, as written on screen. */
export const HAND_LABELS = [
  'High card',
  'One pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
];

/** The same categories for the middle of a sentence. */
const CATEGORY_NOUNS = [
  'high card',
  'pair',
  'two pair',
  'three of a kind',
  'straight',
  'flush',
  'full house',
  'four of a kind',
  'straight flush',
];

export function handLabel(category: number): string {
  return HAND_LABELS[category - 1] ?? 'Unknown';
}

export function cardsText(cards: readonly Card[]): string {
  return cards.map(cardText).join(' ');
}

/**
 * The ranks that decide a hand, strongest first: the groups that make the hand
 * (by size, then rank) followed by the kickers. A straight is just its top card.
 * Comparing two hands of one category means comparing these lists in order.
 */
export function signature(hand: Evaluated): number[] {
  const values = hand.cards.map(rankValue);
  if (hand.category === 5 || hand.category === 9) {
    const wheel = values.includes(14) && values.includes(5) && values.includes(2);
    return [wheel ? 5 : Math.max(...values)];
  }
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([v]) => v);
}

/** 1 if a is the stronger hand, -1 if b is, 0 if they tie. Worked out from the signatures alone. */
export function compareBySignature(a: Evaluated, b: Evaluated): -1 | 0 | 1 {
  if (a.category !== b.category) return a.category > b.category ? 1 : -1;
  const sa = signature(a);
  const sb = signature(b);
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if (sa[i] !== sb[i]) return (sa[i] ?? 0) > (sb[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

/** A hand in words, for example 'Two pair, kings and sevens'. */
export function handText(hand: Evaluated): string {
  const g = signature(hand);
  const top = g[0] as number;
  const second = g[1] as number;
  switch (hand.category) {
    case 1:
      return `${capital(rankWord(top))} high`;
    case 2:
      return `Pair of ${rankWordPlural(top)}`;
    case 3:
      return `Two pair, ${rankWordPlural(top)} and ${rankWordPlural(second)}`;
    case 4:
      return `Three ${rankWordPlural(top)}`;
    case 5:
      return `Straight, ${rankWord(top)} high`;
    case 6:
      return `Flush, ${rankWord(top)} high`;
    case 7:
      return `Full house, ${rankWordPlural(top)} over ${rankWordPlural(second)}`;
    case 8:
      return `Four ${rankWordPlural(top)}`;
    default:
      return top === 14 ? 'Royal flush' : `Straight flush, ${rankWord(top)} high`;
  }
}

/** The same hand for the middle of a sentence: 'a pair of kings', 'three nines', 'ace high'. */
export function handPhrase(hand: Evaluated): string {
  const text = handText(hand).toLowerCase();
  return [2, 5, 6, 7, 9].includes(hand.category) ? `a ${text}` : text;
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// What each position in a signature means, per category. Anything past the list is a kicker,
// except in a high card hand or a flush, where every position is just a card.
const ROLES: Record<number, string[]> = {
  2: ['pair'],
  3: ['top pair', 'second pair'],
  4: ['three'],
  5: ['straight'],
  7: ['three', 'pair'],
  8: ['four'],
  9: ['straight'],
};

function roleAt(category: number, index: number): string {
  const named = ROLES[category]?.[index];
  if (named) return named;
  return category === 1 || category === 6 ? 'card' : 'kicker';
}

/** One line on why the stronger hand wins. `youWin` says whose hand is the winner. */
export function differenceText(winner: Evaluated, loser: Evaluated, youWin: boolean): string {
  const [who, other] = youWin ? ['Your', 'their'] : ['Their', 'your'];
  if (winner.category !== loser.category) {
    return `${who} ${CATEGORY_NOUNS[winner.category - 1]} beats ${other} ${CATEGORY_NOUNS[loser.category - 1]}.`;
  }
  const a = signature(winner);
  const b = signature(loser);
  const i = a.findIndex((v, k) => v !== b[k]);
  const x = a[i] as number;
  const y = b[i] as number;
  switch (roleAt(winner.category, i)) {
    case 'pair':
      return `${who} pair of ${rankWordPlural(x)} beats ${other} pair of ${rankWordPlural(y)}.`;
    case 'top pair':
      return `${who} top pair of ${rankWordPlural(x)} beats ${other} top pair of ${rankWordPlural(y)}.`;
    case 'second pair':
      return `The top pairs match, but ${who.toLowerCase()} second pair of ${rankWordPlural(x)} beats ${other} second pair of ${rankWordPlural(y)}.`;
    case 'three':
      return `${who} three ${rankWordPlural(x)} beat ${other} three ${rankWordPlural(y)}.`;
    case 'four':
      return `${who} four ${rankWordPlural(x)} beat ${other} four ${rankWordPlural(y)}.`;
    case 'straight':
      return `${who} ${rankWord(x)}-high ${handLabel(winner.category).toLowerCase()} beats ${other} ${rankWord(y)}-high one.`;
    case 'card':
      return `The highest card that differs decides: ${who.toLowerCase()} ${rankWord(x)} beats ${other} ${rankWord(y)}.`;
    default:
      return `The made hands are equal, so the kicker decides: ${who.toLowerCase()} ${rankWord(x)} beats ${other} ${rankWord(y)}.`;
  }
}

/** One line on why a showdown is split. */
export function tieText(hand: Evaluated, board: readonly Card[]): string {
  if (hand.cards.every((c) => board.includes(c))) {
    return 'The best five cards for both of you are the five on the board, so the pot is split.';
  }
  return 'Both hands make the same five ranks, so the pot is split.';
}

export type Outcome = 'you' | 'opp' | 'split';

export const SHOWDOWN_OPTIONS: { id: Outcome; label: string }[] = [
  { id: 'you', label: 'You win' },
  { id: 'opp', label: 'Opponent wins' },
  { id: 'split', label: 'Split' },
];

export interface Showdown {
  hole: Card[];
  villain: Card[];
  board: Card[];
  you: Evaluated;
  opp: Evaluated;
  outcome: Outcome;
}

/** Plays out a showdown with pokersolver. */
export function showdown(hole: Card[], villain: Card[], board: Card[]): Showdown {
  const mine = solve([...hole, ...board]);
  const theirs = solve([...villain, ...board]);
  const cmp = compareSolved(mine, theirs);
  return {
    hole,
    villain,
    board,
    you: describeSolved(mine),
    opp: describeSolved(theirs),
    outcome: cmp === 1 ? 'you' : cmp === -1 ? 'opp' : 'split',
  };
}

/** Deals two hands and a five-card board until the showdown passes `accept`. */
export function dealShowdown(rng: Rng, label: string, accept: (sd: Showdown) => boolean): Showdown {
  return until(
    label,
    () => {
      const cards = deal(rng, 9);
      const sd = showdown(cards.slice(0, 2), cards.slice(2, 4), cards.slice(4));
      return accept(sd) ? sd : null;
    },
    20000,
  );
}

/** The sentence that says why a showdown ended the way it did. */
export function showdownReason(sd: Showdown): string {
  if (sd.outcome === 'you') return differenceText(sd.you, sd.opp, true);
  if (sd.outcome === 'opp') return differenceText(sd.opp, sd.you, false);
  return tieText(sd.you, sd.board);
}

export function showdownWorking(sd: Showdown): string[] {
  return [
    `You: ${handText(sd.you)} (${cardsText(sd.you.cards)})`,
    `Opponent: ${handText(sd.opp)} (${cardsText(sd.opp.cards)})`,
  ];
}

export interface ShowdownSpec {
  skillId: string;
  seed: number;
  prompt: string;
  table: TableView;
  sd: Showdown;
  /** Lines added before the two hands. */
  extraWorking?: string[];
  /** Replaces the usual reason. */
  reason?: string;
  /** Replaces the usual picture, which is the winning five cards. */
  highlight?: { cards: Card[]; label: string };
}

/** A question whose choices are You win, Opponent wins and Split, graded from a pokersolver showdown. */
export function showdownQuestion(spec: ShowdownSpec): Question {
  const { sd } = spec;
  const correctLabel = SHOWDOWN_OPTIONS.find((o) => o.id === sd.outcome)!.label;
  return {
    skillId: spec.skillId,
    seed: spec.seed,
    prompt: spec.prompt,
    table: spec.table,
    input: { kind: 'choice', options: SHOWDOWN_OPTIONS.map((o) => ({ ...o })) },
    grade(answer: Answer): GradeResult {
      return {
        correct: choiceOf(answer) === sd.outcome,
        correctLabel,
        reason: spec.reason ?? showdownReason(sd),
        working: [...(spec.extraWorking ?? []), ...showdownWorking(sd)],
        highlight: spec.highlight?.cards ?? (sd.outcome === 'opp' ? sd.opp.cards : sd.you.cards),
        highlightLabel:
          spec.highlight?.label ??
          (sd.outcome === 'you' ? 'Your winning five' : sd.outcome === 'opp' ? 'Their winning five' : 'The five you both play'),
      };
    },
  };
}
