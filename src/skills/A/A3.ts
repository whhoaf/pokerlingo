import { houseChart } from '../../content';
import type { HouseChart } from '../../content/types';
import type { SkillDef } from '../../engine/types';
import { makeSituationSkill } from './situationSkill';

export function makeA3(chart: HouseChart): SkillDef {
  return makeSituationSkill(chart, {
    id: 'A3',
    title: 'Open or fold: lojack and hijack',
    prereqs: ['A1'],
    situations: ['open.LJ', 'open.HJ'],
    intro:
      'The lojack and the hijack are the two seats before the cutoff. At a 6-player table the first seat to act uses the lojack row of the chart. Everyone before you has folded.',
  });
}

export const A3 = makeA3(houseChart);
