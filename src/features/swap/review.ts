// The review page's texts (plan 2 Task 9): exactly the amounts the checks bind, from the picked option, formatted by
// @/lib/money and @/lib/copy (no Number on an amount).
import type { Quote, Route } from '@/lib/api';
import { BSC_CHAIN, chainRow } from '@/lib/chains';
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
 * The "If it can't finish" rows (Jeff's short rows, 2026-11-09): an Across route names what comes back and where, at
 * least the order's own minimums (the check refuses a route whose answer says otherwise); a swap on BNB Chain alone
 * reverts and keeps the person's token; every other route keeps today's row. An ICP sale paid out through Across names
 * only its last swap's fallback: an unfilled deposit is refunded on ICP, as today.
 */
export function refundRows(route: Route, quote: Quote, from: UiToken): { k: string; text: string }[] {
  const icp = from.chain_type === 'ICP';
  const plain = [{ k: "If it can't finish", text: `Refunded as ${icp ? 'ckUSDC' : 'USDC'}` }];
  const all = route.fallbacks ?? [];
  const notFilled = icp ? undefined : all.find((f) => f.when === 'notFilled');
  const lastSwap = all.find((f) => f.when === 'lastSwapFails');
  const place = (f: NonNullable<typeof lastSwap>) =>
    `${f.symbol} on ${chainRow(f.chain)?.name ?? f.chain}, at least ${tokenAmountText(BigInt(f.min), f.decimals, f.symbol)}`;
  try {
    if (icp && lastSwap) return [{ k: 'If the last swap fails', text: `All as ${place(lastSwap)}` }, { k: "If it can't be delivered", text: 'Refunded as ckUSDC' }];
    if (icp) return plain;
    if (notFilled && lastSwap) return [{ k: 'If the last swap fails', text: `All as ${place(lastSwap)}` }, { k: "If it can't be delivered", text: `Back as ${place(notFilled)}` }];
    if (notFilled) return [{ k: "If it can't finish", text: `Back to you as ${place(notFilled)}` }];
  } catch {
    // an amount that is no number: the check refuses the route before anything is signed
    return plain;
  }
  if (quote.fromChain === BSC_CHAIN && quote.toChain === BSC_CHAIN) return [{ k: "If it can't finish", text: `Nothing happens, you keep your ${from.symbol}` }];
  return plain;
}

/** The same wallet steps, in the same places: the list's states are read by position, so any other list starts over. */
export const sameSteps = (a: { label: string }[], b: { label: string }[]) => a.length === b.length && a.every((s, k) => s.label === b[k]!.label);

/**
 * The review of a route. Its "You get at least" is the route's own least, cushioned (shownMinOf): a quiet refresh shows the
 * fresh quote's, up or down (at most 0.05% under that quote's least), so the cushion always stands against the latest
 * quote, and the check at confirm compares against the number on screen at that moment.
 */
export function reviewData(i: {
  option: PickedOption; quote: Quote; from: UiToken; to: UiToken; amountIn: bigint; native: NativeCoin; recipient: { label: string; address: string; chain: string };
  /** The priced route of a payer who may pay through Permit2, its named quote still to come: which steps it asks is not
   *  known yet (the priced answer says nothing of them), so none is claimed, and the wallet list waits. */
  pending?: boolean;
}) {
  const min = shownMinOf(i.option);
  const usd = (v: bigint, t: UiToken) => { const m = usdMicro(v, t.decimals, t.priceUsd); return m === null ? null : formatUsd(m); };
  const steps = i.pending ? [] : walletSteps(i.option, i.from, i.amountIn, i.native);
  // the named route can ask an approve the list did not: no coin to pay it, nothing to sign yet
  const blocked = approveState(i.option, i.native) === 'noCoin';
  // no approve before the signature: the only step on gasless, the first of two through Permit2
  const signsFirst = steps.length === (i.option.mode === 'gasless' ? 1 : 2) && (i.option.mode === 'gasless' || !!i.option.route.permit2Pay);
  const option = routeView(i.option, { from: i.from, to: i.to, amountIn: i.amountIn, sameChainNoUsdc: isSameChainNoUsdc(i.quote, undefined), native: i.native });
  return {
    payText: `${tokenAmountText(i.amountIn, i.from.decimals, i.from.symbol)} ${i.from.symbol}`,
    payUsd: usd(i.amountIn, i.from),
    // one number in one format: the route card's row says the same
    minText: option.minOutText,
    minUsd: usd(min, i.to),
    min,
    option,
    steps,
    recipient: i.recipient,
    refundRows: refundRows(i.option.route, i.quote, i.from),
    blocked,
    pending: !!i.pending,
    button: i.pending ? 'Getting your swap ready' : blocked ? `Add ${i.native.symbol} to continue` : signsFirst ? 'Sign and swap' : steps.length > 1 ? 'Approve and swap' : 'Confirm swap',
  };
}
