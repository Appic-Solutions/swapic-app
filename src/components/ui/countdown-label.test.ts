import { describe, expect, it } from 'vitest';
import { QUOTE_CYCLE_MS, secondsLeft } from './countdown-label';

describe('secondsLeft ("Updates in 12s")', () => {
  it('counts the 20 s cycle down in whole seconds from when the price was fetched', () => {
    expect(QUOTE_CYCLE_MS).toBe(20_000);
    expect(secondsLeft(1_000, 1_000)).toBe(20);
    expect(secondsLeft(1_000, 1_001)).toBe(20);
    expect(secondsLeft(1_000, 9_000)).toBe(12);
    expect(secondsLeft(1_000, 9_001)).toBe(12);
    expect(secondsLeft(1_000, 9_999)).toBe(12);
    expect(secondsLeft(1_000, 10_000)).toBe(11);
  });
  it('never says 0: due (or late) reads 1 until the fresh price loads', () => {
    expect(secondsLeft(0, 19_999)).toBe(1);
    expect(secondsLeft(0, 20_000)).toBe(1);
    expect(secondsLeft(0, 60_000)).toBe(1);
  });
  it('a fetch time ahead of the clock reads the whole cycle', () => expect(secondsLeft(5_000, 1_000)).toBe(20));
});
