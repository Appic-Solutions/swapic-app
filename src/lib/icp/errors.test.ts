import { describe, expect, it } from 'vitest';
import { poolErrorMessage, stakeRoom } from './errors';

describe('poolErrorMessage', () => {
  it('works out the room left under the cap', () => {
    expect(stakeRoom({ cap: 10_000_000_000n, would_be: 10_500_000_000n }, 1_000_000_000n)).toBe(500_000_000n);
    expect(stakeRoom({ cap: 10_000_000_000n, would_be: 12_000_000_000n }, 1_000_000_000n)).toBe(0n);
  });
  it('says the cap, the rate limit and the closed pool in plain words', () => {
    expect(poolErrorMessage({ AboveTvlCap: { cap: 10_000_000_000n, would_be: 10_500_000_000n } })).toBe('The pool cannot take this much right now, try a smaller amount');
    expect(poolErrorMessage({ NotAllowed: 'past five calls a minute' })).toBe('Too many tries, wait a minute');
    expect(poolErrorMessage({ Closed: 'paused by a controller' })).toBe('The pool is paused right now');
    expect(poolErrorMessage({ Halted: null })).toBe('Swaps are paused right now');
  });
  it('never repeats the canister text', () => {
    expect(poolErrorMessage({ Ledger: 'InsufficientFunds { balance: 3 }' })).toBe('Your wallet does not hold enough for this and its fees');
    expect(poolErrorMessage({ Unavailable: 'outcall failed: eco' })).toBe('The network is busy. Try again in a minute.');
  });
});
