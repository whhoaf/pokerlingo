import type { SkillDef } from '../../engine/types';
import {
  AREA_B_READING,
  CLEAN_NOTE,
  OUTS_PROMPT,
  outsQuestion,
  rankLabel,
  rankWord,
  rankWordPlural,
  rngFor,
} from './common';
import { dealDraw } from './draws';

export const B2: SkillDef = {
  id: 'B2',
  area: 'B',
  title: 'Count outs: open-ended straight draw',
  prereqs: [],
  generate(seed) {
    const rng = rngFor('B2', seed);
    const draw = dealDraw(rng, 'oesd', rng.pick(['flop', 'turn'] as const));
    const run = (draw.runRanks as number[]).map(rankLabel).join(', ');
    const [lo, hi] = draw.completeRanks as [number, number];
    return outsQuestion({
      skillId: 'B2',
      seed,
      prompt: OUTS_PROMPT,
      table: { hole: draw.hole, board: draw.board, note: draw.street === 'flop' ? 'Flop' : 'Turn' },
      outs: draw.outs,
      reason: `You hold ${run} in a row. A ${rankWord(lo)} or a ${rankWord(hi)} makes a straight.`,
      working: [
        `Four in a row: ${run}`,
        `A ${rankWord(lo)} or a ${rankWord(hi)} completes the straight`,
        `4 ${rankWordPlural(lo)} + 4 ${rankWordPlural(hi)} = 8 outs`,
      ],
    });
  },
  explainer: {
    body: [
      'Four cards in a row, such as 6, 7, 8 and 9, are an open-ended straight draw. A 5 or a 10 completes the straight.',
      'There are four cards of each rank, so two open ends give 4 + 4 = 8 outs.',
      'The draw must be open at both ends. J, Q, K and A can only be completed by a 10, because nothing ranks above the ace. That is 4 outs, not 8.',
      CLEAN_NOTE,
    ],
    example: {
      prompt: OUTS_PROMPT,
      table: { hole: ['8s', '9d'], board: ['6c', '7h', 'Kd'], note: 'Flop' },
      answer: '8 outs',
      working: ['Four in a row: 6, 7, 8, 9', 'A 5 or a 10 completes the straight', '4 fives + 4 tens = 8 outs'],
    },
  },
  furtherReading: AREA_B_READING,
};
