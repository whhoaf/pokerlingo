import { houseChart } from '../../content';
import type { HouseChart } from '../../content/types';
import type { SkillDef } from '../../engine/types';
import { makeSituationSkill } from './situationSkill';

export function makeA4(chart: HouseChart): SkillDef {
  return makeSituationSkill(chart, {
    id: 'A4',
    title: 'Open or fold: cutoff and button',
    prereqs: ['A1'],
    situations: ['open.CO', 'open.BTN'],
    intro:
      'The cutoff and the button act last before the blinds, and the button acts last after the flop. Everyone before you has folded.',
  });
}

export const A4 = makeA4(houseChart);
