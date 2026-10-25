import { deal, rankValue, sortByRank, suitOf } from '../../engine/cards';
import { boardThreats, quickThreats, type Holding } from '../../engine/nuts';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { choiceOf, rngFor, until } from '../B/common';
import { AREA_C_READING, cardsText } from './common';

export type ThreatKind = 'flush' | 'straight' | 'both' | 'neither';

const OPTIONS: { id: ThreatKind; label: string }[] = [
  { id: 'flush', label: 'Flush possible' },
  { id: 'straight', label: 'Straight possible' },
  { id: 'both', label: 'Both' },
  { id: 'neither', label: 'Neither' },
];

const STREETS = [
  { cards: 3, name: 'Flop' },
  { cards: 4, name: 'Turn' },
  { cards: 5, name: 'River' },
] as const;

const PROMPT = 'With the right two cards, what could an opponent make? Choose Both if a flush and a straight are each possible.';

function kindOf(flush: boolean, straight: boolean): ThreatKind {
  if (flush && straight) return 'both';
  return flush ? 'flush' : straight ? 'straight' : 'neither';
}

/** The board cards of a suit that has three or more of them. */
function flushCards(board: readonly Card[]): Card[] {
  for (const suit of 'shdc') {
    const same = board.filter((c) => suitOf(c) === suit);
    if (same.length >= 3) return same;
  }
  return [];
}

/** The board cards in the run of five that holds the most board ranks. */
function straightCards(board: readonly Card[]): Card[] {
  let best: Card[] = [];
  for (let low = 1; low <= 10; low++) {
    const inRun = board.filter((c) => {
      const v = rankValue(c);
      return (v >= low && v < low + 5) || (v === 14 && low === 1);
    });
    if (inRun.length > best.length) best = inRun;
  }
  return best.length >= 3 ? best : [];
}

/** An example holding, preferring one that makes this hand and not the other. */
function example(wanted: Holding[], other: Holding[]): Holding | undefined {
  const otherKeys = new Set(other.map((h) => h.join('')));
  const found = wanted.find((h) => !otherKeys.has(h.join(''))) ?? wanted[0];
  return found && (sortByRank(found) as Holding);
}

export interface BoardAnalysis {
  kind: ThreatKind;
  label: string;
  reason: string;
  working: string[];
  highlight: Card[];
}

/** The answer for a board, from trying every possible two-card holding. */
export function analyseBoard(board: readonly Card[]): BoardAnalysis {
  const threats = boardThreats(board);
  const kind = kindOf(threats.flush.length > 0, threats.straight.length > 0);

  const working: string[] = [];
  if (threats.flush.length > 0) {
    working.push(`Flush: ${flushCards(board).length} cards of one suit are out. Any two more of that suit make five.`);
    const e = example(threats.flush, threats.straight);
    if (e) working.push(`For example ${cardsText(e)}`);
  } else {
    working.push('Flush: no suit has three cards on the board, so two cards cannot make five.');
  }
  if (threats.straight.length > 0) {
    working.push(`Straight: ${straightCards(board).length} board ranks sit inside one run of five. Two more cards can fill it.`);
    const e = example(threats.straight, threats.flush);
    if (e) working.push(`For example ${cardsText(e)}`);
  } else {
    working.push('Straight: no run of five holds three board ranks, so two cards cannot fill one.');
  }

  const highlight = [
    ...(kind === 'flush' || kind === 'both' ? flushCards(board) : []),
    ...(kind === 'straight' || kind === 'both' ? straightCards(board) : []),
  ];
  const reasons: Record<ThreatKind, string> = {
    flush: 'A flush is possible on this board, but a straight is not.',
    straight: 'A straight is possible on this board, but a flush is not.',
    both: 'Both a flush and a straight are possible on this board.',
    neither: 'No holding can make a flush or a straight on this board.',
  };
  return {
    kind,
    label: OPTIONS.find((o) => o.id === kind)!.label,
    reason: reasons[kind],
    working,
    highlight: [...new Set(highlight)],
  };
}

export const C5: SkillDef = {
  id: 'C5',
  area: 'C',
  title: 'Can a flush or straight be out there?',
  prereqs: ['C1'],
  generate(seed): Question {
    const rng = rngFor('C5', seed);
    const target = rng.pick(OPTIONS).id;
    const street = rng.pick(STREETS);

    // Boards have no pair, so a flush or straight is always the best hand it can make.
    // A quick board-only check finds a board of the wanted kind. The answer then comes from the full enumeration.
    const board = until(
      'C5',
      () => {
        const cards = deal(rng, street.cards);
        if (new Set(cards.map((c) => c[0])).size !== cards.length) return null;
        const quick = quickThreats(cards);
        return kindOf(quick.flush, quick.straight) === target ? cards : null;
      },
      50000,
    );
    const analysis = analyseBoard(board);

    return {
      skillId: 'C5',
      seed,
      prompt: PROMPT,
      table: { board, note: street.name },
      input: { kind: 'choice', options: OPTIONS.map((o) => ({ ...o })) },
      grade(given: Answer): GradeResult {
        return {
          correct: choiceOf(given) === analysis.kind,
          correctLabel: analysis.label,
          reason: analysis.reason,
          working: analysis.working,
          ...(analysis.highlight.length > 0
            ? { highlight: analysis.highlight, highlightLabel: 'Cards that make it possible' }
            : {}),
        };
      },
    };
  },
  explainer: {
    body: [
      'You hold two cards, so a flush needs three cards of one suit on the board. Two cards of that suit in your hand then make five.',
      'A straight needs three board ranks inside one run of five, such as 9, 8 and 6, or K, Q and 10. Two more cards fill the gaps. The ace counts high or low, so A, 2 and 3 can make a straight.',
      'Choose Flush possible or Straight possible when only that one can be made. Choose Both if the board allows either, and Neither if it allows neither.',
      'Boards in this skill have no pair, so a flush or a straight would be the best hand it can make.',
    ],
    example: {
      prompt: PROMPT,
      table: { board: ['9s', '8s', '2s', 'Kh'], note: 'Turn' },
      answer: 'Flush possible',
      working: [
        'Flush: 3 cards of one suit are out. Any two more of that suit make five.',
        'For example 4♠ 3♠',
        'Straight: no run of five holds three board ranks, so two cards cannot fill one.',
      ],
    },
  },
  furtherReading: AREA_C_READING,
};
