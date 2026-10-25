import { skillBucket, type Bucket, type StoredCard } from './scheduler';
import type { Area, SkillDef } from './types';

/** What the scheduler knows about an introduced skill. */
export interface SkillRecord {
  skillId: string;
  card: StoredCard;
  /** ISO time the skill was first introduced. */
  introducedAt: string;
}

export type SkillRecords = ReadonlyMap<string, SkillRecord>;

/** The state shown on the skill map. */
export type MapState = 'locked' | Bucket;

export interface Curriculum {
  /** Every skill, in intro order. */
  skills: readonly SkillDef[];
  get(id: string): SkillDef;
  inArea(area: Area): SkillDef[];
  isUnlocked(id: string, records: SkillRecords): boolean;
  stateOf(id: string, records: SkillRecords): MapState;
  /** The first skill in intro order that is not yet introduced and is unlocked. */
  nextToIntroduce(records: SkillRecords): SkillDef | undefined;
}

/** `skills` must already be in intro order. Prerequisites must come earlier in that order. */
export function createCurriculum(skills: readonly SkillDef[]): Curriculum {
  const byId = new Map<string, SkillDef>();
  for (const skill of skills) {
    if (byId.has(skill.id)) throw new Error(`Duplicate skill id: ${skill.id}`);
    for (const pre of skill.prereqs) {
      if (!byId.has(pre)) throw new Error(`${skill.id} needs ${pre}, which is unknown or comes later`);
    }
    byId.set(skill.id, skill);
  }

  const get = (id: string): SkillDef => {
    const skill = byId.get(id);
    if (!skill) throw new Error(`Unknown skill: ${id}`);
    return skill;
  };

  const isUnlocked = (id: string, records: SkillRecords): boolean =>
    get(id).prereqs.every((pre) => records.has(pre));

  const stateOf = (id: string, records: SkillRecords): MapState => {
    const record = records.get(id);
    if (record) return skillBucket(record.card);
    return isUnlocked(id, records) ? 'new' : 'locked';
  };

  return {
    skills,
    get,
    inArea: (area) => skills.filter((s) => s.area === area),
    isUnlocked,
    stateOf,
    nextToIntroduce: (records) => skills.find((s) => !records.has(s.id) && isUnlocked(s.id, records)),
  };
}
