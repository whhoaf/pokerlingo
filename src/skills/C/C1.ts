import { SUITS, deal } from '../../engine/cards';
import { evaluate } from '../../engine/handEval';
import type { Rng } from '../../engine/rng';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { cardOf, choiceOf, rngFor, until } from '../B/common';
import { AREA_C_READING, HAND_LABELS, cardsText, handLabel, handPhrase } from './common';

/** How often each hand category is dealt, High card first. Rare hands get a small share so they still appear. */
const WEIGHTS = [2, 3, 3, 2, 2, 2, 2, 1, 1];

function pickCategory(rng: Rng): number {
  let roll = rng.int(1, WEIGHTS.reduce((a, b) => a + b, 0));
  for (let i = 0; i < WEIGHTS.length; i++) {
    roll -= WEIGHTS[i] as number;
    if (roll <= 0) return i + 1;
  }
  return 1;
}

/** Seven cards that start from a four of a kind or a straight flush, the rest dealt at random. */
function buildRare(rng: Rng, category: number): Card[] {
  const suits = [...SUITS];
  let core: Card[];
  if (category === 8) {
    const rank = rng.int(2, 14);
    core = suits.map((s) => cardOf(rank, s));
  } else {
    const suit = rng.pick(suits);
    const top = rng.int(5, 14); // a top of 5 is the wheel, A 2 3 4 5
    core = [0, 1, 2, 3, 4].map((i) => cardOf(top - i === 1 ? 14 : top - i, suit));
  }
  return [...core, ...deal(rng, 7 - core.length, core)];
}

/** Seven cards whose best hand is in the given category. */
function dealCategory(rng: Rng, category: number): { cards: Card[]; hand: ReturnType<typeof evaluate> } {
  return until(
    `C1 category ${category}`,
    () => {
      const cards = rng.shuffle(category >= 8 ? buildRare(rng, category) : deal(rng, 7));
      const hand = evaluate(cards);
      return hand.category === category ? { cards, hand } : null;
    },
    20000,
  );
}

/** The right category plus the three nearest others, in rank order. */
function optionCategories(rng: Rng, category: number): number[] {
  const others = rng
    .shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((c) => c !== category))
    .sort((a, b) => Math.abs(a - category) - Math.abs(b - category)) // stable: ties stay shuffled
    .slice(0, 3);
  return [category, ...others].sort((a, b) => a - b);
}

export const C1: SkillDef = {
  id: 'C1',
  area: 'C',
  title: 'Best five-card hand from seven cards',
  prereqs: [],
  generate(seed): Question {
    const rng = rngFor('C1', seed);
    const { cards, hand } = dealCategory(rng, pickCategory(rng));
    const hole = cards.slice(0, 2);
    const board = cards.slice(2);
    const options = optionCategories(rng, hand.category).map((c) => ({ id: `cat${c}`, label: handLabel(c) }));
    const correctId = `cat${hand.category}`;

    return {
      skillId: 'C1',
      seed,
      prompt: 'What is the best hand you can make?',
      table: { hole, board, note: 'River. All five board cards are out.' },
      input: { kind: 'choice', options },
      grade(answer: Answer): GradeResult {
        return {
          correct: choiceOf(answer) === correctId,
          correctLabel: handLabel(hand.category),
          reason: `Your best five cards make ${handPhrase(hand)}.`,
          working: ['Seven cards: your two and the five on the board', `Best five: ${cardsText(hand.cards)}`],
          highlight: hand.cards,
          highlightLabel: 'Your best five',
        };
      },
    };
  },
  explainer: {
    body: [
      'You make your best hand from any five of the seven cards: your two and the five on the board. You can use both of your cards, one of them, or neither.',
      `From the bottom: ${HAND_LABELS.join(', ').toLowerCase()}.`,
      'Work down from the top of that list. Look for a flush or a straight first, then for matching ranks. Three of a kind and a pair together make a full house.',
      'A hand that uses none of your cards is playing the board. You still have a hand, but anyone with a better card than yours beats you.',
    ],
    example: {
      prompt: 'What is the best hand you can make?',
      table: { hole: ['9h', '9d'], board: ['9c', 'Kd', 'Ks', '4h', '2s'], note: 'River. All five board cards are out.' },
      answer: 'Full house',
      working: [
        'Seven cards: your two and the five on the board',
        'Best five: 9♥ 9♦ 9♣ K♦ K♠',
        'Three nines and a pair of kings is a full house',
      ],
    },
  },
  furtherReading: AREA_C_READING,
};
