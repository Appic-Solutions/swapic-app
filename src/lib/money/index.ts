// Design note (money, plan 1 Task 4).
// Must never happen: an amount rounded through a JavaScript number; a displayed "at least" higher than what was
// quoted; a Max that leaves the wallet unable to pay its own fee; a USDC value of a stake computed with a different
// formula than the canister's. How the design proves it: this module is the only code that turns text into amounts
// or amounts into text, and it has no floating point anywhere (no-number.test.ts greps for it); formatting truncates
// (never rounds up), so a shown minimum is never above the true one; Max subtracts the network reserve (native coin)
// or two ledger fees (ICP: the approve and the pull); the pool formulas are the canister's and the quoter's, cited
// line by line, and pinned by the contract's own example numbers.
export * from './units';
export * from './usd';
export * from './pool';
export * from './max';
