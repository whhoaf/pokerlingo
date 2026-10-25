import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reviewCard } from '../../src/engine/scheduler';
import { ALL_SKILLS, curriculum } from '../../src/skills';
import { DASHES } from '../helpers/dashes';

function strings(skill: (typeof ALL_SKILLS)[number]): string[] {
  const ex = skill.explainer.example;
  return [
    skill.title,
    ...skill.explainer.body,
    ex.prompt,
    ex.answer,
    ...ex.working,
    ...(ex.table.note ? [ex.table.note] : []),
    ...(skill.furtherReading ?? []).map((l) => l.label),
  ];
}

describe('skill registry', () => {
  it('lists every live skill in intro order, with areas B and C taking turns', () => {
    expect(ALL_SKILLS.map((s) => s.id)).toEqual([
      'B1',
      'C1',
      'B2',
      'C2',
      'B3',
      'C3',
      'B4',
      'C4',
      'B5',
      'C5',
      'B6',
      'C6',
      'B7',
      'D1',
      'B8',
      'B9',
    ]);
    expect(curriculum.skills).toEqual(ALL_SKILLS);
    expect(new Set(ALL_SKILLS.map((s) => s.id)).size).toBe(ALL_SKILLS.length);
    for (const s of ALL_SKILLS) expect(s.id.startsWith(s.area), s.id).toBe(true);
  });

  it('keeps each area in its own order', () => {
    for (const area of ['B', 'C', 'D'] as const) {
      const ids = curriculum.inArea(area).map((s) => s.id);
      expect(ids).toEqual([...ids].sort());
    }
    expect(curriculum.inArea('A')).toEqual([]);
    expect(curriculum.inArea('B')).toHaveLength(9);
    expect(curriculum.inArea('C')).toHaveLength(6);
    expect(curriculum.inArea('D').map((s) => s.id)).toEqual(['D1']);
  });

  it('has the prerequisites from the plan', () => {
    const prereqs = Object.fromEntries(ALL_SKILLS.map((s) => [s.id, s.prereqs]));
    expect(prereqs).toEqual({
      B1: [],
      B2: [],
      B3: [],
      B4: [],
      B5: ['B1', 'B2', 'B3'],
      B6: ['B1'],
      B7: [],
      B8: ['B7'],
      B9: ['B6', 'B7'],
      C1: [],
      C2: ['C1'],
      C3: ['C2'],
      C4: ['C1'],
      C5: ['C1'],
      C6: ['C2'],
      D1: [],
    });
  });

  it('puts every prerequisite earlier in the intro order', () => {
    const position = new Map(ALL_SKILLS.map((s, i) => [s.id, i]));
    for (const s of ALL_SKILLS) {
      for (const pre of s.prereqs) expect(position.get(pre)!, `${s.id} needs ${pre}`).toBeLessThan(position.get(s.id)!);
    }
  });

  it('uses the titles from the PRD', () => {
    expect(Object.fromEntries(ALL_SKILLS.map((s) => [s.id, s.title]))).toEqual({
      B1: 'Count outs: flush draw',
      B2: 'Count outs: open-ended straight draw',
      B3: 'Count outs: gutshot',
      B4: 'Count outs: overcards to top pair',
      B5: 'Count outs: combination draws, without double counting',
      B6: 'Outs to equity: the rule of 2 and 4',
      B7: 'Price of a call as a percentage',
      B8: 'Bet size to required equity (1/3, 1/2, 2/3 and full pot)',
      B9: 'Call or fold with a draw',
      C1: 'Best five-card hand from seven cards',
      C2: 'Who wins at showdown',
      C3: 'Kickers, split pots and playing the board',
      C4: 'The best possible hand on this board (the nuts)',
      C5: 'Can a flush or straight be out there?',
      C6: 'Counterfeited hands',
      D1: 'Turn a pot fraction into chips',
    });
  });

  it('gives every skill an explainer, a worked example and the further reading for its area', () => {
    const reading: Record<string, string[]> = {
      B: [
        'https://bbzpoker.com/poker-quiz/poker-pot-odds-quiz-ratios-percentages/',
        'https://pokerrift.com/learn-poker/',
      ],
      C: ['https://pokerrift.com/learn-poker/', 'https://upswingpoker.com/poker-hands-rankings'],
      D: [], // no source yet: it is found while writing the sizing rules
    };
    for (const s of ALL_SKILLS) {
      expect(s.explainer.body.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.explainer.body.length, s.id).toBeLessThanOrEqual(5);
      expect(s.explainer.example.working.length, s.id).toBeGreaterThan(0);
      expect(s.explainer.example.answer.length, s.id).toBeGreaterThan(0);
      expect((s.furtherReading ?? []).map((l) => l.url), s.id).toEqual(reading[s.area]);
    }
  });

  it('starts a new player with B1 and then C1, so both areas show up early', () => {
    expect(curriculum.nextToIntroduce(new Map())?.id).toBe('B1');
    expect(curriculum.skills.slice(0, 2).map((s) => s.area)).toEqual(['B', 'C']);
  });

  it('lets a player who has met some B skills carry on with the next unlocked skill', () => {
    const met = (...ids: string[]) =>
      new Map(ids.map((id) => [id, { skillId: id, card: reviewCard(undefined, new Date(), 'good').card, introducedAt: '' }]));
    // Old order was B1 to B9. Someone who met B1 to B4 now gets C1, then C2, and so on.
    let records = met('B1', 'B2', 'B3', 'B4');
    expect(curriculum.nextToIntroduce(records)?.id).toBe('C1');
    records = met('B1', 'B2', 'B3', 'B4', 'C1');
    expect(curriculum.nextToIntroduce(records)?.id).toBe('C2');
    // Someone who has met only B1 and B7 meets C1 next, and B8 is already unlocked.
    records = met('B1', 'B7');
    expect(curriculum.nextToIntroduce(records)?.id).toBe('C1');
    expect(curriculum.isUnlocked('B8', records)).toBe(true);
    // Nothing a player has met is ever taken away.
    for (const id of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']) {
      expect(curriculum.get(id).id).toBe(id);
    }
  });

  it('locks C skills until their prerequisites are met', () => {
    const none = new Map();
    expect(curriculum.stateOf('C1', none)).toBe('new');
    expect(curriculum.stateOf('C2', none)).toBe('locked');
    expect(curriculum.stateOf('C3', none)).toBe('locked');
    expect(curriculum.stateOf('C4', none)).toBe('locked');
    expect(curriculum.stateOf('C6', none)).toBe('locked');
    expect(curriculum.stateOf('D1', none)).toBe('new');
  });

  it('says that version 1 counts clean outs only, where outs are counted', () => {
    for (const id of ['B1', 'B2', 'B3', 'B4', 'B5']) {
      expect(curriculum.get(id).explainer.body.join(' '), id).toMatch(/clean outs only/);
    }
  });

  it('keeps em dashes and en dashes out of every user-facing string', () => {
    for (const s of ALL_SKILLS) {
      for (const text of strings(s)) expect(text, `${s.id}: ${text}`).not.toMatch(DASHES);
    }
  });

  it('keeps every explainer example on a valid table', () => {
    for (const s of ALL_SKILLS) {
      const t = s.explainer.example.table;
      const cards = [...(t.hole ?? []), ...(t.board ?? [])];
      expect(new Set(cards).size, s.id).toBe(cards.length);
    }
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name === 'dev-dist' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css|html|py|md|json)$/.test(name) ? [path] : [];
  });
}

describe('writing rules', () => {
  it('has no em dashes or en dashes in the code, tests or progress reports', () => {
    const roots = ['src', 'tests', 'scripts', 'docs/progress', 'index.html', 'README.md'];
    const offenders: string[] = [];
    for (const root of roots) {
      let files: string[];
      try {
        files = statSync(root).isDirectory() ? sourceFiles(root) : [root];
      } catch {
        continue; // a folder that does not exist yet
      }
      for (const file of files) {
        if (DASHES.test(readFileSync(file, 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
