// Skills A1 to A9. Every check runs with the shipped chart and with two fixture charts, so none of it depends on
// the values in the shipped file. The answer is always checked against an independent reading of the chart.

import { describe, expect, it } from 'vitest';
import { makeA2 } from '../../src/skills/A/A2';
import { makeA3 } from '../../src/skills/A/A3';
import { makeA4 } from '../../src/skills/A/A4';
import { makeA5 } from '../../src/skills/A/A5';
import { makeA6 } from '../../src/skills/A/A6';
import { makeA7 } from '../../src/skills/A/A7';
import { makeA8 } from '../../src/skills/A/A8';
import { A1 } from '../../src/skills/A/A1';
import { makeA9, differingHands } from '../../src/skills/A/A9';
import { ACTION_LABELS, SITUATION_IDS, type HouseChart, type SituationId } from '../../src/content/types';
import { classOfCards, HAND_CLASSES, nearEdge, parseRange } from '../../src/engine/ranges';
import type { Question, SkillDef } from '../../src/engine/types';
import { ALL_CHARTS, FIXTURE_CHART, clone } from '../helpers/content';
import {
  SEATS,
  findSituationByTitle,
  isBlindSeat,
  kindOfId,
  listed,
  oracleAccept,
  oracleHeroes,
  rowOf,
} from '../helpers/chartOracle';
import { SEEDS, checkGrading, checkQuestionBasics, noDashes, pick } from '../helpers/skillChecks';
import { spotQuestion } from '../../src/skills/A/situationSkill';
import type { Action } from '../../src/content/types';

const SITUATIONS_OF: Record<string, SituationId[]> = {
  A2: ['open.EP'],
  A3: ['open.LJ', 'open.HJ'],
  A4: ['open.CO', 'open.BTN'],
  A5: ['open.SB'],
  A6: ['limpers.early', 'limpers.late', 'limpers.SB', 'limpers.BB'],
  A7: ['raise.vsEarly', 'raise.vsLate'],
  A8: ['bb.vsRaise'],
};

const MAKERS: Record<string, (c: HouseChart) => SkillDef> = {
  A2: makeA2,
  A3: makeA3,
  A4: makeA4,
  A5: makeA5,
  A6: makeA6,
  A7: makeA7,
  A8: makeA8,
};

const labelOf = (actions: string[]) => {
  const words = actions.map((a, i) => (i === 0 ? ACTION_LABELS[a as Action] : ACTION_LABELS[a as Action].toLowerCase()));
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
};

/** What a question shows, read back from its picture. */
function readPicture(q: Question) {
  const ring = q.table.ring!;
  const seats = ring.seats;
  const players = seats.length;
  const hero = seats[ring.focus]!;
  const cls = classOfCards(q.table.hole!);
  const names = seats.map((s) => s.name);
  const limpers = seats.filter((s) => s.role === 'limp').map((s) => s.name as string);
  const raisers = seats.filter((s) => s.role === 'raise').map((s) => s.name as string);
  return { ring, seats, players, hero, cls, names, limpers, raisers };
}

describe.each(Object.keys(MAKERS))('%s', (skillId) => {
  describe.each(ALL_CHARTS)('with the %s', (_label, chart) => {
    const skill = MAKERS[skillId]!(chart);
    const allowed = SITUATIONS_OF[skillId]!;

    it('has the skill id, title and prerequisites from the plan', () => {
      expect(skill.id).toBe(skillId);
      expect(skill.area).toBe('A');
      expect(skill.draft).toBe(chart.draft);
    });

    it('builds a valid, repeatable picture for 500 seeds, in a seat the chart allows', () => {
      const seenHeroes = new Map<string, Set<string>>();
      const seenPlayers = new Set<number>();
      for (const seed of SEEDS) {
        const q = checkQuestionBasics(skill, seed);
        expect(q.table.hole).toHaveLength(2);
        const pic = readPicture(q);
        seenPlayers.add(pic.players);
        expect(pic.players).toBeGreaterThanOrEqual(6);
        expect(pic.players).toBeLessThanOrEqual(9);
        expect(pic.names).toEqual(SEATS[pic.players]);
        expect(pic.hero.role).toBe('you');
        expect(pic.seats.filter((s) => s.button)).toHaveLength(1);
        expect(pic.seats.find((s) => s.button)!.name).toBe('BTN');
        expect(pic.seats.filter((s) => s.role === 'you')).toHaveLength(1);

        // Find the situation through its title, then check the picture against it.
        const result = q.grade({ kind: 'choice', id: q.input.kind === 'choice' ? q.input.options[0]!.id : '' });
        const id = findSituationByTitle(chart, result.rangeGrid!.title);
        expect(allowed, `seed ${seed}: ${id}`).toContain(id);
        const s = chart.situations[id];
        const kind = kindOfId(id);
        const hero = pic.hero.name as string;
        expect(oracleHeroes(id, s, pic.players), `seed ${seed}: ${hero} at ${pic.players} for ${id}`).toContain(hero);
        expect(pic.players).toBeGreaterThanOrEqual(s.players[0]);
        expect(pic.players).toBeLessThanOrEqual(s.players[1]);
        expect(listed(s.seats, hero, pic.players)).toBe(true);
        (seenHeroes.get(id) ?? seenHeroes.set(id, new Set()).get(id)!).add(`${pic.players}:${hero}`);

        const order = SEATS[pic.players]!;
        const heroAt = order.indexOf(hero);
        if (kind === 'limpers') {
          expect(pic.limpers.length).toBeGreaterThanOrEqual(s.limpers?.[0] ?? 1);
          expect(pic.limpers.length).toBeLessThanOrEqual(s.limpers?.[1] ?? 3);
          for (const l of pic.limpers) {
            expect(order.indexOf(l)).toBeLessThan(heroAt);
            expect(isBlindSeat(l)).toBe(false);
          }
          expect(q.prompt).toContain(pic.limpers.length === 1 ? '1 player limps' : `${pic.limpers.length} players limp`);
          expect(pic.raisers).toEqual([]);
        } else {
          expect(pic.limpers).toEqual([]);
        }
        if (kind === 'raise' || kind === 'bb') {
          expect(pic.raisers).toHaveLength(1);
          const raiser = pic.raisers[0]!;
          expect(order.indexOf(raiser)).toBeLessThan(heroAt);
          if (kind === 'raise') expect(isBlindSeat(raiser)).toBe(false);
          if (s.raiser) expect(listed(s.raiser, raiser, pic.players), `${raiser} may raise in ${id}`).toBe(true);
          expect(q.prompt.startsWith(raiser)).toBe(true);
        } else {
          expect(pic.raisers).toEqual([]);
        }
        // Seats in front of you that did not limp or raise are shown as folded; later seats are not marked.
        for (const [i, seat] of pic.seats.entries()) {
          if (seat.role === 'fold') expect(i).toBeLessThan(kind === 'bb' ? order.length - 1 : heroAt);
          if (i < heroAt && !seat.role) throw new Error(`seed ${seed}: ${seat.name} acts before you but is not marked`);
        }
      }
      const lowest = Math.min(...allowed.map((id) => chart.situations[id].players[0]));
      const highest = Math.max(...allowed.map((id) => chart.situations[id].players[1]));
      expect(Math.min(...seenPlayers)).toBeGreaterThanOrEqual(lowest);
      expect(Math.max(...seenPlayers)).toBeLessThanOrEqual(highest);
      // Every seat and table size the content allows turns up in 500 questions.
      for (const id of allowed) {
        const s = chart.situations[id];
        const expected = new Set<string>();
        for (let n = s.players[0]; n <= s.players[1]; n++) for (const h of oracleHeroes(id, s, n)) expected.add(`${n}:${h}`);
        expect([...(seenHeroes.get(id) ?? [])].sort(), id).toEqual([...expected].sort());
      }
    });

    it('grades every choice against the chart, for 500 seeds', () => {
      let borderline = 0;
      const gridsChecked = new Set<string>();
      for (const seed of SEEDS) {
        const q = skill.generate(seed);
        const pic = readPicture(q);
        if (q.input.kind !== 'choice') throw new Error('A2 to A8 are choice questions');
        const probe = q.grade({ kind: 'choice', id: q.input.options[0]!.id });
        const id = findSituationByTitle(chart, probe.rangeGrid!.title);
        const s = chart.situations[id];
        const accepted = oracleAccept(s, pic.cls);

        // The buttons are the situation's choices, in order, with the standard labels.
        expect(q.input.options.map((o) => o.id)).toEqual(s.choices);
        expect(q.input.options.map((o) => o.label)).toEqual(s.choices.map((a) => ACTION_LABELS[a]));

        const right = q.input.options.filter((o) => accepted.includes(o.id)).map((o) => pick(o.id));
        const wrong = q.input.options.filter((o) => !accepted.includes(o.id)).map((o) => pick(o.id));
        expect(right.length).toBe(accepted.length);
        checkGrading(q, right, wrong);

        const r = q.grade(right[0]!);
        expect(r.correctLabel).toBe(labelOf(accepted));
        expect(new Set(r.correctIds)).toEqual(new Set(accepted));
        expect(r.reason).toBe(s.reason);
        expect(r.draft).toBe(chart.draft);
        expect(r.sources).toEqual(s.sources.map((sid) => {
          const src = chart.sources[sid]!;
          return src.site ? `${src.title}, ${src.site}` : src.title;
        }));
        for (const line of r.working ?? []) noDashes(line);
        expect(r.working!.join(' ')).toContain(pic.cls);
        if (accepted.length > 1) borderline++;

        // The grid agrees with the oracle for every one of the 169 classes (checked once per situation).
        const grid = r.rangeGrid!;
        expect(grid.yours).toBe(pic.cls);
        expect(grid.legend.map((l) => l.action)).toEqual(s.choices);
        expect(Object.keys(grid.cells)).toHaveLength(169);
        if (!gridsChecked.has(id)) {
          gridsChecked.add(id);
          for (const cls of HAND_CLASSES) {
            const acc = oracleAccept(s, cls);
            expect(grid.cells[cls]!.action, `${id} ${cls}`).toBe(acc[0]);
            expect(grid.cells[cls]!.borderline, `${id} ${cls}`).toBe(acc.length > 1);
          }
        }
      }
      const hasEither = allowed.some((id) => (chart.situations[id].either ?? []).length > 0);
      if (hasEither) expect(borderline, 'borderline hands should come up').toBeGreaterThan(0);
    });

    it('draws about 60% of hands from near the edge of the listed ranges', () => {
      let near = 0;
      for (const seed of SEEDS) {
        const q = skill.generate(seed);
        const pic = readPicture(q);
        const probe = q.grade({ kind: 'choice', id: (q.input as { options: { id: string }[] }).options[0]!.id });
        const s = chart.situations[findSituationByTitle(chart, probe.rangeGrid!.title)];
        const edge = new Set<string>();
        for (const action of s.choices) {
          const text = s.ranges[action];
          if (text !== undefined) for (const c of nearEdge(parseRange(text), 10)) edge.add(c);
        }
        for (const e of s.either ?? []) for (const c of parseRange(e.hands)) edge.add(c);
        if (edge.size === 0 || edge.has(pic.cls)) near++;
      }
      // 60% on purpose, plus the share of the other 40% that lands near the edge anyway.
      expect(near / SEEDS.length).toBeGreaterThan(0.55);
    });

    it('is the same question for the same seed and a different one for another seed', () => {
      const a = skill.generate(7);
      const b = skill.generate(7);
      expect(a.table).toEqual(b.table);
      const different = SEEDS.slice(0, 50).some((s) => JSON.stringify(skill.generate(s).table) !== JSON.stringify(a.table));
      expect(different).toBe(true);
    });
  });
});

describe.each(ALL_CHARTS)('the Area A explainers with the %s', (_label, chart) => {
  for (const skillId of Object.keys(MAKERS)) {
    it(`${skillId}: quotes every range from the chart and the worked example matches the chart`, () => {
      const skill = MAKERS[skillId]!(chart);
      const body = skill.explainer.body.join(' ');
      expect(skill.explainer.body.length).toBeGreaterThanOrEqual(3);
      expect(skill.explainer.body.length).toBeLessThanOrEqual(5);
      for (const id of SITUATIONS_OF[skillId]!) {
        const s = chart.situations[id];
        expect(body).toContain(s.title);
        for (const text of Object.values(s.ranges)) if (text.trim() !== '') expect(body, `${id}: ${text}`).toContain(text);
        for (const e of s.either ?? []) expect(body).toContain(e.hands);
        expect(body).toContain(ACTION_LABELS[s.default]);
      }
      for (const line of [...skill.explainer.body, skill.explainer.example.prompt, skill.explainer.example.answer, ...skill.explainer.example.working]) {
        noDashes(line);
      }

      // The worked example is a real spot, and its answer is what the chart says for that hand.
      const ex = skill.explainer.example;
      const hole = ex.table.hole!;
      expect(hole).toHaveLength(2);
      const cls = classOfCards(hole);
      const ring = ex.table.ring!;
      const players = ring.seats.length;
      expect(ring.seats.map((s) => s.name)).toEqual(SEATS[players]);
      const heroName = ring.seats[ring.focus]!.name as string;
      const id = findSituationByTitle(chart, ex.rangeGrid!.title);
      expect(SITUATIONS_OF[skillId]).toContain(id);
      expect(oracleHeroes(id, chart.situations[id], players)).toContain(heroName);
      expect(ex.answer).toBe(labelOf(oracleAccept(chart.situations[id], cls)));
      expect(ex.rangeGrid!.yours).toBe(cls);
      expect(ex.working[0]).toBe(chart.situations[id].reason);
      expect(ex.sources!.length).toBeGreaterThan(0);
      expect(skill.furtherReading!.map((l) => l.url)).toEqual([
        'https://pokercoaching.com/preflop-charts',
        'https://www.evpoker.org/tips/starting-hands-range.html',
      ]);
    });
  }

  it('change when the content changes', () => {
    const changed = clone(chart);
    changed.situations['open.CO'].ranges.raise = 'AA';
    changed.situations['open.CO'].reason = 'A different reason.';
    const before = makeA4(chart).explainer;
    const after = makeA4(changed).explainer;
    expect(after.body.join(' ')).not.toBe(before.body.join(' '));
    expect(after.body.join(' ')).toContain('Raise: AA.');
  });
});

describe('Area A with the fixture chart, whose values are known', () => {
  const chart = FIXTURE_CHART;
  const ask = (id: SituationId, spot: Parameters<typeof spotQuestion>[0]['spot'], hole: [string, string]) =>
    spotQuestion({ skillId: 'A2', seed: 1, chart, situation: id, spot, hole });
  const utg9 = { players: 9, hero: 'UTG+1', limpers: [] as string[] };

  it('says raise for a hand in the raise range', () => {
    const q = ask('open.EP', utg9, ['As', 'Ah']);
    expect(q.grade(pick('raise'))).toMatchObject({ correct: true, correctLabel: 'Raise', reason: 'Fixture reason for early seats.' });
    expect(q.grade(pick('fold')).correct).toBe(false);
  });

  it('says fold for a hand the chart does not list', () => {
    const q = ask('open.EP', utg9, ['Jc', 'Jd']);
    expect(q.grade(pick('fold'))).toMatchObject({ correct: true, correctLabel: 'Fold' });
    expect(q.grade(pick('raise')).correct).toBe(false);
  });

  it('accepts both actions for an either hand and names both', () => {
    const q = ask('open.EP', utg9, ['Qd', 'Qh']);
    expect(q.grade(pick('raise')).correct).toBe(true);
    expect(q.grade(pick('fold')).correct).toBe(true);
    const r = q.grade(pick('raise'));
    expect(r.correctLabel).toBe('Raise or fold');
    expect(r.rangeGrid!.cells['QQ']).toEqual({ action: 'raise', borderline: true });
    expect(r.rangeGrid!.cells['KK']).toEqual({ action: 'raise', borderline: false });
    expect(r.rangeGrid!.cells['JJ']).toEqual({ action: 'fold', borderline: false });
    expect(r.rangeGrid!.yours).toBe('QQ');
    expect(r.sources).toEqual(['Fixture chart one, example.org']);
    expect(r.draft).toBe(false);
  });

  it('uses the small blind row with three actions', () => {
    const q = ask('limpers.SB', { players: 7, hero: 'SB', limpers: ['UTG', 'CO'] }, ['Kd', 'Kc']);
    expect(q.input.kind === 'choice' && q.input.options.map((o) => o.label)).toEqual(['Raise', 'Call', 'Fold']);
    expect(q.grade(pick('raise')).correct).toBe(true);
    const mid = ask('limpers.SB', { players: 7, hero: 'SB', limpers: ['UTG', 'CO'] }, ['9d', '9c']);
    expect(mid.grade(pick('call')).correct).toBe(true);
    expect(mid.grade(pick('raise')).correct).toBe(false);
    expect(mid.prompt).toBe('2 players limp in front of you. What do you do?');
  });

  it('keeps the lojack row for the first seat at 6 players', () => {
    const q = ask('open.LJ', { players: 6, hero: 'UTG', limpers: [] }, ['As', 'Ks']);
    expect(q.grade(pick('raise')).correct).toBe(true);
    expect(q.table.note).toBe('Six players. The first seat to act plays like the lojack.');
    expect(q.grade(pick('raise')).working!.join(' ')).toContain('lojack chart');
  });

  it('names the raiser in the prompt, with the seats in between', () => {
    const q = ask('raise.vsEarly', { players: 9, hero: 'BTN', limpers: [], raiser: 'UTG+1' }, ['Ks', 'Kh']);
    expect(q.prompt).toBe('UTG+1 raises and the seats in between fold. What do you do?');
    expect(q.grade(pick('reraise')).correct).toBe(true);
    const bb = ask('bb.vsRaise', { players: 6, hero: 'BB', limpers: [], raiser: 'SB' }, ['Ad', '5d']);
    expect(bb.prompt).toBe('SB raises and everyone else folds. You are in the big blind. What do you do?');
    expect(bb.grade(pick('call')).correct).toBe(true);
    expect(bb.grade(pick('fold')).correct).toBe(true);
    expect(bb.grade(pick('reraise')).correct).toBe(false);
  });

  it('puts the ranges and either hands of the fixture in the explainer', () => {
    const body = makeA3(chart).explainer.body.join(' ');
    expect(body).toContain('Raise: JJ+, AKs.');
    expect(body).toContain('Either is fine for TT (Raise or fold).');
    expect(body).toContain('Raise: 99+, AQs+.');
    expect(body).toContain('Either is fine for 88, AJs (Raise or fold).');
    expect(body).toContain('Every other hand: Fold.');
    expect(makeA3(chart).explainer.example.sources).toEqual(['Fixture chart one, example.org']);
  });
});

describe('A1: name the seats', () => {
  it('shows a ring with the button and one highlighted seat, for 500 seeds', () => {
    const seenPlayers = new Set<number>();
    const seenSeats = new Set<string>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(A1, seed);
      const ring = q.table.ring!;
      const players = ring.seats.length;
      seenPlayers.add(players);
      expect(q.table.hole).toBeUndefined();
      // No seat is named, the button is on the seat that is BTN, and one seat is highlighted.
      expect(ring.seats.every((s) => s.name === null)).toBe(true);
      expect(ring.seats.filter((s) => s.role === 'focus')).toHaveLength(1);
      expect(ring.seats[ring.focus]!.role).toBe('focus');
      const buttonAt = ring.seats.findIndex((s) => s.button);
      expect(ring.seats.filter((s) => s.button)).toHaveLength(1);
      expect(SEATS[players]![buttonAt]).toBe('BTN');

      // The answer is the seat at the highlighted place in the order of play.
      const answer = SEATS[players]![ring.focus]!;
      seenSeats.add(answer);
      if (q.input.kind !== 'choice') throw new Error('A1 is a choice question');
      const ids = q.input.options.map((o) => o.id);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
      for (const id of ids) expect(SEATS[players]).toContain(id);
      expect(ids).toContain(answer);
      checkGrading(q, [pick(answer)], ids.filter((i) => i !== answer).map(pick));
      const r = q.grade(pick(answer));
      expect(r.correctLabel).toBe(answer);
      expect(r.rangeGrid).toBeUndefined();
      expect(r.draft).toBeUndefined();
    }
    expect([...seenPlayers].sort()).toEqual([6, 7, 8, 9]);
    expect(seenSeats).toEqual(new Set(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']));
  });

  it('counts back from the button in the reason', () => {
    const reasons = new Set<string>();
    for (const seed of SEEDS) {
      const q = A1.generate(seed);
      const players = q.table.ring!.seats.length;
      const answer = SEATS[players]![q.table.ring!.focus]!;
      const r = q.grade(pick(answer));
      reasons.add(r.reason);
      if (answer === 'BTN') expect(r.reason).toContain('dealer button');
      if (answer === 'SB') expect(r.reason).toContain('just after the button');
      if (answer === 'BB') expect(r.reason).toContain('after the small blind');
      if (['CO', 'HJ', 'LJ', 'UTG', 'UTG+1', 'UTG+2'].includes(answer)) {
        const back = SEATS[players]!.filter((s) => !isBlindSeat(s)).reverse().indexOf(answer);
        expect(r.reason).toContain(back === 1 ? '1 seat back' : `${back} seats back`);
      }
    }
    expect(reasons.size).toBeGreaterThan(8);
  });

  it('has no prerequisites and a worked example that does not name the highlighted seat', () => {
    expect(A1.prereqs).toEqual([]);
    expect(A1.draft).toBeUndefined();
    expect(A1.explainer.example.table.ring!.seats.every((s) => s.name === null)).toBe(true);
    expect(A1.explainer.example.answer).toBe('HJ');
    expect(A1.explainer.example.table.ring!.seats).toHaveLength(8);
    expect(A1.explainer.example.table.ring!.focus).toBe(SEATS[8]!.indexOf('HJ'));
  });
});

describe.each(ALL_CHARTS)('A9: same hand, different table size, with the %s', (_label, chart) => {
  const A9 = makeA9(chart);

  it('asks about the seat for 500 seeds and about a hand that differs, when there is one', () => {
    const differing = new Set(differingHands(chart));
    // The set of differing hands, checked against the oracle.
    const oracleDiffering = HAND_CLASSES.filter((c) => {
      const a = oracleAccept(chart.situations['open.EP'], c).sort().join('|');
      const b = oracleAccept(chart.situations['open.LJ'], c).sort().join('|');
      return a !== b;
    });
    expect([...differing].sort()).toEqual([...oracleDiffering].sort());

    let seatQuestions = 0;
    let handQuestions = 0;
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(A9, seed);
      if (q.input.kind !== 'choice') throw new Error('A9 is a choice question');
      const ring = q.table.ring!;
      expect(ring.seats).toHaveLength(6);
      expect(ring.seats[ring.focus]!.name).toBe('UTG');
      if (q.table.hole === undefined) {
        seatQuestions++;
        expect([...q.input.options.map((o) => o.id)].sort()).toEqual(['CO', 'HJ', 'LJ', 'UTG']);
        checkGrading(q, [pick('LJ')], ['HJ', 'UTG', 'CO'].map(pick));
        expect(q.grade(pick('LJ')).correctLabel).toBe('LJ');
        expect(q.prompt).toContain('6-player');
        expect(q.prompt).toContain('9-player');
      } else {
        handQuestions++;
        const cls = classOfCards(q.table.hole);
        expect(differing.has(cls), `${cls} must differ between the early seats and the lojack`).toBe(true);
        const lj = chart.situations['open.LJ'];
        const accepted = oracleAccept(lj, cls);
        expect(q.input.options.map((o) => o.id)).toEqual(lj.choices);
        const right = q.input.options.filter((o) => accepted.includes(o.id)).map((o) => pick(o.id));
        const wrong = q.input.options.filter((o) => !accepted.includes(o.id)).map((o) => pick(o.id));
        checkGrading(q, right, wrong);
        const r = q.grade(right[0]!);
        expect(r.correctLabel).toBe(labelOf(accepted));
        // The early row would have answered differently, and the feedback says what it would have been.
        const early = (labelOf(oracleAccept(chart.situations['open.EP'], cls)) as string).toLowerCase();
        expect(r.working!.join(' ')).toContain(`an early seat would ${early} with ${cls}`);
        expect(r.rangeGrid!.title).toBe(lj.title);
        expect(r.draft).toBe(chart.draft);
        expect(r.sources!.length).toBeGreaterThan(0);
      }
    }
    expect(seatQuestions).toBeGreaterThan(150);
    if (differing.size > 0) expect(handQuestions).toBeGreaterThan(150);
    else expect(handQuestions).toBe(0);
  });

  it('has a worked example, the right prerequisites and the Area A reading', () => {
    expect(A9.prereqs).toEqual(['A2', 'A3']);
    expect(A9.draft).toBe(chart.draft);
    expect(A9.explainer.body.length).toBeGreaterThanOrEqual(3);
    expect(A9.explainer.body.length).toBeLessThanOrEqual(5);
    const body = A9.explainer.body.join(' ');
    expect(body).toContain(chart.situations['open.EP'].title);
    expect(body).toContain(chart.situations['open.LJ'].title);
    const ex = A9.explainer.example;
    if (ex.table.hole) {
      const cls = classOfCards(ex.table.hole);
      expect(ex.answer).toBe(labelOf(oracleAccept(chart.situations['open.LJ'], cls)));
    } else {
      expect(ex.answer).toBe('LJ');
    }
  });
});

describe('A9 with the fixture chart', () => {
  it('finds the hands where the early seats and the lojack differ', () => {
    // Early seats raise KK+ and may fold QQ; the lojack raises JJ+ and AKs and may fold TT.
    const diff = new Set(differingHands(FIXTURE_CHART));
    expect(diff.has('JJ')).toBe(true); // lojack raises, early folds
    expect(diff.has('AKs')).toBe(true);
    expect(diff.has('TT')).toBe(true);
    expect(diff.has('KK')).toBe(false);
    expect(diff.has('QQ')).toBe(true); // early: raise or fold. lojack: raise.
    expect(diff.has('72o')).toBe(false);
  });

  it('works without any differing hand', () => {
    const same = clone(FIXTURE_CHART);
    same.situations['open.LJ'] = { ...clone(FIXTURE_CHART.situations['open.EP']), seats: ['LJ'], players: [6, 9], title: 'Lojack copy' };
    expect(differingHands(same)).toEqual([]);
    const skill = makeA9(same);
    for (const seed of SEEDS.slice(0, 60)) {
      const q = skill.generate(seed);
      expect(q.table.hole).toBeUndefined();
    }
    expect(skill.explainer.example.answer).toBe('LJ');
  });

  it('maps seat rows as the plan says', () => {
    expect(rowOf('UTG', 6)).toBe('LJ');
    expect(SITUATION_IDS).toHaveLength(13);
  });
});
