import { createCurriculum } from '../engine/curriculum';
import type { SkillDef } from '../engine/types';
import { A1 } from './A/A1';
import { A2 } from './A/A2';
import { A3 } from './A/A3';
import { A4 } from './A/A4';
import { A5 } from './A/A5';
import { A6 } from './A/A6';
import { A7 } from './A/A7';
import { A8 } from './A/A8';
import { A9 } from './A/A9';
import { B1 } from './B/B1';
import { B2 } from './B/B2';
import { B3 } from './B/B3';
import { B4 } from './B/B4';
import { B5 } from './B/B5';
import { B6 } from './B/B6';
import { B7 } from './B/B7';
import { B8 } from './B/B8';
import { B9 } from './B/B9';
import { C1 } from './C/C1';
import { C2 } from './C/C2';
import { C3 } from './C/C3';
import { C4 } from './C/C4';
import { C5 } from './C/C5';
import { C6 } from './C/C6';
import { D1 } from './D/D1';
import { D2 } from './D/D2';
import { D3 } from './D/D3';
import { D4 } from './D/D4';
import { D5 } from './D/D5';

/**
 * Every skill, in intro order. Skill IDs are stable forever, but the order may change:
 * a player simply continues with the first unlocked skill they have not met.
 *
 * Areas B and C take turns so that a new player meets both early. Area A joins after the first five, with the
 * open or fold skills spread out among the rest, and the sizing skills follow the hands they size. Prerequisites
 * always come earlier.
 */
export const ALL_SKILLS: readonly SkillDef[] = [
  B1,
  C1,
  B2,
  C2,
  B3,
  A1,
  C3,
  B4,
  A2,
  C4,
  B5,
  A3,
  C5,
  B6,
  A4,
  C6,
  B7,
  D1,
  A5,
  B8,
  A6,
  B9,
  A7,
  D2,
  A8,
  A9,
  D3,
  D4,
  D5,
];

export const curriculum = createCurriculum(ALL_SKILLS);
