import { houseChart } from '../../content';
import type { HouseChart } from '../../content/types';
import type { SkillDef } from '../../engine/types';
import { makeSituationSkill } from './situationSkill';

export function makeA7(chart: HouseChart): SkillDef {
  return makeSituationSkill(chart, {
    id: 'A7',
    title: 'Facing one raise: re-raise, call or fold',
    prereqs: ['A3', 'A4'],
    situations: ['raise.vsEarly', 'raise.vsLate'],
    intro:
      'When one player has raised in front of you, where the raise came from matters. The picture marks the raiser. The chart has one row for a raise from an early seat and one for a raise from a late seat.',
  });
}

export const A7 = makeA7(houseChart);
