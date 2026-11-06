import type { Fees, Quote } from '@/lib/api';
import type { RouteOptionView } from '@/components/design/RouteOption';
import type { UiToken } from '@/components/ui/token-types';
import { dollarsToMicro, formatAmount, formatUsd, parseDecimal, usdMicro } from '@/lib/money';
import type { PickedOption } from './options';

export interface NativeCoin {
  symbol: string;
  decimals: number;
  priceUsd: string | null;
  /** False when the wallet holds none of the coin on the From chain; null or absent when unknown (no wallet, still loading). */
  held?: boolean | null;
}

/** The gasless card's line under the amount (Jeff 2026-11-04): a wallet with none of the From chain's coin is told it
 *  needs none; any other wallet reads "Just sign". Only EVM sources: an ICP wallet pays no gas coin anyway. */
export function gaslessNote(p: PickedOption, from: UiToken, native: NativeCoin): string | undefined {
  if (p.mode === 'userPays' || from.chain_type !== 'EVM' || !native.symbol) return undefined;
  return native.held === false ? `You have no ${native.symbol} on ${from.chainName}. Gasless works anyway` : `Just sign, no ${native.symbol} needed`;
}

/** The design's gas row: the user's gas in the source chain's coin. The quote gives it in dollars (`userGasUsd`,
 *  answer/mod.rs:440-443); it is turned into the coin at the coin's price: wei = microUsd * 10^(decimals + 12) / priceE18. */
export function gasText(p: PickedOption, native: NativeCoin): string {
  if (p.mode === 'icpPull') return 'None';
  if (p.mode === 'gasless') return 'None, Swapic pays it';
  const usd = p.route.userGasUsd;
  if (!usd || native.priceUsd === null) return 'You pay it';
  const price = parseDecimal(native.priceUsd, 18);
  if (price === 0n) return 'You pay it';
  const amount = (dollarsToMicro(usd) * 10n ** BigInt(native.decimals + 12)) / price;
  return `~ ${formatAmount(amount, native.decimals)} ${native.symbol}, you pay it`;
}

/** Every fee line in micro USDC (answer/mod.rs:166-195). `platform` is in the output token on a same chain swap with no USDC side. */
export function sumFees(f: Fees, platformInTokenOut?: { decimals: number; priceUsd: string | null }): bigint {
  const lines = [f.network, f.bridge, f.premium, f.icpFees, f.moveFee].reduce((a, x) => a + (x ? BigInt(x) : 0n), 0n);
  const platform = BigInt(f.platform);
  if (!platformInTokenOut) return lines + platform;
  return lines + (usdMicro(platform, platformInTokenOut.decimals, platformInTokenOut.priceUsd) ?? 0n);
}

export function etaText(seconds: number): string {
  return seconds < 90 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`;
}

/** "You get about $X less than you pay" when the quoter flags a big impact (shown once Jeff approves SwapPriceImpactScreen). */
function impactWarning(p: PickedOption, ctx: { from: UiToken; to: UiToken; amountIn: bigint }): string | undefined {
  const w = p.route.warnings;
  if (!w.includes('highPriceImpact') && !w.includes('severePriceImpact')) return undefined;
  const usdIn = usdMicro(ctx.amountIn, ctx.from.decimals, ctx.from.priceUsd);
  const usdOut = usdMicro(BigInt(p.route.amountOut), ctx.to.decimals, ctx.to.priceUsd);
  if (usdIn === null || usdOut === null || usdOut >= usdIn) return undefined;
  return `You get about ${formatUsd(usdIn - usdOut)} less than you pay`;
}

export function routeView(p: PickedOption, ctx: { from: UiToken; to: UiToken; amountIn: bigint; sameChainNoUsdc: boolean; native: NativeCoin }): RouteOptionView {
  const r = p.route;
  const amountOut = BigInt(r.amountOut);
  const usdOut = usdMicro(amountOut, ctx.to.decimals, ctx.to.priceUsd);
  const fee = sumFees(r.fees, ctx.sameChainNoUsdc ? { decimals: ctx.to.decimals, priceUsd: ctx.to.priceUsd } : undefined);
  return {
    key: p.key,
    tags: p.tags,
    gasless: p.mode !== 'userPays',
    durationText: etaText(r.etaSeconds),
    amountOutText: formatAmount(amountOut, ctx.to.decimals),
    minOutText: `${formatAmount(BigInt(r.amountOutMin), ctx.to.decimals)} ${ctx.to.symbol}`,
    usdOutText: usdOut === null ? null : formatUsd(usdOut),
    totalFeeText: formatUsd(fee),
    gasText: gasText(p, ctx.native),
    gaslessNote: gaslessNote(p, ctx.from, ctx.native),
    warning: impactWarning(p, ctx),
    viaMinter: r.routeId.split('+').includes('ckMinter'),
  };
}

export const isSameChainNoUsdc = (q: Quote, usdcOfChain: string | undefined) =>
  q.fromChain === q.toChain && !!usdcOfChain && q.fromToken.address.toLowerCase() !== usdcOfChain.toLowerCase() && q.toToken.address.toLowerCase() !== usdcOfChain.toLowerCase();
