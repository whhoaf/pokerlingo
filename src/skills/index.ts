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

/** Every skill, in intro order. Skill ids are stable forever. */
export const ALL_SKILLS: readonly SkillDef[] = [B1, B2, B3, B4, B5, B6, B7, B8, B9];

export const curriculum = createCurriculum(ALL_SKILLS);
