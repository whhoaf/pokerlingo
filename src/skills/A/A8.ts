import { houseChart } from '../../content';
import type { HouseChart } from '../../content/types';
import type { SkillDef } from '../../engine/types';
import { makeSituationSkill } from './situationSkill';

export function makeA8(chart: HouseChart): SkillDef {
  return makeSituationSkill(chart, {
    id: 'A8',
    title: 'Big blind facing a raise',
    prereqs: ['A4'],
    situations: ['bb.vsRaise'],
    intro:
      'The big blind has already paid a full bet and acts last before the flop, so it has its own row in the chart. One player has raised and the rest have folded.',
  });
}

export const A8 = makeA8(houseChart);
