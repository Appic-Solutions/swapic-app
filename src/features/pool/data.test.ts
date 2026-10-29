import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activityRows, combine, launchGainBps, RANGE, stakeSeries, tiles, waitingLine, type MyStake } from './data';

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
