import { createCurriculum } from '../engine/curriculum';
import type { SkillDef } from '../engine/types';
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

/**
 * Every skill, in intro order. Skill ids are stable forever, but the order may change:
 * a player simply continues with the first unlocked skill they have not met.
 *
 * Areas B and C take turns so that a new player meets both early. D1 comes just before
 * B8, which also works in fractions of the pot. Prerequisites always come earlier.
 */
export const ALL_SKILLS: readonly SkillDef[] = [B1, C1, B2, C2, B3, C3, B4, C4, B5, C5, B6, C6, B7, D1, B8, B9];

export const curriculum = createCurriculum(ALL_SKILLS);
