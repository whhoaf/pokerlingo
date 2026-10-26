import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DASHES } from '../helpers/dashes';

const css = readFileSync(new URL('../../src/app/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  selectors: string[];
  body: string;
}

/** Every style rule, including those inside @media. Keyframes and @font-face are skipped. */
function parseRules(text: string): Rule[] {
  const rules: Rule[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const head = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const inner = text.slice(open + 1, j - 1);
    if (head.startsWith('@media')) rules.push(...parseRules(inner));
    else if (!head.startsWith('@')) rules.push({ selectors: head.split(',').map((s) => s.trim()), body: inner });
    i = j;
  }
  return rules;
}

const rules = parseRules(css);
const PIXEL_SIZES = ['18px', '36px', '54px'];
const sizeOf = (body: string) => /(?:^|[;\s])font-size:\s*([^;]+)/.exec(body)?.[1]?.trim();

describe('pixel font sizes', () => {
  const pixelRules = rules.filter((r) => /font-family:\s*var\(--px\)/.test(r.body));

  it('finds the pixel rules', () => {
    expect(pixelRules.length).toBeGreaterThan(3);
  });

  it('sets the pixel face only together with a size of 18, 36 or 54 px', () => {
    for (const r of pixelRules) {
      expect(PIXEL_SIZES, `${r.selectors.join(', ')}`).toContain(sizeOf(r.body));
    }
  });

  it('never gives a pixel-font element another size', () => {
    const pixelClasses = new Set<string>();
    const pixelSelectors = new Set<string>();
    for (const r of pixelRules) {
      for (const s of r.selectors) {
        pixelSelectors.add(s);
        if (/^\.[\w-]+$/.test(s)) pixelClasses.add(s.slice(1));
      }
    }
    const touchesPixelText = (selector: string) =>
      pixelSelectors.has(selector) ||
      [...selector.matchAll(/\.([\w-]+)/g)].some(([, name]) => [...pixelClasses].some((p) => name === p || name!.startsWith(`${p}--`)));
    for (const r of rules) {
      const size = sizeOf(r.body);
      if (size === undefined || PIXEL_SIZES.includes(size)) continue;
      for (const s of r.selectors) {
        expect(touchesPixelText(s), `${s} sets font-size ${size}`).toBe(false);
      }
    }
  });

  it('uses plain pixel sizes for every font-size and no font shorthand', () => {
    for (const r of rules) {
      const size = sizeOf(r.body);
      if (size !== undefined) expect(size, r.selectors.join(', ')).toMatch(/^\d+px$/);
      expect(r.body, r.selectors.join(', ')).not.toMatch(/(?:^|[;\s])font:/);
    }
  });
});

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('colour contrast of the fixed pairs', () => {
  const root = rules.find((r) => r.selectors.includes(':root'))!;
  const token = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(root.body)![1]!;
  /** Everything the stylesheet sets for one selector, whichever rules say it. */
  const rule = (selector: string): Rule => ({
    selectors: [selector],
    body: rules.filter((r) => r.selectors.includes(selector)).map((r) => r.body).join(';'),
  });
  const prop = (r: Rule, name: string) => new RegExp(`(?:^|[;\\s])${name}:\\s*([^;]+)`).exec(r.body)?.[1]?.trim();
  const resolve = (value: string | undefined) => token(/var\((--[\w-]+)\)/.exec(value ?? '')![1]!);

  it('keeps the gold note on the felt at 4.5 to 1 or better against a solid backing', () => {
    const note = rule('.felt-note');
    // A solid token colour, never a translucent one: the swirl behind the felt must not change the contrast.
    expect(prop(note, 'background')).toMatch(/^var\(--[\w-]+\)$/);
    expect(contrast(resolve(prop(note, 'color')), resolve(prop(note, 'background')))).toBeGreaterThanOrEqual(4.5);
  });

  it('makes the disabled button a solid panel with light text and no see-through', () => {
    const disabled = rule('.btn:disabled');
    expect(prop(disabled, 'opacity')).toBeUndefined();
    expect(prop(disabled, 'background')).toMatch(/^var\(--[\w-]+\)$/);
    expect(prop(disabled, 'box-shadow')).toMatch(/0 6px 0 var\(--/); // the hard shadow stays
    expect(contrast(resolve(prop(disabled, 'color')), resolve(prop(disabled, 'background')))).toBeGreaterThanOrEqual(4.5);
    // It is clearly unlike the enabled blue button.
    expect(contrast(resolve(prop(disabled, 'background')), token('--blue'))).toBeGreaterThan(1.5);
  });
});

describe('design tokens', () => {
  const root = rules.find((r) => r.selectors.includes(':root'))!;

  it('keeps the palette in one :root block', () => {
    for (const token of ['--red', '--blue', '--orange', '--gold', '--green', '--purple', '--dark', '--dark-2', '--sheet', '--card']) {
      expect(root.body).toContain(`${token}:`);
    }
    expect(root.body).toMatch(/--red:\s*#fe5f55/i);
    expect(root.body).toMatch(/--suit-red:\s*#e5453c/i);
    expect(root.body).toMatch(/--suit-black:\s*#2b3436/i);
  });

  it('has no colour literals outside :root, except black and white shades', () => {
    for (const r of rules) {
      if (r === root) continue;
      const hexes = r.body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      // A handful of tints of the palette used for borders on tags and the dark gradient behind the main button.
      const allowed = new Set(['#4cbaff', '#ffc14d']);
      for (const h of hexes) expect(allowed.has(h.toLowerCase()), `${r.selectors.join(', ')} uses ${h}`).toBe(true);
    }
  });

  it('loads the font from the bundle, not another server', () => {
    expect(css).toMatch(/url\('\/fonts\/m6x11plus\.ttf'\)/);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('has a reduced-motion fallback', () => {
    expect(css).toContain('prefers-reduced-motion');
  });

  it('contains no em or en dashes', () => {
    expect(css).not.toMatch(DASHES);
  });
});
