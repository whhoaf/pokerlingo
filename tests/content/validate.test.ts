import { describe, expect, it } from 'vitest';
import {
  assertHouseChart,
  assertSizingRules,
  validateHouseChart,
  validateSizingRules,
} from '../../src/content/validate';
import { ALL_CHARTS, ALL_SIZING, FIXTURE_CHART, FIXTURE_SIZING, ODD_CHART, REAL_CHART, REAL_SIZING, clone } from '../helpers/content';
import { DASHES } from '../helpers/dashes';

/** Problems found after changing one thing in a good file. */
function chartWith(edit: (c: any) => void): string[] {
  const c = clone(FIXTURE_CHART) as any;
  edit(c);
  return validateHouseChart(c);
}

function rulesWith(edit: (r: any) => void): string[] {
  const r = clone(FIXTURE_SIZING) as any;
  edit(r);
  return validateSizingRules(r);
}

const has = (errors: string[], text: RegExp) => expect(errors.some((e) => text.test(e)), errors.join('\n')).toBe(true);

describe('the shipped content files', () => {
  it('pass the validators', () => {
    expect(validateHouseChart(REAL_CHART)).toEqual([]);
    expect(validateSizingRules(REAL_SIZING)).toEqual([]);
  });

  it('cite no placeholder and no missing source once draft is false', () => {
    for (const [name, file] of [
      ['house chart', REAL_CHART],
      ['sizing rules', REAL_SIZING],
    ] as const) {
      const items =
        'situations' in file ? Object.values(file.situations) : Object.values((file as typeof REAL_SIZING).rules);
      for (const item of items) {
        expect(item.sources.length, name).toBeGreaterThan(0);
        for (const id of item.sources) {
          expect(file.sources[id], `${name} cites ${id}`).toBeDefined();
          if (!file.draft) expect(id, `${name} is not a draft but cites a placeholder`).not.toBe('TBD');
        }
      }
      if (!file.draft) {
        for (const s of Object.values(file.sources)) expect(s.url, name).toMatch(/^https:\/\//);
      }
    }
  });

  it('keep em dashes and en dashes out of every string', () => {
    expect(JSON.stringify(REAL_CHART)).not.toMatch(DASHES);
    expect(JSON.stringify(REAL_SIZING)).not.toMatch(DASHES);
  });
});

describe('the fixtures and other test charts', () => {
  it('are valid', () => {
    for (const [name, chart] of ALL_CHARTS) expect(validateHouseChart(chart), name).toEqual([]);
    for (const [name, rules] of ALL_SIZING) expect(validateSizingRules(rules), name).toEqual([]);
  });

  it('can be asserted', () => {
    expect(assertHouseChart(FIXTURE_CHART)).toBe(FIXTURE_CHART);
    expect(assertSizingRules(FIXTURE_SIZING)).toBe(FIXTURE_SIZING);
    expect(() => assertHouseChart({})).toThrow(/Bad house chart/);
    expect(() => assertSizingRules(null)).toThrow(/Bad sizing rules/);
  });
});

describe('house chart: the whole file', () => {
  it('needs an object, version 1, a draft flag and sources', () => {
    expect(validateHouseChart(null).length).toBeGreaterThan(0);
    expect(validateHouseChart([]).length).toBeGreaterThan(0);
    has(chartWith((c) => (c.version = 2)), /version/);
    has(chartWith((c) => delete c.draft), /draft/);
    has(chartWith((c) => (c.sources = 5)), /sources/);
    has(chartWith((c) => (c.situations = 5)), /situations/);
  });

  it('needs every situation and knows no others', () => {
    has(chartWith((c) => delete c.situations['open.BTN']), /open\.BTN is missing/);
    has(chartWith((c) => (c.situations['open.XX'] = c.situations['open.BTN'])), /open\.XX is not one of/);
  });

  it('needs a title, text and a web address for every real source', () => {
    has(chartWith((c) => (c.sources.S1.url = '')), /Source S1 needs a web address/);
    has(chartWith((c) => (c.sources.S1.url = 'ftp://x.org/a')), /web address/);
    has(chartWith((c) => (c.sources.S1.title = ' ')), /Source S1 has no title/);
    has(chartWith((c) => (c.sources.S1 = { title: 'x' })), /Source S1 needs a title, a site and a url/);
  });
});

describe('house chart: sources and the draft flag', () => {
  it('needs at least one source for every situation', () => {
    has(chartWith((c) => (c.situations['open.CO'].sources = [])), /open\.CO: "sources" must list at least one/);
    has(chartWith((c) => delete c.situations['open.CO'].sources), /open\.CO: "sources" must list/);
  });

  it('fails on a source ID that does not exist, draft or not', () => {
    has(chartWith((c) => (c.situations['open.CO'].sources = ['S9'])), /cites source S9/);
    has(chartWith((c) => (c.draft = true) && (c.situations['open.CO'].sources = ['S9'])), /cites source S9/);
  });

  it('allows the TBD placeholder only while draft is true', () => {
    const tbd = (c: any, draft: boolean) => {
      c.draft = draft;
      c.sources.TBD = { title: 'Placeholder, to be replaced', site: '', url: '' };
      c.situations['open.CO'].sources = ['TBD'];
    };
    expect(chartWith((c) => tbd(c, true))).toEqual([]);
    has(chartWith((c) => tbd(c, false)), /open\.CO: cites TBD/);
    has(chartWith((c) => tbd(c, false)), /Source TBD is a placeholder/);
  });

  it('lets the odd draft chart use TBD', () => {
    expect(ODD_CHART.draft).toBe(true);
    expect(validateHouseChart(ODD_CHART)).toEqual([]);
    const published = clone(ODD_CHART);
    published.draft = false;
    expect(validateHouseChart(published).some((e) => /TBD/.test(e))).toBe(true);
  });
});

describe('house chart: one situation', () => {
  it('needs a title, a reason and valid seats and players', () => {
    has(chartWith((c) => (c.situations['open.CO'].title = '')), /needs a title/);
    has(chartWith((c) => (c.situations['open.CO'].reason = '')), /one-line reason/);
    has(chartWith((c) => (c.situations['open.CO'].seats = [])), /"seats": must be a list of seat names/);
    has(chartWith((c) => (c.situations['open.CO'].seats = ['MP'])), /seat names/);
    has(chartWith((c) => (c.situations['open.CO'].players = [5, 9])), /"players"/);
    has(chartWith((c) => (c.situations['open.CO'].players = [9, 7])), /"players"/);
    has(chartWith((c) => (c.situations['open.CO'].players = [6])), /"players"/);
  });

  it('needs choices that are known actions, and a default among them', () => {
    has(chartWith((c) => (c.situations['open.CO'].choices = ['raise'])), /"choices"/);
    has(chartWith((c) => (c.situations['open.CO'].choices = ['raise', 'shove'])), /"choices"/);
    has(chartWith((c) => (c.situations['open.CO'].choices = ['raise', 'raise'])), /"choices"/);
    has(chartWith((c) => (c.situations['open.CO'].default = 'check')), /"default"/);
  });

  it('needs ranges that parse and belong to a choice', () => {
    has(chartWith((c) => (c.situations['open.CO'].ranges.raise = '77+, XYZ')), /Unknown range token/);
    has(chartWith((c) => (c.situations['open.CO'].ranges.raise = 5)), /must be text/);
    has(chartWith((c) => (c.situations['open.CO'].ranges.call = 'AA')), /call, which is not one of the choices/);
    has(chartWith((c) => (c.situations['open.CO'].ranges = 'AA')), /"ranges" must be an object/);
  });

  it('keeps a hand out of two action buckets', () => {
    has(
      chartWith((c) => (c.situations['limpers.SB'].ranges.call = '22-QQ')),
      /QQ is in both the raise and call ranges/,
    );
    has(
      chartWith((c) => (c.situations['bb.vsRaise'].ranges.call = '22-AA')),
      /AA is in both the reraise and call ranges/,
    );
  });

  it('lets an either entry settle a hand that two buckets list', () => {
    expect(
      chartWith((c) => {
        c.situations['limpers.SB'].ranges.call = '22-QQ';
        c.situations['limpers.SB'].either = [{ hands: 'QQ', accept: ['raise', 'call'] }];
      }),
    ).toEqual([]);
  });

  it('keeps a hand out of two either entries', () => {
    has(
      chartWith((c) => (c.situations['open.CO'].either = [{ hands: '66', accept: ['raise', 'fold'] }, { hands: '66+', accept: ['raise', 'fold'] }])),
      /66 is in more than one "either" entry/,
    );
  });

  it('needs every either entry to accept two or more of the situation choices', () => {
    has(chartWith((c) => (c.situations['open.CO'].either = [{ hands: '66', accept: ['raise'] }])), /"accept" must list at least two/);
    has(chartWith((c) => (c.situations['open.CO'].either = [{ hands: '66', accept: ['raise', 'raise'] }])), /at least two different/);
    has(chartWith((c) => (c.situations['open.CO'].either = [{ hands: '66', accept: ['raise', 'call'] }])), /choices/);
    has(chartWith((c) => (c.situations['open.CO'].either = [{ hands: '6', accept: ['raise', 'fold'] }])), /Unknown range token/);
    has(chartWith((c) => (c.situations['open.CO'].either = 'x')), /"either" must be a list/);
    has(chartWith((c) => (c.situations['open.CO'].either = [5])), /must be an object/);
  });

  it('checks limpers and raiser', () => {
    has(chartWith((c) => (c.situations['limpers.SB'].limpers = [0, 2])), /"limpers"/);
    has(chartWith((c) => (c.situations['limpers.SB'].limpers = [3, 1])), /"limpers"/);
    has(chartWith((c) => (c.situations['raise.vsLate'].raiser = ['XX'])), /"raiser"/);
  });

  it('fails when no table can show the situation', () => {
    // The early seats do not exist at 6 players.
    has(chartWith((c) => (c.situations['open.EP'].players = [6, 6])), /open\.EP: no table size and seat fit/);
    // The raiser would have to sit after the button.
    has(chartWith((c) => (c.situations['raise.vsLate'].raiser = ['BB'])), /raise\.vsLate: no table size and seat fit/);
    // At most seven seats can limp in front of the big blind (nine players), so eight limpers never fit.
    has(chartWith((c) => (c.situations['limpers.BB'].limpers = [8, 9])), /limpers\.BB: no table size/);
  });
});

describe('sizing rules', () => {
  it('needs an object, version 1, a draft flag and sources', () => {
    expect(validateSizingRules(null).length).toBeGreaterThan(0);
    has(rulesWith((r) => (r.version = 0)), /version/);
    has(rulesWith((r) => delete r.draft), /draft/);
    has(rulesWith((r) => (r.rules = [])), /"rules" must be an object/);
  });

  it('needs every rule and knows no others', () => {
    has(rulesWith((r) => delete r.rules.D4), /Rule D4 is missing/);
    has(rulesWith((r) => (r.rules.D9 = r.rules.D5)), /Rule D9 is not one of D2 to D5/);
  });

  it('needs a source on every rule, one that exists, and not TBD once published', () => {
    has(rulesWith((r) => (r.rules.D2.sources = [])), /Rule D2: "sources" must list/);
    has(rulesWith((r) => (r.rules.D2.sources = ['S7'])), /Rule D2: cites source S7/);
    has(
      rulesWith((r) => {
        r.sources.TBD = { title: 'Placeholder, to be replaced', site: '', url: '' };
        r.rules.D5.sources = ['TBD'];
      }),
      /Rule D5: cites TBD/,
    );
    expect(
      rulesWith((r) => {
        r.draft = true;
        r.sources.TBD = { title: 'Placeholder, to be replaced', site: '', url: '' };
        r.rules.D5.sources = ['TBD'];
      }),
    ).toEqual([]);
  });

  it('needs the right unit, a title and a reason', () => {
    has(rulesWith((r) => (r.rules.D3.unit = 'bb')), /"unit" must be "x"/);
    has(rulesWith((r) => (r.rules.D2.title = '')), /needs a title/);
    has(rulesWith((r) => (r.rules.D2.reason = '')), /one-line reason/);
  });

  it('needs positive numbers and a min that is at most the max', () => {
    has(rulesWith((r) => (r.rules.D2.base = { min: 0, max: 5 })), /positive/);
    has(rulesWith((r) => (r.rules.D2.base = { min: 6, max: 5 })), /"min" must be at most "max"/);
    has(rulesWith((r) => (r.rules.D2.base = { min: 'a', max: 5 })), /"min" and a "max"/);
    has(rulesWith((r) => (r.rules.D2.perLimper = 0)), /perLimper/);
    has(rulesWith((r) => (r.rules.D2.perLimper = -1)), /perLimper/);
    has(rulesWith((r) => (r.rules.D3.inPosition = { min: -3, max: 3 })), /inPosition.*positive/);
    has(rulesWith((r) => (r.rules.D3.outOfPosition = { min: 5, max: 4 })), /outOfPosition/);
    has(rulesWith((r) => (r.rules.D5.range = { min: 1, max: 0.5 })), /range/);
    has(rulesWith((r) => delete r.rules.D4.wet), /wet/);
  });

  it('fails when no pot fraction choice falls inside a D4 range', () => {
    has(rulesWith((r) => (r.rules.D4.dry = { min: 0.4, max: 0.45 })), /dry.*no choice/);
    has(rulesWith((r) => (r.rules.D4.wet = { min: 0.8, max: 0.9 })), /wet.*no choice/);
    expect(rulesWith((r) => (r.rules.D4.dry = { min: 0.33, max: 0.33 }))).toEqual([]);
    expect(rulesWith((r) => (r.rules.D4.wet = { min: 0.66, max: 0.67 }))).toEqual([]);
  });
});
