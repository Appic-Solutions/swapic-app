// The review page's texts (plan 2 Task 9): exactly the amounts the checks bind, from the picked option, formatted by
// @/lib/money and @/lib/copy (no Number on an amount).
import type { Quote } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { tokenAmountText } from '@/lib/copy/format';
import { formatUsd, usdMicro } from '@/lib/money';
import { walletSteps } from './execute';
import type { PickedOption } from './options';
import { routeView, isSameChainNoUsdc, type NativeCoin } from './view';

export function reviewData(i: { option: PickedOption; quote: Quote; from: UiToken; to: UiToken; amountIn: bigint; native: NativeCoin; recipient: { label: string; address: string; chain: string } }) {
  const min = i.option.route.icpSwap ? BigInt(i.option.route.icpSwap.planned.minOut) : BigInt(i.option.route.amountOutMin);
  const usd = (v: bigint, t: UiToken) => { const m = usdMicro(v, t.decimals, t.priceUsd); return m === null ? null : formatUsd(m); };
  const steps = walletSteps(i.option, i.from, i.amountIn, i.native);
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
    button: i.option.mode === 'gasless' && steps.length === 1 ? 'Sign and swap' : steps.length > 1 ? 'Approve and swap' : 'Confirm swap',
  };
}
