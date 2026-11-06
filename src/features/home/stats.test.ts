import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { earnNumbers, homeStats } from './stats';

describe('home numbers', () => {
  it('reads the scanner stats (contract 5.12 example)', () => {
    const s = JSON.parse(readFileSync('tests/fixtures/contract/scanner-stats.json', 'utf8'));
    expect(homeStats(s)).toEqual({ swaps: '1,284', median: '12 sec', delivered: '99.6%' });
    expect(homeStats({ ...s, medianMs: null, deliveredBps: null })).toEqual({ swaps: '1,284', median: 'none yet', delivered: 'none yet' });
  });
  it('reads the pool numbers and hides a missing APY (contract 5.3 example)', () => {
    const p = JSON.parse(readFileSync('tests/fixtures/contract/pool.json', 'utf8'));
    expect(earnNumbers(p)).toEqual({ apy: '4.2%', staked: '$8,420' });
    expect(earnNumbers({ ...p, stats: null })).toEqual({ apy: null, staked: '$8,420' });
  });
});
