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

export const B3: SkillDef = {
  id: 'B3',
  area: 'B',
  title: 'Count outs: gutshot',
  prereqs: [],
  generate(seed) {
    const rng = rngFor('B3', seed);
    const draw = dealDraw(rng, 'gutshot', rng.pick(['flop', 'turn'] as const));
    const held = (draw.runRanks as number[]).map(rankLabel).join(', ');
    const [missing] = draw.completeRanks as [number];
    return outsQuestion({
      skillId: 'B3',
      seed,
      prompt: OUTS_PROMPT,
      table: { hole: draw.hole, board: draw.board, note: draw.street === 'flop' ? 'Flop' : 'Turn' },
      outs: draw.outs,
      reason: `You hold ${held}. Only a ${rankWord(missing)} fills the gap.`,
      working: [
        `Four cards of a straight: ${held}`,
        `Only a ${rankWord(missing)} fills the gap`,
        `4 ${rankWordPlural(missing)} = 4 outs`,
      ],
    });
  },
  explainer: {
    body: [
      'A gutshot is four cards of a straight with the gap inside, such as 5, 7, 8 and 9. Only a 6 completes it.',
      'One rank has four cards, so a gutshot has 4 outs. That is half as many as an open-ended draw.',
      'Check where the gap is. If the missing card is at either end, you have a different draw.',
      CLEAN_NOTE,
    ],
    example: {
      prompt: OUTS_PROMPT,
      table: { hole: ['8s', '9d'], board: ['5c', '7h', 'Kd'], note: 'Flop' },
      answer: '4 outs',
      working: ['Four cards of a straight: 5, 7, 8, 9', 'Only a 6 fills the gap', '4 sixes = 4 outs'],
    },
  },
  furtherReading: AREA_B_READING,
};
