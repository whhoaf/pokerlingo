import type { SkillDef } from '../../engine/types';
import { rngFor } from '../B/common';
import { AREA_C_READING, dealShowdown, showdownQuestion, type Outcome } from './common';

/** A quarter of the questions are splits, many of them because the board plays. */
const TARGETS: Outcome[] = ['you', 'you', 'you', 'opp', 'opp', 'opp', 'split', 'split'];

export const C3: SkillDef = {
  id: 'C3',
  area: 'C',
  title: 'Kickers, split pots and playing the board',
  prereqs: ['C2'],
  generate(seed) {
    const rng = rngFor('C3', seed);
    const target = rng.pick(TARGETS);
    // Both players always make the same kind of hand, so a kicker or the board decides.
    const sd = dealShowdown(rng, 'C3', (s) => s.you.category === s.opp.category && s.outcome === target);
    return showdownQuestion({
      skillId: 'C3',
      seed,
      prompt: 'Who wins at showdown?',
      table: { hole: sd.hole, villain: sd.villain, board: sd.board, note: 'River. Both hands are face up.' },
      sd,
    });
  },
  explainer: {
    body: [
      'When both players make the same kind of hand, compare the cards in it from the most important down. For a pair that is the pair first, then the other three cards, highest first.',
      'The extra cards outside the pair are kickers. Pair of kings with an ace beats pair of kings with a queen. For two pair the order is the higher pair, the lower pair, then the kicker.',
      'Sometimes the best five cards are all on the board. That is playing the board. If neither player can beat it, the pot is split.',
      'Suits never break a tie. Two flushes are compared card by card, and equal flushes split.',
    ],
    example: {
      prompt: 'Who wins at showdown?',
      table: {
        hole: ['As', 'Kd'],
        villain: ['Kh', 'Qd'],
        board: ['Kc', '9h', '5s', '3d', '2c'],
        note: 'River. Both hands are face up.',
      },
      answer: 'You win',
      working: [
        'You: Pair of kings (K♦ K♣ A♠ 9♥ 5♠)',
        'Opponent: Pair of kings (K♥ K♣ Q♦ 9♥ 5♠)',
        'The made hands are equal, so the kicker decides: your ace beats their queen.',
      ],
    },
  },
  furtherReading: AREA_C_READING,
};
