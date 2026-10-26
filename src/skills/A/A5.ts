import { houseChart } from '../../content';
import type { HouseChart } from '../../content/types';
import type { SkillDef } from '../../engine/types';
import { makeSituationSkill } from './situationSkill';

export function makeA5(chart: HouseChart): SkillDef {
  return makeSituationSkill(chart, {
    id: 'A5',
    title: 'Small blind, folded to you',
    prereqs: ['A1'],
    situations: ['open.SB'],
    intro:
      'The small blind has already put in half a bet and acts first after the flop. Everyone has folded to you and only the big blind is left.',
  });
}

export const A5 = makeA5(houseChart);
