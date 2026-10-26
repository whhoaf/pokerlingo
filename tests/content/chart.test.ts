import { describe, expect, it } from 'vitest';
import { lookupFor, situationKind, spotShapes } from '../../src/content/chart';
import {
  chipSpan,
  d2Span,
  d3Span,
  d5Span,
  fractionsInside,
  potSpanText,
  spanText,
  trim,
} from '../../src/content/sizing';
import { sourceLines, sourceLinks, sourceText } from '../../src/content';
import { SITUATION_IDS } from '../../src/content/types';
import { FIXTURE_CHART, FIXTURE_SIZING, ODD_CHART, ODD_SIZING } from '../helpers/content';

// These tests use the small fixture files, whose values are known by heart.
const sit = (id: (typeof SITUATION_IDS)[number]) => FIXTURE_CHART.situations[id];

describe('chart lookup on the fixture chart', () => {
  it('gives the action a range lists, and the default for everything else', () => {
    const open = lookupFor(sit('open.EP'));
    expect(open.verdict('AA')).toEqual({ accept: ['raise'], primary: 'raise', borderline: false });
    expect(open.verdict('KK').accept).toEqual(['raise']);
    expect(open.verdict('JJ')).toEqual({ accept: ['fold'], primary: 'fold', borderline: false });
    expect(open.verdict('72o').accept).toEqual(['fold']);
  });

  it('accepts every action of an either entry and marks the hand borderline', () => {
    const open = lookupFor(sit('open.EP'));
    expect(open.verdict('QQ')).toEqual({ accept: ['raise', 'fold'], primary: 'raise', borderline: true });
    const bb = lookupFor(sit('bb.vsRaise'));
    expect(bb.verdict('A5s')).toEqual({ accept: ['call', 'fold'], primary: 'call', borderline: true });
  });

  it('handles three actions and the default of check', () => {
    const sb = lookupFor(sit('limpers.SB'));
    expect(sb.verdict('AA').accept).toEqual(['raise']);
    expect(sb.verdict('JJ').accept).toEqual(['call']);
    expect(sb.verdict('A5o').accept).toEqual(['fold']);
    const bb = lookupFor(sit('limpers.BB'));
    expect(bb.verdict('AA').accept).toEqual(['raise']);
    expect(bb.verdict('72o').accept).toEqual(['check']);
  });

  it('lets an either entry win over a bucket and over the default of the odd chart', () => {
    const lj = lookupFor(ODD_CHART.situations['open.LJ']);
    expect(lj.verdict('AA')).toEqual({ accept: ['call', 'fold', 'raise'], primary: 'call', borderline: true });
    expect(lj.verdict('AKs')).toEqual({ accept: ['call'], primary: 'call', borderline: false });
  });

  it('reuses the parsed lookup', () => {
    expect(lookupFor(sit('open.CO'))).toBe(lookupFor(sit('open.CO')));
  });

  it('says what kind of situation an ID is', () => {
    expect(situationKind('open.BTN')).toBe('open');
    expect(situationKind('limpers.SB')).toBe('limpers');
    expect(situationKind('raise.vsEarly')).toBe('raise');
    expect(situationKind('bb.vsRaise')).toBe('bb');
    expect(() => situationKind('river.value')).toThrow();
  });
});

describe('spot shapes on the fixture chart', () => {
  it('lists every seat and table size an open situation fits', () => {
    const shapes = spotShapes('open.EP', sit('open.EP'));
    expect(shapes.map((s) => `${s.players}:${s.hero}`)).toEqual([
      '7:UTG',
      '8:UTG',
      '8:UTG+1',
      '9:UTG',
      '9:UTG+1',
      '9:UTG+2',
    ]);
  });

  it('puts the first seat at 6 players on the lojack row', () => {
    const shapes = spotShapes('open.LJ', sit('open.LJ'));
    expect(shapes.map((s) => `${s.players}:${s.hero}`)).toEqual(['6:UTG', '7:LJ', '8:LJ', '9:LJ']);
  });

  it('only offers limpers that fit in front of you', () => {
    const shapes = spotShapes('limpers.early', sit('limpers.early'));
    // The lojack at 7 players has the first seat in front of it and nobody else.
    const lj7 = shapes.find((s) => s.players === 7 && s.hero === 'LJ')!;
    expect(lj7.limperPool).toEqual(['UTG']);
    expect([lj7.minLimpers, lj7.maxLimpers]).toEqual([1, 1]);
    const hj9 = shapes.find((s) => s.players === 9 && s.hero === 'HJ')!;
    expect(hj9.limperPool).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ']);
    expect([hj9.minLimpers, hj9.maxLimpers]).toEqual([1, 2]);
  });

  it('uses 1 to 3 limpers when the chart does not say', () => {
    const co = spotShapes('limpers.late', sit('limpers.late')).find((s) => s.players === 9 && s.hero === 'CO')!;
    expect([co.minLimpers, co.maxLimpers]).toEqual([1, 3]);
    // At 6 players the cutoff has the first seat and the hijack in front.
    const co6 = spotShapes('limpers.late', sit('limpers.late')).find((s) => s.players === 6 && s.hero === 'CO')!;
    expect([co6.minLimpers, co6.maxLimpers]).toEqual([1, 2]);
  });

  it('keeps raisers to the listed seats that act before you', () => {
    const shapes = spotShapes('raise.vsEarly', sit('raise.vsEarly'));
    const btn9 = shapes.find((s) => s.players === 9 && s.hero === 'BTN')!;
    expect(btn9.raisers).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ']);
    const co6 = shapes.find((s) => s.players === 6 && s.hero === 'CO')!;
    expect(co6.raisers).toEqual(['UTG']); // the first seat at 6 players counts as the lojack
    const late = spotShapes('raise.vsLate', sit('raise.vsLate'));
    expect(late.find((s) => s.players === 6 && s.hero === 'BTN')!.raisers).toEqual(['HJ', 'CO']);
    expect(late.find((s) => s.players === 6 && s.hero === 'SB')!.raisers).toEqual(['HJ', 'CO', 'BTN']);
  });

  it('lets the big blind face a raise from any earlier seat, the small blind included', () => {
    const shapes = spotShapes('bb.vsRaise', sit('bb.vsRaise'));
    expect(shapes.every((s) => s.hero === 'BB')).toBe(true);
    expect(shapes.find((s) => s.players === 6)!.raisers).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB']);
    const odd = spotShapes('bb.vsRaise', ODD_CHART.situations['bb.vsRaise']);
    expect(odd.find((s) => s.players === 7)!.raisers).toEqual(['SB']);
  });

  it('finds nothing when the seats cannot occur', () => {
    const impossible = { ...sit('open.EP'), players: [6, 6] as [number, number] };
    expect(spotShapes('open.EP', impossible)).toEqual([]);
  });
});

describe('sizing helpers on the fixture rules', () => {
  const rules = FIXTURE_SIZING.rules;

  it('turns D2 big blinds plus limpers into whole chips', () => {
    // 3 to 4 big blinds, plus one for each limper, with a big blind of 2 chips.
    expect(d2Span(rules.D2, 0)).toEqual({ min: 6, max: 8 });
    expect(d2Span(rules.D2, 2)).toEqual({ min: 10, max: 12 });
    expect(d2Span(ODD_SIZING.rules.D2, 1)).toEqual({ min: 6, max: 6 });
  });

  it('turns D3 multipliers into chips by position', () => {
    expect(d3Span(rules.D3, 8, true)).toEqual({ min: 24, max: 24 });
    expect(d3Span(rules.D3, 8, false)).toEqual({ min: 32, max: 40 });
  });

  it('turns D5 fractions into chips', () => {
    expect(d5Span(rules.D5, 200)).toEqual({ min: 100, max: 150 });
    expect(chipSpan({ min: 0.66, max: 1 }, 150)).toEqual({ min: 99, max: 150 });
  });

  it('finds the D4 choices inside a range, allowing for 0.33 and 0.67 written as decimals', () => {
    expect(fractionsInside(rules.D4.dry)).toEqual(['1/4', '1/3']);
    expect(fractionsInside(rules.D4.wet)).toEqual(['2/3', '3/4']);
    expect(fractionsInside({ min: 0.33, max: 0.33 })).toEqual(['1/3']);
    expect(fractionsInside({ min: 0.66, max: 0.67 })).toEqual(['2/3']);
    expect(fractionsInside({ min: 0.4, max: 0.45 })).toEqual([]);
    expect(fractionsInside({ min: 0, max: 5 })).toHaveLength(6);
  });

  it('writes ranges as text', () => {
    expect(trim(3.5)).toBe('3.5');
    expect(trim(0.66)).toBe('0.66');
    expect(trim(1 / 3)).toBe('0.333');
    expect(spanText({ min: 4, max: 5 }, ' big blinds')).toBe('4 to 5 big blinds');
    expect(spanText({ min: 3, max: 3 }, ' times')).toBe('3 times');
    expect(potSpanText({ min: 0.25, max: 0.5 })).toBe('0.25 to 0.5 of the pot');
  });
});

describe('source text', () => {
  it('writes a source as title and site, or the title alone', () => {
    expect(sourceText({ title: 'T', site: 'example.org', url: 'https://example.org' })).toBe('T, example.org');
    expect(sourceText({ title: 'Placeholder, to be replaced', site: '', url: '' })).toBe('Placeholder, to be replaced');
    expect(sourceLines(FIXTURE_CHART.sources, ['S2', 'S1', 'S5'])).toEqual([
      'Fixture chart two, example.net',
      'Fixture chart one, example.org',
    ]);
  });

  it('links only the sources that have a web address, once each', () => {
    expect(sourceLinks(ODD_CHART.sources, ['TBD', 'S9', 'S9'])).toEqual([
      { label: 'Odd fixture', url: 'https://example.org/odd' },
    ]);
    expect(sourceLinks(ODD_CHART.sources, ['TBD'])).toEqual([]);
  });
});
