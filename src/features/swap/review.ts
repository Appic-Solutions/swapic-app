// The review page's texts (plan 2 Task 9): exactly the amounts the checks bind, from the picked option, formatted by
// @/lib/money and @/lib/copy (no Number on an amount).
import type { Quote } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { tokenAmountText } from '@/lib/copy/format';
import { formatUsd, usdMicro } from '@/lib/money';
import { walletSteps } from './execute';
import { minOutOf, type PickedOption } from './options';
import { approveState, routeView, isSameChainNoUsdc, type NativeCoin } from './view';

/** The least the route pays out, as the checks bind it (an ICP sale's planned minimum, else amountOutMin). */
export { minOutOf };

/**
 * Review swap's 20 s refresh (approved 2026-10-31): the fresh quote's option with the same tag against the least out on
 * screen. The same or more out updates quietly; less out is a new price (the note and "Accept new price"); no such option
 * leaves the review as it is.
 */
export function reviewRefresh(shownMin: bigint, fresh: PickedOption | undefined): { kind: 'quiet' | 'newPrice'; option: PickedOption } | { kind: 'none' } {
  if (!fresh) return { kind: 'none' };
  return { kind: minOutOf(fresh) >= shownMin ? 'quiet' : 'newPrice', option: fresh };
}

export function reviewData(i: { option: PickedOption; quote: Quote; from: UiToken; to: UiToken; amountIn: bigint; native: NativeCoin; recipient: { label: string; address: string; chain: string } }) {
  const min = minOutOf(i.option);
  const usd = (v: bigint, t: UiToken) => { const m = usdMicro(v, t.decimals, t.priceUsd); return m === null ? null : formatUsd(m); };
  const steps = walletSteps(i.option, i.from, i.amountIn, i.native);
  // the named route can ask an approve the list did not: no coin to pay it, nothing to sign yet
  const blocked = approveState(i.option, i.native) === 'noCoin';
  return {
    payText: `${tokenAmountText(i.amountIn, i.from.decimals, i.from.symbol)} ${i.from.symbol}`,
    payUsd: usd(i.amountIn, i.from),
    minText: `${tokenAmountText(min, i.to.decimals, i.to.symbol)} ${i.to.symbol}`,
    minUsd: usd(min, i.to),
    min,
    option: routeView(i.option, { from: i.from, to: i.to, amountIn: i.amountIn, sameChainNoUsdc: isSameChainNoUsdc(i.quote, undefined), native: i.native }),
    steps,
    recipient: i.recipient,
    refundAs: i.from.chain_type === 'ICP' ? 'ckUSDC' : 'USDC',
    blocked,
    button: blocked ? `Add ${i.native.symbol} to continue` : i.option.mode === 'gasless' && steps.length === 1 ? 'Sign and swap' : steps.length > 1 ? 'Approve and swap' : 'Confirm swap',
  };
}
