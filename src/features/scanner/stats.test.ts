import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scannerTiles } from './stats';

describe('scannerTiles', () => {
  it('fills the four tiles from the 5.12 example', () => {
    const s = JSON.parse(readFileSync('tests/fixtures/contract/scanner-stats.json', 'utf8'));
    expect(scannerTiles(s)).toEqual([
      ['Swaps, all time', '1,284', 'since launch'],
      ['Volume, all time', '$412,880', 'all chains'],
      ['Median time', '12 sec', 'signature to delivery'],
      ['Delivered', '99.6%', '0.4% refunded as USDC'],
    ]);
  });

  it('counts swaps and volume since the start, where the watcher answers them', () => {
    const s = JSON.parse(readFileSync('tests/fixtures/contract/scanner-stats.json', 'utf8'));
    const tiles = scannerTiles({ ...s, swapsAll: 17, volumeUsdAll: '1260.50' });
    expect(tiles[0]).toEqual(['Swaps, all time', '17', 'since launch']);
    expect(tiles[1]).toEqual(['Volume, all time', '$1,260', 'all chains']);
  });
});
