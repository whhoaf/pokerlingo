import { houseChart } from '../../content';
import type { HouseChart } from '../../content/types';
import type { SkillDef } from '../../engine/types';
import { makeSituationSkill } from './situationSkill';

export function makeA6(chart: HouseChart): SkillDef {
  return makeSituationSkill(chart, {
    id: 'A6',
    title: 'Facing limpers: raise or fold',
    prereqs: ['A4'],
    situations: ['limpers.early', 'limpers.late', 'limpers.SB', 'limpers.BB'],
    intro:
      'A limper is a player who calls the big blind instead of raising. The picture shows how many limped in front of you. The chart has one row for early and middle seats, one for late seats and one each for the blinds.',
  });
}

export const A6 = makeA6(houseChart);
