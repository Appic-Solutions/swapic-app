import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hashTypedData } from 'viem';
import { ApiError } from '@/lib/api';
import { withdrawalTypedData } from './withdraw-sig';
import { Principal } from '@icp-sdk/core/principal';
import type { IcpClient } from '@/lib/icp';
import { PoolErrorFailure } from '@/lib/icp';
import { executeStakeIcp, executeWithdrawEvm, executeWithdrawIcp, POOL_PAUSED, stakeRoom } from './flows';
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
    expect(await executeStakeIcp({ amount: 500_000_000n, moveFee: 1_400_000n, caller, onStep: () => {} }, c)).toEqual({ kind: 'started', activityId: 'stake' });
    expect(c.approve).toHaveBeenCalledWith(caller, CKUSDC, 500_010_000n);
    expect(c.stakeIcp).toHaveBeenCalledWith(caller, { owner: { Icp: { owner: caller.principal, subaccount: [] } }, from_subaccount: [], amount: 500_000_000n, move_fee: 1_400_000n });
  });
  it('refuses a move fee the amount does not cover, before any call', async () => {
    const c = client();
    expect(await executeStakeIcp({ amount: 1_000_000n, moveFee: 1_000_000n, caller, onStep: () => {} }, c)).toEqual({ kind: 'failed', message: 'This amount does not cover the fee. Try a larger amount.' });
    expect(c.approve).not.toHaveBeenCalled();
    expect(c.stakeIcp).not.toHaveBeenCalled();
  });
  it('checks open, room and balance before any call (Review Focus 5)', async () => {
    const shut = client({ poolState: async () => ({ open: false, totalAssets: 0n, totalShares: 0n, tvlCap: 1n }) });
    expect(await executeStakeIcp({ amount: 1n, moveFee: 0n, caller, onStep: () => {} }, shut)).toEqual({ kind: 'failed', message: POOL_PAUSED });
    const full = client();
    expect(await executeStakeIcp({ amount: 2_000_000_000n, moveFee: 0n, caller, onStep: () => {} }, full)).toEqual({ kind: 'failed', message: 'You can stake up to $1,579 right now' });
    const poor = client({ balance: async () => 500_000_000n });
    expect(await executeStakeIcp({ amount: 500_000_000n, moveFee: 0n, caller, onStep: () => {} }, poor)).toEqual({ kind: 'failed', message: 'Your wallet does not hold enough for this and its fees' });
    for (const c of [shut, full, poor]) { expect(c.approve).not.toHaveBeenCalled(); expect(c.stakeIcp).not.toHaveBeenCalled(); }
  });
  it('reads the cap refusal and the canister\'s own lost pull', async () => {
    const capped = client({ balance: async () => 2_000_000_000n, stakeIcp: vi.fn(async () => { throw new PoolErrorFailure({ AboveTvlCap: { cap: 10_000_000_000n, would_be: 10_500_000_000n } }); }) });
    expect(await executeStakeIcp({ amount: 1_000_000_000n, moveFee: 0n, caller, onStep: () => {} }, capped)).toEqual({ kind: 'failed', message: 'You can stake up to $500 right now' });
    const landing = client({ stakeIcp: vi.fn(async () => { throw new PoolErrorFailure({ Unavailable: 'pull answer lost' }); }) });
    // it carries the shares read right before the call, so Your stake checks it in only once they grew
    expect(await executeStakeIcp({ amount: 1_000_000n, moveFee: 0n, caller, onStep: () => {} }, landing)).toEqual({ kind: 'landing', sharesBefore: 0n });
  });
  it('a lost answer is judged from the shares and the balance, never the allowance alone (plan check M4)', async () => {
    const lost = vi.fn(async () => { throw new TypeError('fetch failed'); });
    // the shares grew: the stake went in
    const grew = client({ stakeIcp: lost, poolAccount: vi.fn().mockResolvedValueOnce({ shares: 0n, valueUsdc: 0n }).mockResolvedValue({ shares: 5n, valueUsdc: 5n }) });
    expect(await executeStakeIcp({ amount: 1_000_000n, moveFee: 0n, caller, onStep: () => {} }, grew, clockAt(0))).toEqual({ kind: 'landing', sharesBefore: 0n });
    // an approval that ran out reads 0, and nothing moved: nothing was taken, said only after 6 minutes, no retry without a new approval
    const clock = clockAt(0);
    const expired = client({ stakeIcp: lost, allowance: async () => 0n });
    expect(await executeStakeIcp({ amount: 1_000_000n, moveFee: 0n, caller, onStep: () => {} }, expired, clock)).toEqual({ kind: 'failed', message: 'Nothing was taken. Try again.' });
    expect(clock.nowMs()).toBeGreaterThanOrEqual(360_000);
    // the balance moved some other way: it cannot tell
    const odd = client({ stakeIcp: lost, balance: vi.fn().mockResolvedValueOnce(640_120_000n).mockResolvedValueOnce(640_110_000n).mockResolvedValue(640_115_000n) });
    expect(await executeStakeIcp({ amount: 1_000_000n, moveFee: 0n, caller, onStep: () => {} }, odd, clockAt(0))).toEqual({ kind: 'unknown', message: 'We cannot tell yet whether your stake went in. Check Your stake before you try again.', resume: null });
  });
});


describe('executeWithdrawIcp', () => {
  const A = 8_420_550_000n, S = 8_346_065_000_000_000_000_000n;
  const owned = { shares: 1_182_254_000_000_000_000_000n, valueUsdc: 1_192_805_102n };
  const c = (over: Partial<IcpClient> = {}) => client({
    poolState: async () => ({ open: true, totalAssets: A, totalShares: S, tvlCap: 1n }),
    poolAccount: async () => owned, withdrawIcp: vi.fn(async (_c, a) => ({ paid: a.usdc - 10_000n, burned: a.max_shares })), ...over,
  });
  it('withdraws to the caller in ckUSDC, the move fee sent and taken out with two fees of room', async () => {
    const icp = c();
    expect((await executeWithdrawIcp({ wanted: 600_000_000n, moveFee: 1_400_000n, caller, onStep: () => {} }, icp)).kind).toBe('started');
    const [, args] = (icp.withdrawIcp as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(args).toEqual({ to: { owner: caller.principal, subaccount: [] }, from: [], usdc: 600_000_000n, max_shares: 597_666_090_101_002_903_611n, min_out: 598_580_000n, token_out: Principal.fromText(CKUSDC), move_fee: 1_400_000n });
  });
  it('withdraw all takes every share and the whole value', async () => {
    const icp = c();
    await executeWithdrawIcp({ wanted: 2_000_000_000n, moveFee: 0n, caller, onStep: () => {} }, icp);
    expect((icp.withdrawIcp as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ usdc: owned.valueUsdc, max_shares: owned.shares });
  });
  it('retries once on ShortShares, never on a lost answer', async () => {
    const short = c({ withdrawIcp: vi.fn().mockRejectedValueOnce(new PoolErrorFailure({ ShortShares: { have: 1n, need: 2n } })).mockResolvedValueOnce({ paid: 1n, burned: 1n }) });
    expect((await executeWithdrawIcp({ wanted: 600_000_000n, moveFee: 0n, caller, onStep: () => {} }, short)).kind).toBe('started');
    const lost = c({ withdrawIcp: vi.fn(async () => { throw new TypeError('fetch failed'); }) });
    const clock = clockAt(0);
    // the shares never moved: it did not go through, said only after 6 minutes; never retried by the app
    expect(await executeWithdrawIcp({ wanted: 600_000_000n, moveFee: 0n, caller, onStep: () => {} }, lost, clock)).toEqual({ kind: 'failed', message: 'Your withdrawal did not go through. Nothing changed. Try again.' });
    expect(clock.nowMs()).toBeGreaterThanOrEqual(360_000);
    expect(lost.withdrawIcp).toHaveBeenCalledTimes(1);
    // fewer shares: it went through
    const went = c({ withdrawIcp: vi.fn(async () => { throw new TypeError('fetch failed'); }), poolAccount: vi.fn().mockResolvedValueOnce(owned).mockResolvedValue({ shares: 1n, valueUsdc: 1n }) });
    expect(await executeWithdrawIcp({ wanted: 600_000_000n, moveFee: 0n, caller, onStep: () => {} }, went, clockAt(0))).toEqual({ kind: 'started', activityId: 'withdraw' });
  });
});

describe('executeWithdrawEvm', () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const SWAPIC = '0xF0Ba68cBc87c31eCaA9654EB14daF3632eaCa406' as const;
  const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const record = {
    staker: account.address, usdc: '5000000', maxShares: '4980000000000000000', moveFee: '1000', networkFee: '50000',
    payout: { dstChain: 42161, recipient: account.address, tokenOut: ARB_USDC, minOut: '4949000', deadlineNs: '1800000000000000000' }, nonce: '987654321',
  };
  const typed = withdrawalTypedData(record, 8453, SWAPIC);
  const quote = {
    withdrawal: record, typedData: typed, digest: hashTypedData(typed as never), verifyingContract: SWAPIC,
    fees: { networkFee: '50000', moveFee: '1000' }, payout: { route: 'cctp', amount: '4949000', expectedOut: '4949000', minOut: '4949000' },
    shares: { burn: '0', maxShares: record.maxShares, label: 'estimated' }, etaSeconds: 20, quotedAt: 1_799_999_000, expiresAt: 1_800_000_000,
  };
  const evm = { address: account.address, ensureChain: async () => {}, signTypedData: (td: never) => account.signTypedData(td), sendTransaction: vi.fn(), waitForReceipt: vi.fn(), maxFeePerGas: vi.fn() };
  const deps = (over: Partial<IcpClient> = {}, postWithdraw = vi.fn(async () => ({ id: 43, burned: '1' }))) => ({
    icp: client({
      getConfig: async () => ({
        poolChain: 8453, cctpDomains: new Map(), ecoPortal: null,
        chains: new Map([
          [8453, { swapic: SWAPIC.toLowerCase() as `0x${string}`, usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', runner: '0x', cctpReceiver: '0x', tokenMessenger: '0x' }],
          [42161, { swapic: SWAPIC.toLowerCase() as `0x${string}`, usdc: ARB_USDC.toLowerCase() as `0x${string}`, runner: '0x', cctpReceiver: '0x', tokenMessenger: '0x' }],
        ]),
      }),
      poolState: async () => ({ open: true, totalAssets: 8_420_550_000n, totalShares: 8_346_065_000_000_000_000_000n, tvlCap: 1n }),
      withdrawEvm: vi.fn(async () => ({ id: 41n, burned: 1n })), ...over,
    }),
    postWithdrawQuote: vi.fn(async () => quote as never), postWithdraw, nowMs: () => 1_799_999_000_000, used: { has: () => false, add: vi.fn() },
  });
  const run = (d: ReturnType<typeof deps>) => executeWithdrawEvm({ usdc: 5_000_000n, dstChain: 'eip155:42161', evm: evm as never, onStep: () => {} }, d);

  it('signs the rebuilt record and sends exactly it to withdraw_evm', async () => {
    const d = deps();
    expect(await run(d)).toEqual({ kind: 'started', activityId: 'payout-41' });
    const [sent, sig] = (d.icp.withdrawEvm as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(sent.nonce).toBe(987_654_321n);
    expect(sent.payout.deadline_ns).toBe(1_800_000_000_000_000_000n);
    expect([27, 28]).toContain(sig[64]);
    expect(d.used.add).toHaveBeenCalledWith('987654321');
  });
  it('a lost canister answer resends the same record and signature to the watcher (Review Focus 3)', async () => {
    const post = vi.fn(async () => ({ id: 43, burned: '1' }));
    const d = deps({ withdrawEvm: vi.fn(async () => { throw new TypeError('fetch failed'); }) }, post);
    expect(await run(d)).toEqual({ kind: 'started', activityId: 'payout-43' });
    expect(post).toHaveBeenCalledWith({ withdrawal: record, signature: expect.stringMatching(/^0x[0-9a-f]{130}$/) });
    expect(d.postWithdrawQuote).toHaveBeenCalledTimes(1);
  });
  it('a refusal after a lost answer says it may have gone through', async () => {
    const post = vi.fn(async () => { throw new ApiError(422, 'refused', 'nonce used', '/v2/withdraw'); });
    const d = deps({ withdrawEvm: vi.fn(async () => { throw new TypeError('fetch failed'); }) }, post);
    expect(await run(d)).toEqual({ kind: 'unknown', message: 'Your withdrawal may have gone through. It shows in Your stake in a minute.', resume: null });
  });
  it('asks for and signs only the USDC the canister names for that chain (plan check C4)', async () => {
    const d = deps();
    await run(d);
    expect(d.postWithdrawQuote).toHaveBeenCalledWith(expect.objectContaining({ tokenOut: ARB_USDC.toLowerCase() }));
    const other = deps({ getConfig: async () => ({ ...(await deps().icp.getConfig()), chains: new Map([[8453, { swapic: SWAPIC.toLowerCase() as `0x${string}`, usdc: '0x', runner: '0x', cctpReceiver: '0x', tokenMessenger: '0x' }]]) }) });
    expect(await run(other)).toEqual({ kind: 'failed', message: 'This quote could not be checked. Get a new quote and try again.' });
    expect(other.icp.withdrawEvm).not.toHaveBeenCalled();
  });
  it('a fresh record paying less than the review showed is never signed: it comes back as new terms', async () => {
    const d = deps();
    const signed = vi.spyOn(evm, 'signTypedData');
    const out = await executeWithdrawEvm({ usdc: 5_000_000n, dstChain: 'eip155:42161', evm: evm as never, onStep: () => {}, shownMinOut: 4_949_001n }, d);
    expect(out.kind).toBe('newTerms');
    expect(out.kind === 'newTerms' && out.checked.minOut).toBe(4_949_000n);
    expect(signed).not.toHaveBeenCalled();
    expect(d.icp.withdrawEvm).not.toHaveBeenCalled();
    // the same floor (or a better one) is signed as before
    expect(await executeWithdrawEvm({ usdc: 5_000_000n, dstChain: 'eip155:42161', evm: evm as never, onStep: () => {}, shownMinOut: 4_949_000n }, deps())).toEqual({ kind: 'started', activityId: 'payout-41' });
    signed.mockRestore();
  });
  it('refuses while the pool is closed, before any quote', async () => {
    const d = deps({ poolState: async () => ({ open: false, totalAssets: 1n, totalShares: 1n, tvlCap: 1n }) });
    expect(await run(d)).toEqual({ kind: 'failed', message: POOL_PAUSED });
    expect(d.postWithdrawQuote).not.toHaveBeenCalled();
  });
});
