// The one view model of an activity row (contract 5.7): History, the Scanner and the pool activity draw it. Every text comes
// from the data through @/lib/money and @/lib/copy; a number that cannot be scaled is never printed.
import type { ActivityRow, Side } from '@/lib/api';
import type { SideView } from '@/components/orders/types';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { chainLogo, chainName } from '@/lib/explorer';
import { formatUsd } from '@/lib/money';
import { clockText, dayText, short, tokenAmountText, tookText } from '@/lib/copy/format';
import { pillOf, reasonSentence, refundLine, stageText } from '@/lib/copy/status';

export type LogoFor = (chain: string | null, token: string | null, symbol: string | null) => string;
const STABLE = new Set(['USDC', 'USDT', 'ckUSDC', 'ckUSDT']);

function sideView(s: Side, logo: LogoFor, pending: boolean): SideView {
  const pool = s.chain === null;
  const symbol = s.symbol ?? (s.token ? short(s.token) : 'USDC');
  const raw = s.amount ?? (pending ? s.amountMin : null);
  const known = raw !== null && s.decimals !== null && s.symbol !== null;
  const amountText = known ? `${s.amount === null ? '~' : ''}${tokenAmountText(BigInt(raw!), s.decimals!, s.symbol!)}` : '';
  const usdText = known && STABLE.has(s.symbol!) ? formatUsd(BigInt(raw!) * 10n ** 6n / 10n ** BigInt(s.decimals!)) : '';
  return {
    symbol, amountText, usdText,
    chain: pool ? 'Swapic Pool' : chainName(s.chain!),
    logo: logo(s.chain, s.token, s.symbol),
    chainLogo: pool ? SWAPIC_LOGO : chainLogo(s.chain!),
  };
}

export interface OrderView {
  id: string; kind: 'swap' | 'stake' | 'withdraw'; status: 'delivered' | 'pending' | 'queued' | 'refunded' | 'failed';
  stageText: string | null; day: string; time: string; ago: string; took: string | null;
  from: SideView; to: SideView; refund: (SideView & { toText: string }) | null; refundLine: string | null; reason: string | null;
  gas: 'Gasless' | 'You paid gas' | 'No gas'; feeText: string | null; payer: string | null; recipient: string | null;
  direction: 'sent' | 'received' | 'self' | null; createdAt: number; endedAt: number | null;
  /** When it arrived, by the chain (unix s), or null (pending, or a row written before chain times). */
  deliveredAt: number | null;
}

function agoText(createdAt: number, nowSec: number): string {
  const s = Math.max(nowSec - createdAt, 0);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} days ago`;
}

/**
 * How long it took, from the chain (services d5e49ff): tookS when it is a number; for a row written before chain times
 * (deliveredAt and tookS both null, endedAt set) the watcher's endedAt - createdAt; nothing while it is pending.
 */
export function tookOf(r: Pick<ActivityRow, 'outcome' | 'createdAt' | 'endedAt' | 'deliveredAt' | 'tookS'>): string | null {
  if (r.outcome === 'pending') return null;
  if (typeof r.tookS === 'number') return tookText(Math.max(r.tookS, 0) * 1000);
  const before = (r.deliveredAt ?? null) === null && (r.tookS ?? null) === null && r.endedAt !== null;
  return before ? tookText((r.endedAt! - r.createdAt) * 1000) : null;
}

export function orderView(raw: ActivityRow, nowSec: number, logo: LogoFor): OrderView {
  // a stake's `to` is always the pool side (contract 5.7), whatever an older backend wrote there (plan check row 26)
  const r: ActivityRow = raw.kind === 'stake' ? { ...raw, to: { ...raw.to, chain: null, token: null, symbol: 'USDC', decimals: 6 } } : raw;
  const pending = r.outcome === 'pending';
  const rf = r.refund;
  return {
    id: r.id, kind: r.kind, status: pillOf(r.outcome, r.stage),
    stageText: pending ? stageText(r, nowSec) : null,
    day: dayText(r.createdAt * 1000, nowSec * 1000), time: clockText(r.createdAt * 1000).slice(0, 5), ago: agoText(r.createdAt, nowSec),
    took: tookOf(r),
    from: sideView(r.from, logo, false), to: sideView(r.to, logo, pending),
    refund: rf && rf.chain !== null
      ? { ...sideView({ chain: rf.chain, token: rf.token, symbol: rf.symbol, decimals: rf.decimals, amount: rf.amount, amountMin: null, wallet: rf.receiver, tx: rf.tx, block: rf.block }, logo, false), toText: short(rf.receiver) }
      : null,
    refundLine: rf ? refundLine(rf) : null,
    // the closed word only (contract 5.7 `reasonCode`); the backend's own `reason` text may name a rail and is never read
    reason: r.outcome === 'refunded' || r.outcome === 'failed' ? reasonSentence(r.reasonCode, { refundChain: rf?.chain ?? null, fromChain: r.from.chain }) : null,
    gas: r.gasMode === 'gasless' ? 'Gasless' : r.gasMode === 'userPays' ? 'You paid gas' : 'No gas',
    feeText: r.feeUsdc === null ? null : formatUsd(BigInt(r.feeUsdc)),
    payer: r.from.wallet, recipient: r.to.wallet, direction: r.direction ?? null, createdAt: r.createdAt, endedAt: r.endedAt,
    deliveredAt: pending ? null : r.deliveredAt ?? null,
  };
}

export function mergeRows(pages: ActivityRow[][]): ActivityRow[] {
  const by = new Map<string, ActivityRow>();
  for (const p of pages) for (const r of p) if (!by.has(r.id.toLowerCase())) by.set(r.id.toLowerCase(), r);
  return [...by.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** The token a step names, from the row's own sides (rows carry symbol and decimals, contract 5.7): stepViews' `token`. */
export const tokenMetaOf = (r: ActivityRow) => (chain: string | null, token: string | null) => {
  for (const x of [r.from, r.to, ...(r.refund ? [r.refund] : [])]) {
    if (x.chain === chain && x.token !== null && token !== null && x.token.toLowerCase() === token.toLowerCase() && x.symbol !== null && x.decimals !== null) {
      return { symbol: x.symbol, decimals: x.decimals };
    }
  }
  return null;
};
