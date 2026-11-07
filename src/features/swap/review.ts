// The review page's texts (plan 2 Task 9): exactly the amounts the checks bind, from the picked option, formatted by
// @/lib/money and @/lib/copy (no Number on an amount).
import type { Quote } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { tokenAmountText } from '@/lib/copy/format';
import { formatUsd, usdMicro } from '@/lib/money';
import { walletSteps } from './execute';
import { minOutOf, shownMinOf, type PickedOption } from './options';
import { approveState, routeView, isSameChainNoUsdc, type NativeCoin } from './view';

/** The least the route pays out, as the checks bind it (an ICP sale's planned minimum, else amountOutMin). */
export { minOutOf };

/**
 * Review swap's 20 s refresh (approved 2026-10-31): the fresh quote's option with the same tag against the least out on
 * screen, which sits a small cushion under the quote's own least (shownMinOf). A fresh least at or above the screen's
 * updates quietly, even when it is a few units under the last quote's; below the screen's is a new price (the note and
 * "Accept new price"); no such option leaves the review as it is.
 */
export function reviewRefresh(shownMin: bigint, fresh: PickedOption | undefined): { kind: 'quiet' | 'newPrice'; option: PickedOption } | { kind: 'none' } {
  if (!fresh) return { kind: 'none' };
  return { kind: minOutOf(fresh) >= shownMin ? 'quiet' : 'newPrice', option: fresh };
}

/**
 * The "You get at least" for a route: its own least less the cushion, or `kept` (the one already on screen) when the route
 * still pays that and its own is not higher. A quiet refresh never lowers the number the person saw.
 */
export function shownMin(option: PickedOption, kept?: bigint): bigint {
  const own = shownMinOf(option);
  return kept !== undefined && kept > own && kept <= minOutOf(option) ? kept : own;
}

export function reviewData(i: { option: PickedOption; quote: Quote; from: UiToken; to: UiToken; amountIn: bigint; native: NativeCoin; recipient: { label: string; address: string; chain: string }; kept?: bigint }) {
  const min = shownMin(i.option, i.kept);
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
    option: routeView(i.option, { from: i.from, to: i.to, amountIn: i.amountIn, sameChainNoUsdc: isSameChainNoUsdc(i.quote, undefined), native: i.native, min }),
    steps,
    recipient: i.recipient,
    refundAs: i.from.chain_type === 'ICP' ? 'ckUSDC' : 'USDC',
    blocked,
    button: blocked ? `Add ${i.native.symbol} to continue` : i.option.mode === 'gasless' && steps.length === 1 ? 'Sign and swap' : steps.length > 1 ? 'Approve and swap' : 'Confirm swap',
  };
}
