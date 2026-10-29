import { describe, expect, it } from 'vitest';
import { problems, visibleTexts } from './check-copy.mjs';

describe('check-copy', () => {
  it('reports internals, em dashes and spaced hyphens in visible text', () => {
    const src = `export const A = () => <p className="px-2 - py-1">Your shares via CCTP — done - ok</p>;`;
    const p = problems(visibleTexts(src));
    expect(p.some((x) => x.includes('shares'))).toBe(true);
    expect(p.some((x) => x.includes('cctp'))).toBe(true);
    expect(p.some((x) => x.startsWith('em dash'))).toBe(true);
    expect(p.some((x) => x.startsWith('hyphen separator'))).toBe(true);
  });
  it('ignores class names, object keys and identifiers', () => {
    const src = `const maxShares = 1; const o = { 'shares': 1 }; export const B = () => <p className="text-muted">Withdraw anytime</p>;`;
    expect(problems(visibleTexts(src))).toEqual([]);
  });
});
