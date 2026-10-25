import { it } from 'vitest';
import { ALL_SKILLS } from '../../src/skills';

it('prints samples', () => {
  const t0 = performance.now();
  for (const s of ALL_SKILLS.filter((x) => x.area === 'C' || x.area === 'D')) {
    for (const seed of [1, 2, 3]) {
      const q = s.generate(seed);
      const right = q.input.kind === 'choice' ? q.input.options[0]!.id : '';
      const r = q.grade(q.input.kind === 'choice' ? { kind: 'choice', id: right } : { kind: 'number', value: 1 });
      console.log(s.id, seed, JSON.stringify(q.table), q.prompt, q.input.kind === 'choice' ? q.input.options.map((o) => o.label).join('|') : q.input.unit, '=>', r.correctLabel, '|', r.reason, '|', (r.working ?? []).join(' / '), '|', r.highlightLabel, (r.highlight ?? []).join(' '));
    }
  }
  console.log('ms', performance.now() - t0);
}, 60000);
