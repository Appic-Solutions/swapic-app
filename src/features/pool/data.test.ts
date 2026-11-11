import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activityRows, combine, earningsSeries, launchGainBps, launchSeries, launchWorth, RANGE, stakeSeries, tiles, waitingLine, type MyStake } from './data';
import { stakeRoom } from './flows';

const c = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));

describe('pool numbers', () => {
  it('fills the tiles from GET /v2/pool (5.3)', () => {
    expect(tiles(c('pool.json'))).toEqual({ apy: '4.2%', apySub: '3.8% over 30 days', staked: '$8,420', earned24h: '$8.42' });
    expect(tiles({ ...c('pool.json'), stats: null }).apy).toBe('Not yet');
  });
  it('maps the design timeframes to the contract ranges', () => {
    expect(RANGE).toEqual({ '1D': '1d', '1W': '7d', '1M': '30d', '1Y': 'all' });
  });
  it('adds the EVM and ICP stakes, and hides Earned when one is unknown (Review Focus 4)', () => {
    const evm: MyStake = { kind: 'evm', owner: '0xf00e', shares: 1n, valueUsdc: 953_420_000n, earned: 9_000_000n, since: 1_791_878_400, waiting: [] };
    const icp: MyStake = { kind: 'icp', owner: '3yfhk', shares: 1n, valueUsdc: 239_385_102n, earned: 3_400_000n, since: 1_791_000_000, waiting: c('account.json').waiting };
    expect(combine([evm, icp])).toMatchObject({ valueUsdc: 1_192_805_102n, earned: 12_400_000n, since: 1_791_000_000, has: true });
    expect(combine([evm, { ...icp, earned: null }]).earned).toBeNull();
    expect(combine([]).has).toBe(false);
  });
  it('sums the stake histories by time and draws dollars', () => {
    const h = c('account-history.json');
    expect(stakeSeries([h, h], '1M').map((p) => p.value)).toEqual([1997.64, 1997.722]);
  });
  it('ends the stake line at the value read now, not at the last hourly snapshot (a withdrawal shows within a minute)', () => {
    const h = c('account-history.json');
    const lastT = Math.max(...h.points.map((p: { t: number }) => p.t));
    // the step under way: drawn at the live value
    expect(stakeSeries([h], '1M', { valueUsdc: 778_500_000n, nowSec: lastT - 1 }).map((p) => p.value)).toEqual([998.82, 778.5]);
    // no point for the step under way: one more point now
    const later = lastT + h.stepSeconds + 10;
    const drawn = stakeSeries([h], '1M', { valueUsdc: 778_500_000n, nowSec: later });
    expect(drawn.map((p) => p.value)).toEqual([998.82, 998.861, 778.5]);
  });
  it('words the activity rows like the design (5.4)', () => {
    const rows = activityRows(c('pool-activity.json').items, 1_793_408_340);
    expect(rows[0]).toMatchObject({ kind: 'stake', title: 'Staked 998.82 USDC', sub: 'from Arbitrum · 2 min ago', amount: '+$998.82' });
    expect(rows[1]).toMatchObject({ kind: 'premium', title: 'Earned from a swap', sub: 'USDC on Arbitrum to ckBTC · 6 min ago', amount: '+$0.25' });
    expect(rows[2]).toMatchObject({ kind: 'withdraw', title: 'Withdrew 250.00 USDC', sub: 'to Arbitrum · 3 h ago', amount: '-$250.00' });
  });
  it('words each waiting withdrawal by its stage, without minutes when there is no estimate (5.5)', () => {
    const w = c('account.json').waiting[0];
    const one = { usdc: BigInt(w.usdc), etaAt: w.etaAt as number | null, status: w.status as string };
    expect(waitingLine(one, w.etaAt - 2_400)).toBe('Withdrawal of $601.71 in line, about 40 min');
    expect(waitingLine({ ...one, etaAt: null }, 0)).toBe('Withdrawal of $601.71 in line');
    expect(waitingLine({ ...one, status: 'signed' }, 0)).toBe('Withdrawal of $601.71 on its way');
    expect(waitingLine({ ...one, status: 'refunding' }, 0)).toBe('Withdrawal of $601.71 coming back to your stake. You can try again later.');
    expect(waitingLine({ ...one, status: 'somethingNew' }, 0)).toBe('Withdrawal of $601.71 on its way');
  });
  it('reads the $1,000 at launch gain from the share price history', () => {
    expect(launchGainBps(c('pool-history-7d.json'))).toBe(0);
  });
});

// A brand new pool, as staging answered on 2026-10-31 (tests/fixtures/real/staging, with .meta.json): no shares yet, so
// every history point's sharePrice is null, stats carry no rate, and the activity is empty. Nothing may throw.
const staging = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/staging/${f}`, 'utf8'));
describe('an empty pool (real staging answers)', () => {
  it('fills the tiles without a rate: the APY is "Not yet" (its tile is left out), nothing staked or earned', () => {
    expect(tiles(staging('pool.json'))).toEqual({ apy: 'Not yet', apySub: null, staked: '$0', earned24h: '$0.00' });
  });
  it('has the whole cap as room for the first stake', () => expect(stakeRoom(staging('pool.json'))).toBe(10_000_000_000n));
  it('draws no launch line and names no worth or gain while no share price exists', () => {
    for (const f of ['pool-history-30d.json', 'pool-history-7d.json']) {
      const h = staging(f);
      expect(h.points.length).toBeGreaterThan(0);
      expect(h.points.every((p: { sharePrice: string | null }) => p.sharePrice === null)).toBe(true);
      expect(launchSeries(h, '1M')).toEqual([]);
      expect(launchWorth(h)).toBeNull();
      expect(launchGainBps(h)).toBeNull();
      expect(earningsSeries(h, '1M').every((p) => p.value === 0)).toBe(true);
    }
  });
  it('starts the launch line at the first point with a price, drawing through the ones without', () => {
    const h = { range: '30d' as const, stepSeconds: 14400, points: [
      { t: 1, sharePrice: null, totalAssets: '0', earned: '0' },
      { t: 2, sharePrice: '1000000', totalAssets: '5000000', earned: '0' },
      { t: 3, sharePrice: null, totalAssets: '5000000', earned: '0' },
      { t: 4, sharePrice: '1010000', totalAssets: '5050000', earned: '50000' },
    ] };
    expect(launchSeries(h, '1M').map((p) => p.value)).toEqual([1000, 1010]);
    expect(launchWorth(h)).toBe(1_010_000_000n);
    expect(launchGainBps(h)).toBe(100);
  });
  it('lists no activity', () => expect(activityRows(staging('pool-activity.json').items, 1_793_400_000)).toEqual([]));
});
