import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
  it('lists B1 to B9 in intro order', () => {
    expect(ALL_SKILLS.map((s) => s.id)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']);
    expect(curriculum.skills).toEqual(ALL_SKILLS);
    expect(ALL_SKILLS.every((s) => s.area === 'B')).toBe(true);
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
    });
  });

  it('uses the titles from the PRD', () => {
    expect(ALL_SKILLS.map((s) => s.title)).toEqual([
      'Count outs: flush draw',
      'Count outs: open-ended straight draw',
      'Count outs: gutshot',
      'Count outs: overcards to top pair',
      'Count outs: combination draws, without double counting',
      'Outs to equity: the rule of 2 and 4',
      'Price of a call as a percentage',
      'Bet size to required equity (1/3, 1/2, 2/3 and full pot)',
      'Call or fold with a draw',
    ]);
  });

  it('gives every skill an explainer, a worked example and further reading', () => {
    for (const s of ALL_SKILLS) {
      expect(s.explainer.body.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.explainer.body.length, s.id).toBeLessThanOrEqual(5);
      expect(s.explainer.example.working.length, s.id).toBeGreaterThan(0);
      expect(s.explainer.example.answer.length, s.id).toBeGreaterThan(0);
      const urls = (s.furtherReading ?? []).map((l) => l.url);
      expect(urls, s.id).toContain('https://bbzpoker.com/poker-quiz/poker-pot-odds-quiz-ratios-percentages/');
      expect(urls, s.id).toContain('https://pokerrift.com/learn-poker/');
    }
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
