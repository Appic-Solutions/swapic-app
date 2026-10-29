import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('money has no floating point', () => {
  it('never calls Number, parseFloat or toFixed', () => {
    const dir = new URL('.', import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      expect(src, f).not.toMatch(/\bNumber\(|parseFloat|toFixed|Math\./);
    }
  });
});
