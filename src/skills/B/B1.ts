import type { SkillDef } from '../../engine/types';
import { AREA_B_READING, CLEAN_NOTE, OUTS_PROMPT, outsQuestion, rngFor, suitWord } from './common';
import { dealDraw } from './draws';

export const B1: SkillDef = {
  id: 'B1',
  area: 'B',
  title: 'Count outs: flush draw',
  prereqs: [],
  generate(seed) {
    const rng = rngFor('B1', seed);
    const draw = dealDraw(rng, 'flush', rng.pick(['flop', 'turn'] as const));
    const suit = suitWord(draw.flushSuit as string);
    return outsQuestion({
      skillId: 'B1',
      seed,
      prompt: OUTS_PROMPT,
      table: { hole: draw.hole, board: draw.board, note: draw.street === 'flop' ? 'Flop' : 'Turn' },
      outs: draw.outs,
      reason: `You hold four ${suit}, so the other 9 ${suit} in the deck complete the flush.`,
      working: [`There are 13 ${suit} in the deck and 4 are on show`, '13 - 4 = 9 outs'],
    });
  },
  explainer: {
    body: [
      'An out is a card still in the deck that would make your hand a winner. Counting outs is the first step to pricing a call.',
      'A flush needs five cards of one suit. When you hold four of a suit, you are on a flush draw.',
      'Each suit has 13 cards. You can see four of them, your cards and the board, so 9 are left. Those 9 are your outs.',
      CLEAN_NOTE,
    ],
    example: {
      prompt: OUTS_PROMPT,
      table: { hole: ['Ah', '5h'], board: ['Kh', '9h', '2c'], note: 'Flop' },
      answer: '9 outs',
      working: [
        'You hold four hearts: A, K, 9 and 5',
        'There are 13 hearts in the deck and 4 are on show',
        '13 - 4 = 9 outs',
      ],
    },
  },
  furtherReading: AREA_B_READING,
};
