import type { PoolError } from './declarations/swapic.did';

export class PoolErrorFailure extends Error {
  constructor(readonly err: PoolError) {
    super(Object.keys(err)[0] ?? 'PoolError');
    this.name = 'PoolErrorFailure';
  }
}

/** "You can stake up to $X right now": X = cap - (would_be - amount), floored at zero. The screen formats it. */
export function stakeRoom(err: { cap: bigint; would_be: bigint }, amount: bigint): bigint {
  const others = err.would_be - amount;
  return err.cap > others ? err.cap - others : 0n;
}

/** One plain sentence per variant (can.did PoolError); never the canister's own text. */
export function poolErrorMessage(err: PoolError): string {
  if ('AboveTvlCap' in err) return 'The pool cannot take this much right now, try a smaller amount';
  if ('NotAllowed' in err) return /minute|hour|calls/i.test(err.NotAllowed) ? 'Too many tries, wait a minute' : 'This is not allowed.';
  if ('Closed' in err) return 'The pool is paused right now';
  if ('Halted' in err) return 'Swaps are paused right now';
  if ('Sanctioned' in err) return 'This wallet cannot use Swapic.';
  if ('TokenNotListed' in err) return 'This token cannot go through the pool right now';
  if ('Ledger' in err) return /insufficient|balance/i.test(err.Ledger) ? 'Your wallet does not hold enough for this and its fees' : 'The token ledger refused this. Try again.';
  if ('Unavailable' in err) return 'The network is busy. Try again in a minute.';
  if ('Expired' in err) return 'This quote expired. Get a new one.';
  if ('ShortShares' in err) return 'Your stake changed. Try again.';
  if ('PremiumTooLow' in err || 'BadArrival' in err || 'BadRef' in err || 'Unknown' in err || 'Known' in err || 'AlreadyCredited' in err) return 'Swapic refused this request. Get a new quote and try again.';
  return 'Something went wrong, try again';
}
