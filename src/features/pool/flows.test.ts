import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Principal } from '@icp-sdk/core/principal';
import type { IcpClient } from '@/lib/icp';
import { PoolErrorFailure } from '@/lib/icp';
import { executeStakeIcp, executeWithdrawIcp, POOL_PAUSED, stakeRoom } from './flows';
describe('stake room', () => {
  it('is the cap less what is staked, never below zero (contract 5.3 example)', () => {
    const p = JSON.parse(readFileSync('tests/fixtures/contract/pool.json', 'utf8'));
    expect(stakeRoom(p)).toBe(1_579_450_000n);
    expect(stakeRoom({ ...p, totalAssets: '20000000000' })).toBe(0n);
  });
});

const CKUSDC = 'xevnm-gaaaa-aaaar-qafnq-cai';
const caller = { agent: {} as never, principal: Principal.fromText('3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe') };
const client = (over: Partial<IcpClient> = {}): IcpClient => ({
  poolState: async () => ({ open: true, totalAssets: 8_420_550_000n, totalShares: 1n, tvlCap: 10_000_000_000n }),
  ledgerFee: async () => 10_000n, balance: async () => 640_120_000n, allowance: async () => 0n,
  poolAccount: async () => ({ shares: 0n, valueUsdc: 0n }),
  approve: vi.fn(async () => 1n), stakeIcp: vi.fn(async () => ({ shares: 1n })), ...over,
}) as IcpClient;
/** A clock the test moves: every sleep moves it on. */
const clockAt = (ms: number) => { let t = ms; return { nowMs: () => t, sleep: async (d: number) => { t += d; } }; };

describe('executeStakeIcp', () => {
  it('approves exactly amount plus fee and stakes for the caller itself', async () => {
    const c = client();
    expect(await executeStakeIcp({ amount: 500_000_000n, caller, onStep: () => {} }, c)).toEqual({ kind: 'started', activityId: 'stake' });
    expect(c.approve).toHaveBeenCalledWith(caller, CKUSDC, 500_010_000n);
    expect(c.stakeIcp).toHaveBeenCalledWith(caller, { owner: { Icp: { owner: caller.principal, subaccount: [] } }, from_subaccount: [], amount: 500_000_000n });
  });
  it('checks open, room and balance before any call (Review Focus 5)', async () => {
    const shut = client({ poolState: async () => ({ open: false, totalAssets: 0n, totalShares: 0n, tvlCap: 1n }) });
    expect(await executeStakeIcp({ amount: 1n, caller, onStep: () => {} }, shut)).toEqual({ kind: 'failed', message: POOL_PAUSED });
    const full = client();
    expect(await executeStakeIcp({ amount: 2_000_000_000n, caller, onStep: () => {} }, full)).toEqual({ kind: 'failed', message: 'You can stake up to $1,579 right now' });
    const poor = client({ balance: async () => 500_000_000n });
    expect(await executeStakeIcp({ amount: 500_000_000n, caller, onStep: () => {} }, poor)).toEqual({ kind: 'failed', message: 'Your wallet does not hold enough for this and its fees' });
    for (const c of [shut, full, poor]) { expect(c.approve).not.toHaveBeenCalled(); expect(c.stakeIcp).not.toHaveBeenCalled(); }
  });
  it('reads the cap refusal and the canister\'s own lost pull', async () => {
    const capped = client({ balance: async () => 2_000_000_000n, stakeIcp: vi.fn(async () => { throw new PoolErrorFailure({ AboveTvlCap: { cap: 10_000_000_000n, would_be: 10_500_000_000n } }); }) });
    expect(await executeStakeIcp({ amount: 1_000_000_000n, caller, onStep: () => {} }, capped)).toEqual({ kind: 'failed', message: 'You can stake up to $500 right now' });
    const landing = client({ stakeIcp: vi.fn(async () => { throw new PoolErrorFailure({ Unavailable: 'pull answer lost' }); }) });
    expect(await executeStakeIcp({ amount: 1_000_000n, caller, onStep: () => {} }, landing)).toEqual({ kind: 'landing' });
  });
  it('a lost answer is judged from the shares and the balance, never the allowance alone (plan check M4)', async () => {
    const lost = vi.fn(async () => { throw new TypeError('fetch failed'); });
    // the shares grew: the stake went in
    const grew = client({ stakeIcp: lost, poolAccount: vi.fn().mockResolvedValueOnce({ shares: 0n, valueUsdc: 0n }).mockResolvedValue({ shares: 5n, valueUsdc: 5n }) });
    expect(await executeStakeIcp({ amount: 1_000_000n, caller, onStep: () => {} }, grew, clockAt(0))).toEqual({ kind: 'landing' });
    // an approval that ran out reads 0, and nothing moved: nothing was taken, said only after 6 minutes, no retry without a new approval
    const clock = clockAt(0);
    const expired = client({ stakeIcp: lost, allowance: async () => 0n });
    expect(await executeStakeIcp({ amount: 1_000_000n, caller, onStep: () => {} }, expired, clock)).toEqual({ kind: 'failed', message: 'Nothing was taken. Try again.' });
    expect(clock.nowMs()).toBeGreaterThanOrEqual(360_000);
    // the balance moved some other way: it cannot tell
    const odd = client({ stakeIcp: lost, balance: vi.fn().mockResolvedValueOnce(640_120_000n).mockResolvedValueOnce(640_110_000n).mockResolvedValue(640_115_000n) });
    expect(await executeStakeIcp({ amount: 1_000_000n, caller, onStep: () => {} }, odd, clockAt(0))).toEqual({ kind: 'unknown', message: 'We cannot tell yet whether your stake went in. Check Your stake before you try again.', resume: null });
  });
});


describe('executeWithdrawIcp', () => {
  const A = 8_420_550_000n, S = 8_346_065_000_000_000_000_000n;
  const owned = { shares: 1_182_254_000_000_000_000_000n, valueUsdc: 1_192_805_102n };
  const c = (over: Partial<IcpClient> = {}) => client({
    poolState: async () => ({ open: true, totalAssets: A, totalShares: S, tvlCap: 1n }),
    poolAccount: async () => owned, withdrawIcp: vi.fn(async (_c, a) => ({ paid: a.usdc - 10_000n, burned: a.max_shares })), ...over,
  });
  it('withdraws to the caller in ckUSDC with two fees of room', async () => {
    const icp = c();
    expect((await executeWithdrawIcp({ wanted: 600_000_000n, caller, onStep: () => {} }, icp)).kind).toBe('started');
    const [, args] = (icp.withdrawIcp as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(args).toEqual({ to: { owner: caller.principal, subaccount: [] }, from: [], usdc: 600_000_000n, max_shares: 597_666_090_101_002_903_611n, min_out: 599_980_000n, token_out: Principal.fromText(CKUSDC) });
  });
  it('withdraw all takes every share and the whole value', async () => {
    const icp = c();
    await executeWithdrawIcp({ wanted: 2_000_000_000n, caller, onStep: () => {} }, icp);
    expect((icp.withdrawIcp as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ usdc: owned.valueUsdc, max_shares: owned.shares });
  });
  it('retries once on ShortShares, never on a lost answer', async () => {
    const short = c({ withdrawIcp: vi.fn().mockRejectedValueOnce(new PoolErrorFailure({ ShortShares: { have: 1n, need: 2n } })).mockResolvedValueOnce({ paid: 1n, burned: 1n }) });
    expect((await executeWithdrawIcp({ wanted: 600_000_000n, caller, onStep: () => {} }, short)).kind).toBe('started');
    const lost = c({ withdrawIcp: vi.fn(async () => { throw new TypeError('fetch failed'); }) });
    const clock = clockAt(0);
    // the shares never moved: it did not go through, said only after 6 minutes; never retried by the app
    expect(await executeWithdrawIcp({ wanted: 600_000_000n, caller, onStep: () => {} }, lost, clock)).toEqual({ kind: 'failed', message: 'Your withdrawal did not go through. Nothing changed. Try again.' });
    expect(clock.nowMs()).toBeGreaterThanOrEqual(360_000);
    expect(lost.withdrawIcp).toHaveBeenCalledTimes(1);
    // fewer shares: it went through
    const went = c({ withdrawIcp: vi.fn(async () => { throw new TypeError('fetch failed'); }), poolAccount: vi.fn().mockResolvedValueOnce(owned).mockResolvedValue({ shares: 1n, valueUsdc: 1n }) });
    expect(await executeWithdrawIcp({ wanted: 600_000_000n, caller, onStep: () => {} }, went, clockAt(0))).toEqual({ kind: 'started', activityId: 'withdraw' });
  });
});
