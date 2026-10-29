import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scannerTiles } from './stats';

describe('scannerTiles', () => {
  it('fills the four tiles from the 5.12 example', () => {
    const s = JSON.parse(readFileSync('tests/fixtures/contract/scanner-stats.json', 'utf8'));
    expect(scannerTiles(s)).toEqual([
      ['Swaps, 24H', '1,284', '+8% vs yesterday'],
      ['Volume, 24H', '$412,880', 'all chains'],
      ['Median time', '12 s', 'signature to delivery'],
      ['Delivered', '99.6%', '0.4% refunded as USDC'],
    ]);
  });
});
