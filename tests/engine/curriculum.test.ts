import { describe, expect, it } from 'vitest';
import { createCurriculum, type SkillRecord } from '../../src/engine/curriculum';
import { reviewCard } from '../../src/engine/scheduler';
import { fakeSkill } from '../helpers/fakeSkills';

const NOW = new Date('2026-10-25T08:00:00Z');

function records(...entries: [string, 'again' | 'good' | 'easy'][]): Map<string, SkillRecord> {
  const map = new Map<string, SkillRecord>();
  for (const [id, outcome] of entries) {
    map.set(id, { skillId: id, card: reviewCard(undefined, NOW, outcome).card, introducedAt: NOW.toISOString() });
  }
  return map;
}

const skills = [fakeSkill('B1'), fakeSkill('B2'), fakeSkill('B3', ['B1', 'B2']), fakeSkill('C1', [], 'C')];

describe('createCurriculum', () => {
  it('keeps the intro order and finds skills by id', () => {
    const c = createCurriculum(skills);
    expect(c.skills.map((s) => s.id)).toEqual(['B1', 'B2', 'B3', 'C1']);
    expect(c.get('B3').id).toBe('B3');
    expect(() => c.get('Z9')).toThrow();
  });

  it('rejects duplicate ids', () => {
    expect(() => createCurriculum([fakeSkill('B1'), fakeSkill('B1')])).toThrow(/duplicate/i);
  });

  it('rejects a prerequisite that is unknown or comes later', () => {
    expect(() => createCurriculum([fakeSkill('B1', ['Z9'])])).toThrow();
    expect(() => createCurriculum([fakeSkill('B1', ['B2']), fakeSkill('B2')])).toThrow();
  });

  it('groups by area', () => {
    const c = createCurriculum(skills);
    expect(c.inArea('B').map((s) => s.id)).toEqual(['B1', 'B2', 'B3']);
    expect(c.inArea('C').map((s) => s.id)).toEqual(['C1']);
    expect(c.inArea('A')).toEqual([]);
  });
});

describe('unlocking and states', () => {
  const c = createCurriculum(skills);

  it('locks a skill until every prerequisite is introduced', () => {
    expect(c.stateOf('B3', records())).toBe('locked');
    expect(c.stateOf('B3', records(['B1', 'good']))).toBe('locked');
    expect(c.stateOf('B3', records(['B1', 'good'], ['B2', 'good']))).toBe('new');
  });

  it('marks skills without prerequisites as new', () => {
    expect(c.stateOf('B1', records())).toBe('new');
    expect(c.stateOf('C1', records())).toBe('new');
  });

  it('reports learning, reviewing and strong from the scheduler', () => {
    expect(c.stateOf('B1', records(['B1', 'good']))).toBe('learning');
    expect(c.stateOf('B1', records(['B1', 'easy']))).toBe('reviewing');
    const strong = records(['B1', 'easy']);
    const rec = strong.get('B1')!;
    strong.set('B1', { ...rec, card: { ...rec.card, stability: 40 } });
    expect(c.stateOf('B1', strong)).toBe('strong');
  });

  it('never locks a skill that was already introduced', () => {
    expect(c.stateOf('B3', records(['B3', 'good']))).toBe('learning');
  });
});

describe('nextToIntroduce', () => {
  const c = createCurriculum(skills);

  it('starts with the first skill', () => {
    expect(c.nextToIntroduce(records())?.id).toBe('B1');
  });

  it('follows intro order and skips introduced skills', () => {
    expect(c.nextToIntroduce(records(['B1', 'good']))?.id).toBe('B2');
    expect(c.nextToIntroduce(records(['B1', 'good'], ['B2', 'good']))?.id).toBe('B3');
  });

  it('skips a locked skill and takes the next unlocked one', () => {
    const withLockedFirst = createCurriculum([fakeSkill('B1'), fakeSkill('B2', ['B1']), fakeSkill('C1', [], 'C')]);
    expect(withLockedFirst.nextToIntroduce(records())?.id).toBe('B1');
    // B2 is unlocked once B1 is in; C1 comes after B2 in order.
    expect(withLockedFirst.nextToIntroduce(records(['B1', 'good']))?.id).toBe('B2');
  });

  it('is undefined when everything is introduced', () => {
    const all = records(['B1', 'good'], ['B2', 'good'], ['B3', 'good'], ['C1', 'good']);
    expect(c.nextToIntroduce(all)).toBeUndefined();
  });
});
