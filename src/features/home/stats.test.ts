import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { earnNumbers, homeStats } from './stats';

describe('home numbers', () => {
  it('reads the scanner stats (contract 5.12 example)', () => {
    const s = JSON.parse(readFileSync('tests/fixtures/contract/scanner-stats.json', 'utf8'));
    expect(homeStats(s)).toEqual({ swaps: '1,284', median: '12 sec', delivered: '99.6%' });
    expect(homeStats({ ...s, medianMs: null, deliveredBps: null })).toEqual({ swaps: '1,284', median: 'none yet', delivered: 'none yet' });
  });
  it('counts since the start where the watcher answers it, though no swap ended in the last day', () => {
    const s = JSON.parse(readFileSync('tests/fixtures/contract/scanner-stats.json', 'utf8'));
    const quiet = { ...s, medianMs: null, deliveredBps: null, delivered: 0, refunded: 0, failed: 0 };
    expect(homeStats({ ...quiet, swapsAll: 320, medianMsAll: 24_648, deliveredAll: 319, refundedAll: 1, failedAll: 0, deliveredBpsAll: 9_968 }))
      .toEqual({ swaps: '320', median: '25 sec', delivered: '99.6%' });
    expect(homeStats({ ...quiet, swapsAll: 0, medianMsAll: null, deliveredBpsAll: null })).toEqual({ swaps: '0', median: 'none yet', delivered: 'none yet' });
  });
  it('reads the pool numbers and hides a missing APY (contract 5.3 example)', () => {
    const p = JSON.parse(readFileSync('tests/fixtures/contract/pool.json', 'utf8'));
    expect(earnNumbers(p)).toEqual({ apy: '4.2%', staked: '$8,420' });
    expect(earnNumbers({ ...p, stats: null })).toEqual({ apy: null, staked: '$8,420' });
  });
});
