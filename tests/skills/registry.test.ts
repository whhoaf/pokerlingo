import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { houseChart, sizingRules } from '../../src/content';
import { reviewCard } from '../../src/engine/scheduler';
import { ALL_SKILLS, curriculum } from '../../src/skills';
import { DASHES } from '../helpers/dashes';

function strings(skill: (typeof ALL_SKILLS)[number]): string[] {
  const ex = skill.explainer.example;
  return [
    skill.title,
    ...skill.explainer.body,
    ...(skill.explainer.situations ?? []).flatMap((s) => [s.title, s.where, s.reason, s.range ?? '']),
    ex.prompt,
    ex.answer,
    ...ex.working,
    ...(ex.sources ?? []),
    ...(ex.table.note ? [ex.table.note] : []),
    ...(skill.furtherReading ?? []).map((l) => l.label),
  ];
}

/** The intro order before Areas A and D were added (Milestone 2). Players have met skills in this order. */
const OLD_ORDER = ['B1', 'C1', 'B2', 'C2', 'B3', 'C3', 'B4', 'C4', 'B5', 'C5', 'B6', 'C6', 'B7', 'D1', 'B8', 'B9'];

const met = (...ids: string[]) =>
  new Map(ids.map((id) => [id, { skillId: id, card: reviewCard(undefined, new Date(), 'good').card, introducedAt: '' }]));

describe('skill registry', () => {
  it('lists every skill in intro order, with the areas taking turns', () => {
    expect(ALL_SKILLS.map((s) => s.id)).toEqual([
      'B1',
      'C1',
      'B2',
      'C2',
      'B3',
      'A1',
      'C3',
      'B4',
      'A2',
      'C4',
      'B5',
      'A3',
      'C5',
      'B6',
      'A4',
      'C6',
      'B7',
      'D1',
      'A5',
      'B8',
      'A6',
      'B9',
      'A7',
      'D2',
      'A8',
      'A9',
      'D3',
      'D4',
      'D5',
    ]);
    expect(curriculum.skills).toEqual(ALL_SKILLS);
    expect(new Set(ALL_SKILLS.map((s) => s.id)).size).toBe(ALL_SKILLS.length);
    expect(ALL_SKILLS).toHaveLength(29);
    for (const s of ALL_SKILLS) expect(s.id.startsWith(s.area), s.id).toBe(true);
  });

  it('has every skill of the PRD in every area', () => {
    for (const [area, count] of [['A', 9], ['B', 9], ['C', 6], ['D', 5]] as const) {
      const ids = curriculum.inArea(area).map((s) => s.id);
      expect(ids).toEqual(Array.from({ length: count }, (_, i) => `${area}${i + 1}`));
    }
  });

  it('has the prerequisites from the plan', () => {
    const prereqs = Object.fromEntries(ALL_SKILLS.map((s) => [s.id, s.prereqs]));
    expect(prereqs).toEqual({
      A1: [],
      A2: ['A1'],
      A3: ['A1'],
      A4: ['A1'],
      A5: ['A1'],
      A6: ['A4'],
      A7: ['A3', 'A4'],
      A8: ['A4'],
      A9: ['A2', 'A3'],
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
      D2: ['D1'],
      D3: ['D2'],
      D4: ['D1', 'C5'],
      D5: ['D1'],
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
      A1: 'Name the seats at a 6 to 9 player table',
      A2: 'Open or fold: early seats (7 to 9 players)',
      A3: 'Open or fold: lojack and hijack',
      A4: 'Open or fold: cutoff and button',
      A5: 'Small blind, folded to you',
      A6: 'Facing limpers: raise or fold',
      A7: 'Facing one raise: re-raise, call or fold',
      A8: 'Big blind facing a raise',
      A9: 'Same hand, different table size',
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
      D2: 'Preflop raise size, adding for limpers',
      D3: 'Re-raise size, in and out of position',
      D4: 'Continuation bet size by board texture',
      D5: 'Value bet size against players who call too much',
    });
  });

  it('gives every skill an explainer, a worked example and the further reading for its area', () => {
    const reading: Record<string, string[]> = {
      A: ['https://pokercoaching.com/preflop-charts', 'https://www.evpoker.org/tips/starting-hands-range.html'],
      B: [
        'https://bbzpoker.com/poker-quiz/poker-pot-odds-quiz-ratios-percentages/',
        'https://pokerrift.com/learn-poker/',
      ],
      C: ['https://pokerrift.com/learn-poker/', 'https://upswingpoker.com/poker-hands-rankings'],
    };
    for (const s of ALL_SKILLS) {
      expect(s.explainer.body.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.explainer.body.length, s.id).toBeLessThanOrEqual(5);
      expect(s.explainer.example.working.length, s.id).toBeGreaterThan(0);
      expect(s.explainer.example.answer.length, s.id).toBeGreaterThan(0);
      if (s.area === 'D') {
        // D1 has no source. D2 to D5 link the cited sources of their rule that have a web address, whatever the file says.
        const expected =
          s.id === 'D1'
            ? []
            : [...new Set(sizingRules.rules[s.id as 'D2'].sources.map((id) => sizingRules.sources[id]!.url).filter((u) => u !== ''))];
        expect((s.furtherReading ?? []).map((l) => l.url), s.id).toEqual(expected);
      } else {
        expect((s.furtherReading ?? []).map((l) => l.url), s.id).toEqual(reading[s.area]);
      }
    }
  });

  it('shows the draft note on exactly the skills that give advice from a content file, while it is a draft', () => {
    const advice = ['A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'];
    for (const s of ALL_SKILLS) {
      if (advice.includes(s.id)) expect(s.draft, s.id).toBe(houseChart.draft);
      else if (['D2', 'D3', 'D4', 'D5'].includes(s.id)) expect(s.draft, s.id).toBe(sizingRules.draft);
      else expect(s.draft, s.id).toBeUndefined();
    }
  });

  it('starts a new player with B1 and then C1, so both areas show up early', () => {
    expect(curriculum.nextToIntroduce(new Map())?.id).toBe('B1');
    expect(curriculum.skills.slice(0, 2).map((s) => s.area)).toEqual(['B', 'C']);
  });

  it('brings in Area A after the first five skills, and Area D after its prerequisites', () => {
    const ids = ALL_SKILLS.map((s) => s.id);
    expect(ids.indexOf('A1')).toBeGreaterThanOrEqual(5);
    expect(ids.indexOf('A1')).toBeLessThan(ids.indexOf('A2'));
    expect(ids.indexOf('D1')).toBeLessThan(ids.indexOf('D2'));
    expect(ids.indexOf('C5')).toBeLessThan(ids.indexOf('D4'));
  });

  it('lets a player who has met some B and C skills carry on with the next unlocked skill', () => {
    // Someone who met B1 to B4 under the first order gets C1 next, as before.
    let records = met('B1', 'B2', 'B3', 'B4');
    expect(curriculum.nextToIntroduce(records)?.id).toBe('C1');
    records = met('B1', 'B2', 'B3', 'B4', 'C1');
    expect(curriculum.nextToIntroduce(records)?.id).toBe('C2');
    // Someone who has met only B1 and B7 meets C1 next, and B8 is already unlocked.
    records = met('B1', 'B7');
    expect(curriculum.nextToIntroduce(records)?.id).toBe('C1');
    expect(curriculum.isUnlocked('B8', records)).toBe(true);
  });

  it('keeps every player on track, whatever prefix of the old order they have met', () => {
    for (let n = 0; n <= OLD_ORDER.length; n++) {
      const metIds = OLD_ORDER.slice(0, n);
      const records = met(...metIds);
      // Nothing they have met changes state.
      for (const id of metIds) expect(['locked', 'new'], id).not.toContain(curriculum.stateOf(id, records));
      const next = curriculum.nextToIntroduce(records);
      expect(next, `after ${n} skills`).toBeDefined();
      expect(metIds).not.toContain(next!.id);
      expect(curriculum.isUnlocked(next!.id, records)).toBe(true);
      // It is the first unmet skill in the new order that is unlocked: nothing earlier was skipped.
      const earlier = ALL_SKILLS.slice(0, ALL_SKILLS.indexOf(next!));
      for (const s of earlier) {
        expect(metIds.includes(s.id) || !curriculum.isUnlocked(s.id, records), `${s.id} should come before ${next!.id}`).toBe(true);
      }
    }
  });

  it('gives a player who has met all of Areas B and C and D1 the seat skills next, then sizing', () => {
    const all = met(...OLD_ORDER);
    expect(curriculum.nextToIntroduce(all)?.id).toBe('A1');
    const walked = [...OLD_ORDER];
    const order: string[] = [];
    for (;;) {
      const next = curriculum.nextToIntroduce(met(...walked));
      if (!next) break;
      order.push(next.id);
      walked.push(next.id);
    }
    // Every new skill is reached, each only once its prerequisites are met.
    expect(order.sort()).toEqual(ALL_SKILLS.map((s) => s.id).filter((id) => !OLD_ORDER.includes(id)).sort());
    expect(walked).toHaveLength(29);
  });

  it('locks the skills that need an unmet prerequisite', () => {
    const none = new Map();
    expect(curriculum.stateOf('A1', none)).toBe('new');
    for (const id of ['A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9']) expect(curriculum.stateOf(id, none), id).toBe('locked');
    expect(curriculum.stateOf('C1', none)).toBe('new');
    expect(curriculum.stateOf('C2', none)).toBe('locked');
    expect(curriculum.stateOf('C3', none)).toBe('locked');
    expect(curriculum.stateOf('C4', none)).toBe('locked');
    expect(curriculum.stateOf('C6', none)).toBe('locked');
    expect(curriculum.stateOf('D1', none)).toBe('new');
    for (const id of ['D2', 'D3', 'D4', 'D5']) expect(curriculum.stateOf(id, none), id).toBe('locked');
    // Meeting A1 unlocks A2 to A5 and nothing else in the area.
    const a1 = met('A1');
    for (const id of ['A2', 'A3', 'A4', 'A5']) expect(curriculum.stateOf(id, a1), id).toBe('new');
    for (const id of ['A6', 'A7', 'A8', 'A9']) expect(curriculum.stateOf(id, a1), id).toBe('locked');
    // D4 needs C5 as well as D1.
    expect(curriculum.stateOf('D4', met('D1'))).toBe('locked');
    expect(curriculum.stateOf('D4', met('D1', 'C5'))).toBe('new');
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
  it('has no em dashes or en dashes in the code, tests, content or progress reports', () => {
    const roots = ['src', 'tests', 'scripts', 'content', 'docs/progress', 'index.html', 'README.md'];
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
