import { houseChart } from '../../content';
import type { HouseChart } from '../../content/types';
import type { SkillDef } from '../../engine/types';
import { makeSituationSkill } from './situationSkill';

export function makeA2(chart: HouseChart): SkillDef {
  return makeSituationSkill(chart, {
    id: 'A2',
    title: 'Open or fold: early seats (7 to 9 players)',
    prereqs: ['A1'],
    situations: ['open.EP'],
    intro:
      'The early seats act first, with the most players still to act behind them. This skill is about the first decision: everyone before you has folded, so do you open the pot?',
  });
}

export const A2 = makeA2(houseChart);
