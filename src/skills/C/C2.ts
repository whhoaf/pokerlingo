import type { SkillDef } from '../../engine/types';
import { rngFor } from '../B/common';
import { AREA_C_READING, dealShowdown, showdownQuestion, type Outcome } from './common';

/** Mostly clear wins and losses, with an occasional split. */
const TARGETS: Outcome[] = ['you', 'you', 'you', 'you', 'opp', 'opp', 'opp', 'opp', 'split'];

export const C2: SkillDef = {
  id: 'C2',
  area: 'C',
  title: 'Who wins at showdown',
  prereqs: ['C1'],
  generate(seed) {
    const rng = rngFor('C2', seed);
    const target = rng.pick(TARGETS);
    // A win or a loss comes from different hand categories. Same-category fights are C3.
    const sd = dealShowdown(rng, 'C2', (s) => s.outcome === target && (target === 'split' || s.you.category !== s.opp.category));
    return showdownQuestion({
      skillId: 'C2',
      seed,
      prompt: 'Who wins at showdown?',
      table: { hole: sd.hole, villain: sd.villain, board: sd.board, note: 'River. Both hands are face up.' },
      sd,
    });
  },
  explainer: {
    body: [
      'At showdown each player makes their best five cards from their own two cards and the five on the board. The better hand wins the pot.',
      'Work out both hands first, then compare them. A flush beats a straight, a straight beats three of a kind, and so on up the list.',
      'The hand that is higher in the list wins, whatever the cards in it. A pair of aces loses to the lowest three of a kind.',
      'If both hands are exactly equal, the pot is split.',
    ],
    example: {
      prompt: 'Who wins at showdown?',
      table: {
        hole: ['8s', '8d'],
        villain: ['Ac', 'Qd'],
        board: ['8c', 'Ad', '5h', '2s', '9c'],
        note: 'River. Both hands are face up.',
      },
      answer: 'You win',
      working: [
        'You: Three eights (8♠ 8♦ 8♣ A♦ 9♣)',
        'Opponent: Pair of aces (A♣ A♦ Q♦ 9♣ 8♣)',
        'Three of a kind beats a pair.',
      ],
    },
  },
  furtherReading: AREA_C_READING,
};
