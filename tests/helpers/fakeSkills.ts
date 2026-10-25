import type { Answer, GradeResult, Question, SkillDef } from '../../src/engine/types';

/** The id of the one correct option in a fake question. */
export const RIGHT: Answer = { kind: 'choice', id: 'right' };
export const WRONG: Answer = { kind: 'choice', id: 'wrong' };

/** A skill whose questions are always 'right' or 'wrong' choices. */
export function fakeSkill(id: string, prereqs: string[] = [], area: SkillDef['area'] = 'B'): SkillDef {
  return {
    id,
    area,
    title: `Skill ${id}`,
    prereqs,
    generate(seed: number): Question {
      return {
        skillId: id,
        seed,
        prompt: `Question for ${id} (seed ${seed})`,
        table: {},
        input: {
          kind: 'choice',
          options: [
            { id: 'right', label: 'Right' },
            { id: 'wrong', label: 'Wrong' },
          ],
        },
        grade(answer: Answer): GradeResult {
          const correct = answer.kind === 'choice' && answer.id === 'right';
          return { correct, correctLabel: 'Right', reason: 'Because.' };
        },
      };
    },
    explainer: {
      body: ['Explainer.'],
      example: { prompt: 'Example', table: {}, answer: 'Right', working: ['Step'] },
    },
  };
}
