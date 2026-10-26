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
