// Skills D2 to D5. Every check runs with the shipped rules and with two fixture rule sets, so none of it depends on
// the numbers in the shipped file. The answer is always worked out again here from the rule in the file.

import pokersolver from 'pokersolver';
import { describe, expect, it } from 'vitest';
import { rankValue, suitOf } from '../../src/engine/cards';
import { classOfCards } from '../../src/engine/ranges';
import type { Question } from '../../src/engine/types';
import type { SizingRules, Span } from '../../src/content/types';
import { d2Question, makeD2 } from '../../src/skills/D/D2';
import { d3Question, makeD3 } from '../../src/skills/D/D3';
import { d4Question, makeD4 } from '../../src/skills/D/D4';
import { d5Question, makeD5 } from '../../src/skills/D/D5';
import { classifyFlop } from '../../src/engine/texture';
import { ALL_SIZING, FIXTURE_SIZING, ODD_SIZING, clone } from '../helpers/content';
import { SEATS, isBlindSeat } from '../helpers/chartOracle';
import { SEEDS, checkGrading, checkQuestionBasics, noDashes, num, pick } from '../helpers/skillChecks';

const { Hand } = pokersolver;

const round = (n: number) => Math.round(n);
const chipsLabel = (lo: number, hi: number) => (lo === hi ? `${lo} chips` : `${lo} to ${hi} chips`);

function picture(q: Question) {
  const ring = q.table.ring!;
  const hero = ring.seats[ring.focus]!.name as string;
  const limpers = ring.seats.filter((s) => s.role === 'limp').map((s) => s.name as string);
  const raiser = ring.seats.find((s) => s.role === 'raise')?.name as string | undefined;
  return { players: ring.seats.length, hero, limpers, raiser, ring };
}

/** Right at both ends, wrong one chip outside, wrong for a fraction of a chip and for nonsense. */
function checkChipEdges(q: Question, lo: number, hi: number): void {
  checkGrading(q, [num(lo), num(hi), num(Math.floor((lo + hi) / 2))], [num(lo - 1), num(hi + 1), num(0), num(hi * 10)]);
  if (hi > lo) expect(q.grade(num(lo + 0.5)).correct, 'half a chip is not a bet').toBe(false);
  expect(q.grade({ kind: 'number', value: Number.POSITIVE_INFINITY }).correct).toBe(false);
}

describe.each(ALL_SIZING)('D2 with the %s', (_label, rules) => {
  const D2 = makeD2(rules);
  const rule = rules.rules.D2;

  it('shows blinds of 1 and 2, 0 to 3 limpers and a seat that can have them, for 500 seeds', () => {
    const counts = new Set<number>();
    const sizes = new Set<number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(D2, seed);
      const { players, hero, limpers, ring } = picture(q);
      sizes.add(players);
      counts.add(limpers.length);
      const order = SEATS[players]!;
      expect(ring.seats.map((s) => s.name)).toEqual(order);
      expect(isBlindSeat(hero)).toBe(false);
      const heroAt = order.indexOf(hero);
      for (const l of limpers) {
        expect(order.indexOf(l)).toBeLessThan(heroAt);
        expect(isBlindSeat(l)).toBe(false);
      }
      expect(limpers.length).toBeLessThanOrEqual(3);
      expect(q.table.note).toBe(`Blinds 1 and 2. ${players} players`);
      expect(q.input).toEqual({ kind: 'number', unit: 'chips' });
      expect(q.prompt).toContain(limpers.length === 0 ? 'Everyone before you folds.' : limpers.length === 1 ? '1 player limps' : `${limpers.length} players limp`);
      expect(q.prompt).toContain('Raise to how many chips?');
      expect(q.table.hole).toHaveLength(2);

      // The rule from the file: base plus a number of big blinds per limper, a big blind being 2 chips.
      const extra = rule.perLimper * limpers.length;
      const lo = round((rule.base.min + extra) * 2);
      const hi = round((rule.base.max + extra) * 2);
      checkChipEdges(q, lo, hi);
      const r = q.grade(num(lo));
      expect(r.correctLabel).toBe(chipsLabel(lo, hi));
      expect(r.reason).toBe(rule.reason);
      expect(r.draft).toBe(rules.draft);
      expect(r.sources!.length).toBeGreaterThan(0);
      for (const line of r.working!) noDashes(line);
    }
    expect([...counts].sort()).toEqual([0, 1, 2, 3]);
    expect([...sizes].sort()).toEqual([6, 7, 8, 9]);
  });

  it('has the plan title, prerequisites and an explainer that reads the rule', () => {
    expect(D2.id).toBe('D2');
    expect(D2.title).toBe('Preflop raise size, adding for limpers');
    expect(D2.prereqs).toEqual(['D1']);
    expect(D2.draft).toBe(rules.draft);
    const body = D2.explainer.body.join(' ');
    expect(D2.explainer.body.length).toBeGreaterThanOrEqual(3);
    expect(D2.explainer.body.length).toBeLessThanOrEqual(5);
    expect(body).toContain(String(rule.base.min));
    expect(body).toContain(String(rule.base.max));
    expect(body).toContain(String(rule.perLimper));
    expect(body).toContain(rule.reason);
    for (const text of [...D2.explainer.body, D2.explainer.example.prompt, D2.explainer.example.answer, ...D2.explainer.example.working]) noDashes(text);
    // The worked example is two limpers: base plus two times the extra, at 2 chips a big blind.
    const ex = D2.explainer.example;
    const n = ex.table.ring!.seats.filter((s) => s.role === 'limp').length;
    expect(n).toBe(2);
    expect(ex.answer).toBe(chipsLabel(round((rule.base.min + rule.perLimper * n) * 2), round((rule.base.max + rule.perLimper * n) * 2)));
    expect(ex.working[0]).toBe(rule.reason);
    expect(ex.sources!.length).toBeGreaterThan(0);
  });
});

describe.each(ALL_SIZING)('D3 with the %s', (_label, rules) => {
  const D3 = makeD3(rules);
  const rule = rules.rules.D3;

  it('shows an open, in or out of position, and grades the multiple of the open, for 500 seeds', () => {
    const positions = new Set<string>();
    const opens = new Set<number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(D3, seed);
      const { players, hero, raiser, ring, limpers } = picture(q);
      expect(limpers).toEqual([]);
      expect(ring.seats.map((s) => s.name)).toEqual(SEATS[players]);
      const open = Number(/raises to (\d+) chips/.exec(q.prompt)![1]);
      opens.add(open);
      expect(q.prompt.startsWith(`${raiser} raises to ${open} chips.`)).toBe(true);
      const inPosition = hero === 'BTN' && raiser === 'CO';
      const outOfPosition = (hero === 'SB' || hero === 'BB') && raiser === 'BTN';
      expect(inPosition || outOfPosition, `${hero} against ${raiser}`).toBe(true);
      positions.add(inPosition ? 'in' : 'out');
      expect(q.prompt).not.toMatch(/position/i); // working out the position is part of the skill

      const span: Span = inPosition ? rule.inPosition : rule.outOfPosition;
      const lo = round(span.min * open);
      const hi = round(span.max * open);
      checkChipEdges(q, lo, hi);
      const r = q.grade(num(hi));
      expect(r.correctLabel).toBe(chipsLabel(lo, hi));
      expect(r.reason).toBe(rule.reason);
      expect(r.draft).toBe(rules.draft);
      expect(r.working!.join(' ')).toContain(inPosition ? 'in position' : 'out of position');
    }
    expect([...positions].sort()).toEqual(['in', 'out']);
    expect(opens.size).toBeGreaterThan(4);
  });

  it('has the plan title, prerequisites and an explainer that reads the rule', () => {
    expect(D3.title).toBe('Re-raise size, in and out of position');
    expect(D3.prereqs).toEqual(['D2']);
    const body = D3.explainer.body.join(' ');
    expect(D3.explainer.body.length).toBeGreaterThanOrEqual(3);
    expect(D3.explainer.body.length).toBeLessThanOrEqual(5);
    for (const v of [rule.inPosition.min, rule.inPosition.max, rule.outOfPosition.min, rule.outOfPosition.max]) {
      expect(body).toContain(String(v));
    }
    expect(body).toContain(rule.reason);
    for (const text of [...D3.explainer.body, D3.explainer.example.prompt, D3.explainer.example.answer, ...D3.explainer.example.working]) noDashes(text);
    const ex = D3.explainer.example;
    const open = Number(/raises to (\d+) chips/.exec(ex.prompt)![1]);
    const { hero } = picture({ table: ex.table } as Question);
    expect(hero).toBe('BTN');
    expect(ex.answer).toBe(chipsLabel(round(rule.inPosition.min * open), round(rule.inPosition.max * open)));
  });
});

// ---- D4: the flop ----

const FRACTIONS: Record<string, number> = { '1/4': 0.25, '1/3': 1 / 3, '1/2': 0.5, '2/3': 2 / 3, '3/4': 0.75, '1': 1 };

/** Written here again: three suits and cards three or more ranks apart (the ace also low) is dry; two suited cards inside five ranks is wet. */
function ownTexture(board: string[]): 'dry' | 'wet' | 'neither' {
  const ranks = board.map(rankValue);
  if (new Set(ranks).size < 3) return 'neither';
  const suits = new Set(board.map(suitOf)).size;
  const near = (a: number, b: number) => Math.min(Math.abs(a - b), a === 14 ? Math.abs(1 - b) : 99, b === 14 ? Math.abs(1 - a) : 99);
  const gaps = [near(ranks[0]!, ranks[1]!), near(ranks[0]!, ranks[2]!), near(ranks[1]!, ranks[2]!)];
  if (suits === 3 && Math.min(...gaps) >= 3) return 'dry';
  const lowAce = ranks.map((r) => (r === 14 ? 1 : r));
  const span = Math.min(Math.max(...ranks) - Math.min(...ranks), Math.max(...lowAce) - Math.min(...lowAce));
  return suits <= 2 && span <= 4 ? 'wet' : 'neither';
}

describe.each(ALL_SIZING)('D4 with the %s', (_label, rules) => {
  const D4 = makeD4(rules);
  const rule = rules.rules.D4;

  it('deals a clearly dry or clearly wet flop and accepts every size inside the range, for 500 seeds', () => {
    const seen = { dry: 0, wet: 0 };
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(D4, seed);
      const board = q.table.board!;
      expect(board).toHaveLength(3);
      const texture = ownTexture(board);
      expect(texture, `seed ${seed}: ${board.join(' ')}`).not.toBe('neither');
      expect(classifyFlop(board)).toBe(texture);
      seen[texture as 'dry' | 'wet']++;
      expect(q.prompt).not.toMatch(/dry|wet/i); // naming the texture would give the answer away
      expect(q.table.pot! % 5).toBe(0);
      expect(q.table.pot).toBeGreaterThanOrEqual(15);
      expect(q.table.pot).toBeLessThanOrEqual(120);

      if (q.input.kind !== 'choice') throw new Error('D4 is a choice question');
      expect(q.input.options.map((o) => o.id)).toEqual(['1/4', '1/3', '1/2', '2/3', '3/4', '1']);
      const span = rule[texture as 'dry' | 'wet'];
      const inside = (id: string) => FRACTIONS[id]! >= span.min - 0.01 && FRACTIONS[id]! <= span.max + 0.01;
      const right = q.input.options.filter((o) => inside(o.id)).map((o) => pick(o.id));
      const wrong = q.input.options.filter((o) => !inside(o.id)).map((o) => pick(o.id));
      expect(right.length).toBeGreaterThan(0);
      checkGrading(q, right, wrong);
      const r = q.grade(right[0]!);
      expect(new Set(r.correctIds)).toEqual(new Set(q.input.options.filter((o) => inside(o.id)).map((o) => o.id)));
      expect(r.reason).toBe(rule.reason);
      expect(r.draft).toBe(rules.draft);
      expect(r.working![0]).toContain(texture);
      for (const line of r.working!) noDashes(line);
    }
    expect(seen.dry).toBeGreaterThan(180);
    expect(seen.wet).toBeGreaterThan(180);
  });

  it('has the plan title, prerequisites and an explainer that reads the rule', () => {
    expect(D4.title).toBe('Continuation bet size by board texture');
    expect(D4.prereqs).toEqual(['D1', 'C5']);
    const body = D4.explainer.body.join(' ');
    expect(D4.explainer.body.length).toBeGreaterThanOrEqual(3);
    expect(D4.explainer.body.length).toBeLessThanOrEqual(5);
    for (const v of [rule.dry.min, rule.dry.max, rule.wet.min, rule.wet.max]) expect(body).toContain(String(v));
    expect(body).toContain(rule.reason);
    for (const text of [...D4.explainer.body, D4.explainer.example.prompt, D4.explainer.example.answer, ...D4.explainer.example.working]) noDashes(text);
    const ex = D4.explainer.example;
    expect(ownTexture(ex.table.board!)).toBe('dry');
    expect(ex.table.board).toEqual(['Ks', '7h', '2d']);
    const insideDry = Object.keys(FRACTIONS).filter((id) => FRACTIONS[id]! >= rule.dry.min - 0.01 && FRACTIONS[id]! <= rule.dry.max + 0.01);
    for (const id of insideDry) expect(ex.answer).toContain(id === '1' ? 'Pot' : `${id} pot`);
  });
});

// ---- D5: the river ----

describe.each(ALL_SIZING)('D5 with the %s', (_label, rules) => {
  const D5 = makeD5(rules);
  const rule = rules.rules.D5;

  it('deals a strong made hand on the river and grades the share of the pot, for 500 seeds', () => {
    const pots = new Set<number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(D5, seed);
      const { hole, board, pot } = q.table;
      expect(board).toHaveLength(5);
      expect(hole).toHaveLength(2);
      // Straight or better, made with a hole card: it beats the best hand the board makes alone.
      const mine = Hand.solve([...hole!, ...board!]);
      const boardOnly = Hand.solve(board!);
      expect(mine.rank, `seed ${seed}`).toBeGreaterThanOrEqual(5);
      expect(Hand.winners([mine, boardOnly])).toEqual([mine]);
      expect(pot! % 5).toBe(0);
      expect(pot).toBeGreaterThanOrEqual(20);
      expect(pot).toBeLessThanOrEqual(400);
      pots.add(pot!);
      expect(q.prompt).toContain(`The pot is ${pot}.`);
      expect(q.prompt).toContain('calls too much');

      const lo = round(rule.range.min * pot!);
      const hi = round(rule.range.max * pot!);
      checkChipEdges(q, lo, hi);
      const r = q.grade(num(lo));
      expect(r.correctLabel).toBe(chipsLabel(lo, hi));
      expect(r.reason).toBe(rule.reason);
      expect(r.draft).toBe(rules.draft);
    }
    expect(pots.size).toBeGreaterThan(60);
  });

  it('has the plan title, prerequisites and an explainer that reads the rule', () => {
    expect(D5.title).toBe('Value bet size against players who call too much');
    expect(D5.prereqs).toEqual(['D1']);
    const body = D5.explainer.body.join(' ');
    expect(D5.explainer.body.length).toBeGreaterThanOrEqual(3);
    expect(D5.explainer.body.length).toBeLessThanOrEqual(5);
    expect(body).toContain(String(rule.range.min));
    expect(body).toContain(String(rule.range.max));
    expect(body).toContain(rule.reason);
    for (const text of [...D5.explainer.body, D5.explainer.example.prompt, D5.explainer.example.answer, ...D5.explainer.example.working]) noDashes(text);
    const ex = D5.explainer.example;
    const mine = Hand.solve([...ex.table.hole!, ...ex.table.board!]);
    expect(mine.rank).toBeGreaterThanOrEqual(5);
    expect(ex.answer).toBe(chipsLabel(round(rule.range.min * ex.table.pot!), round(rule.range.max * ex.table.pot!)));
  });
});

describe.each(ALL_SIZING)('the sizing skills with the %s', (_label, rules) => {
  it('mark the advice as draft only while the file is a draft', () => {
    for (const make of [makeD2, makeD3, makeD4, makeD5]) expect(make(rules).draft).toBe(rules.draft);
  });

  it('link to the cited sources that have a web address, and nothing else', () => {
    const skills = { D2: makeD2(rules), D3: makeD3(rules), D4: makeD4(rules), D5: makeD5(rules) };
    for (const [id, skill] of Object.entries(skills)) {
      const cited = rules.rules[id as 'D2'].sources.map((s) => rules.sources[s]!).filter((s) => s.url !== '');
      expect((skill.furtherReading ?? []).map((l) => l.url), id).toEqual([...new Set(cited.map((s) => s.url))]);
      for (const link of skill.furtherReading ?? []) noDashes(link.label);
    }
  });

  it('change when the rules change', () => {
    const changed: SizingRules = clone(rules);
    changed.rules.D2.base = { min: 7.5, max: 8.5 };
    changed.rules.D2.reason = 'A different reason.';
    expect(makeD2(changed).explainer.body.join(' ')).toContain('7.5 to 8.5');
    expect(makeD2(changed).explainer.body.join(' ')).toContain('A different reason.');
    expect(makeD2(changed).explainer.example.answer).not.toBe(makeD2(rules).explainer.example.answer);
  });
});

describe('the sizing skills with the fixture rules, whose values are known', () => {
  const rules = FIXTURE_SIZING;
  const hole: [string, string] = ['As', 'Ah'];

  it('D2: 3 to 4 big blinds plus 1 per limper, 2 chips a big blind', () => {
    const spot = (n: number) => ({ players: 9, hero: 'BTN', limpers: ['UTG', 'UTG+1', 'UTG+2'].slice(0, n) });
    expect(d2Question({ seed: 1, rules, spot: spot(0), hole }).grade(num(6)).correctLabel).toBe('6 to 8 chips');
    expect(d2Question({ seed: 1, rules, spot: spot(2), hole }).grade(num(10)).correctLabel).toBe('10 to 12 chips');
    const q = d2Question({ seed: 1, rules, spot: spot(3), hole });
    expect(q.grade(num(12)).correct).toBe(true);
    expect(q.grade(num(14)).correct).toBe(true);
    expect(q.grade(num(11)).correct).toBe(false);
    expect(q.grade(num(15)).correct).toBe(false);
    expect(q.grade(num(13)).working).toContain('A big blind is 2 chips, so 12 to 14 chips.');
  });

  it('D2 with the odd rules rounds half big blinds to whole chips', () => {
    // 2.5 big blinds plus 0.5 per limper: 5 chips, then 6, 7 and 8.
    const spot = (n: number) => ({ players: 9, hero: 'BTN', limpers: ['UTG', 'UTG+1', 'UTG+2'].slice(0, n) });
    for (const [n, chips] of [[0, 5], [1, 6], [2, 7], [3, 8]] as const) {
      const q = d2Question({ seed: 1, rules: ODD_SIZING, spot: spot(n), hole });
      expect(q.grade(num(chips)).correct, `${n} limpers`).toBe(true);
      expect(q.grade(num(chips)).correctLabel).toBe(`${chips} chips`);
      expect(q.grade(num(chips + 1)).correct).toBe(false);
    }
  });

  it('D3: 3 times in position, 4 to 5 times out of position', () => {
    const ip = d3Question({ seed: 1, rules, spot: { players: 6, hero: 'BTN', limpers: [], raiser: 'CO' }, open: 8, hole });
    expect(ip.grade(num(24)).correct).toBe(true);
    expect(ip.grade(num(25)).correct).toBe(false);
    expect(ip.grade(num(24)).correctLabel).toBe('24 chips');
    const oop = d3Question({ seed: 1, rules, spot: { players: 8, hero: 'BB', limpers: [], raiser: 'BTN' }, open: 7, hole });
    expect(oop.grade(num(28)).correct).toBe(true);
    expect(oop.grade(num(35)).correct).toBe(true);
    expect(oop.grade(num(27)).correct).toBe(false);
    expect(oop.grade(num(36)).correct).toBe(false);
    expect(oop.grade(num(30)).correctLabel).toBe('28 to 35 chips');
    expect(oop.prompt).toBe('BTN raises to 7 chips. You decide to re-raise. Re-raise to how many chips?');
  });

  it('D4: dry takes 1/4 and 1/3, wet takes 2/3 and 3/4', () => {
    const dry = d4Question({ seed: 1, rules, board: ['Ks', '7h', '2d'], hole: ['Ac', 'Qh'], pot: 40 });
    const wet = d4Question({ seed: 1, rules, board: ['Jh', 'Th', '8c'], hole: ['Ac', 'Qh'], pot: 40 });
    expect(dry.grade(pick('1/4')).correct).toBe(true);
    expect(dry.grade(pick('1/3')).correct).toBe(true);
    expect(dry.grade(pick('1/2')).correct).toBe(false);
    expect(dry.grade(pick('1/4')).correctLabel).toBe('1/4 pot or 1/3 pot');
    expect(wet.grade(pick('2/3')).correct).toBe(true);
    expect(wet.grade(pick('3/4')).correct).toBe(true);
    expect(wet.grade(pick('1')).correct).toBe(false);
    expect(wet.grade(pick('1/3')).correct).toBe(false);
    expect(wet.grade(pick('2/3')).correctLabel).toBe('2/3 pot or 3/4 pot');
    expect(wet.grade(pick('2/3')).working![0]).toBe('The flop is wet: two cards of one suit, and cards close in rank.');
  });

  it('D5: half to three quarters of the pot', () => {
    const q = d5Question({ seed: 1, rules, hole: ['Ac', 'Kc'], board: ['Qc', '9c', '4c', '2d', 'Jh'], pot: 200 });
    expect(q.grade(num(100)).correct).toBe(true);
    expect(q.grade(num(150)).correct).toBe(true);
    expect(q.grade(num(99)).correct).toBe(false);
    expect(q.grade(num(151)).correct).toBe(false);
    expect(q.grade(num(120)).correctLabel).toBe('100 to 150 chips');
    expect(q.grade(num(120)).reason).toBe('Fixture reason for D5.');
    expect(q.grade(num(120)).sources).toEqual(['Fixture sizing one, example.org']);
    expect(classOfCards(['Ac', 'Kc'])).toBe('AKs');
  });

  it('explains from the fixture numbers and links its sources', () => {
    const d3 = makeD3(rules);
    expect(d3.explainer.body[0]).toContain('3 times the open');
    expect(d3.explainer.body[0]).toContain('4 to 5 times the open');
    expect(d3.furtherReading).toEqual([
      { label: 'Fixture sizing one, example.org', url: 'https://example.org/sizing-one' },
      { label: 'Fixture sizing two, example.net', url: 'https://example.net/sizing-two' },
    ]);
    expect(makeD4(rules).explainer.body[0]).toContain('0.25 to 0.34 of the pot');
    expect(makeD5(rules).explainer.body[0]).toContain('0.5 to 0.75 of the pot');
  });
});
