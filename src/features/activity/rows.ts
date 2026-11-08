// The one view model of an activity row (contract 5.7): History, the Scanner and the pool activity draw it. Every text comes
// from the data through @/lib/money and @/lib/copy; a number that cannot be scaled is never printed.
import type { ActivityRow, Side } from '@/lib/api';
import type { SideView } from '@/components/orders/types';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { chainLogo, chainName } from '@/lib/explorer';
import { formatUsd } from '@/lib/money';
import { clockText, dayText, short, tokenAmountText, tookText } from '@/lib/copy/format';
import { endingOf, endSentence, endTitle, neverRan, pillOf, refundLine, stageText, type Ending, type Pill } from '@/lib/copy/status';

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
  id: string; kind: 'swap' | 'stake' | 'withdraw'; status: Pill; ending: Ending;
  /** The end's title (Delivered as USDC, Didn't start, On hold); null while it moves. */
  title: string | null;
  stageText: string | null; day: string; time: string; ago: string; took: string | null;
  from: SideView; to: SideView; refund: (SideView & { toText: string }) | null; refundLine: string | null;
  /** The one sentence that says what happened (a refund's amount, chain and why; Didn't start; On hold). */
  reason: string | null;
  gas: 'Gasless' | 'You paid gas' | 'No gas'; feeText: string | null; payer: string | null; recipient: string | null;
  direction: 'sent' | 'received' | 'self' | null; createdAt: number; endedAt: number | null;
  /** When it arrived, by the chain (unix s), or null (pending, or a row written before chain times). */
  deliveredAt: number | null;
  /** It went through the ck minter: History and the Scanner name that route. */
  viaMinter: boolean;
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
  const ending = endingOf(r);
  return {
    id: r.id, kind: r.kind, status: pillOf(ending), ending, title: endTitle(ending),
    stageText: pending ? stageText(r, nowSec) : null,
    day: dayText(r.createdAt * 1000, nowSec * 1000), time: clockText(r.createdAt * 1000).slice(0, 5), ago: agoText(r.createdAt, nowSec),
    took: tookOf(r),
    from: sideView(r.from, logo, false), to: sideView(r.to, logo, pending),
    refund: rf && rf.chain !== null
      ? { ...sideView({ chain: rf.chain, token: rf.token, symbol: rf.symbol, decimals: rf.decimals, amount: rf.amount, amountMin: null, wallet: rf.receiver, tx: rf.tx, block: rf.block }, logo, false), toText: short(rf.receiver) }
      : null,
    refundLine: rf ? refundLine(rf) : null,
    // the closed word only (contract 5.7 `reasonCode`); the backend's own `reason` text may name a rail and is never read
    // what a swap that never ran cost: never a Swapic fee; gas only when the person's own transaction is on the chain
    reason: endSentence(ending, { reasonCode: r.reasonCode, refund: rf, toSymbol: r.to.symbol, gasMode: r.gasMode, paySymbol: r.from.symbol, sourceTx: !!r.from.tx }),
    gas: r.gasMode === 'gasless' ? 'Gasless' : r.gasMode === 'userPays' ? 'You paid gas' : 'No gas',
    feeText: neverRan(ending) ? 'None' : r.feeUsdc === null ? null : formatUsd(BigInt(r.feeUsdc)),
    payer: r.from.wallet, recipient: r.to.wallet, direction: r.direction ?? null, createdAt: r.createdAt, endedAt: r.endedAt,
    deliveredAt: pending ? null : r.deliveredAt ?? null,
    viaMinter: r.viaMinter === true,
  };
}

/** What an order view's end draws by, for History rows, the Scanner and the order page alike. */
export interface EndFlags {
  live: boolean; refund: boolean;
  /** Delivered as USDC, with the USDC side to show. */
  asUsdc: boolean;
  /** Never ran, or held by the canister: nothing received to show. */
  stopped: boolean;
}
export const endFlags = (o: OrderView): EndFlags => ({
  live: o.status === 'pending' || o.status === 'queued',
  refund: o.ending === 'refunded',
  asUsdc: o.ending === 'deliveredAsUsdc' && !!o.refund,
  stopped: o.status === 'didntStart' || o.status === 'onHold',
});

/** The end in a few words: a moving order's stage; Staked, Paid out or Delivered with how long; else its title, with how
 *  long after a refund or a delivery as USDC. */
export function endText(o: OrderView): string {
  if (endFlags(o).live) return o.stageText ?? '';
  const took = o.took ? ` in ${o.took}` : '';
  if (o.ending === 'delivered') return `${o.kind === 'stake' ? 'Staked' : o.kind === 'withdraw' ? 'Paid out' : 'Delivered'}${took}`;
  return `${o.title ?? ''}${o.ending === 'refunded' || o.ending === 'deliveredAsUsdc' ? took : ''}`;
}

export function mergeRows(pages: ActivityRow[][]): ActivityRow[] {
  const by = new Map<string, ActivityRow>();
  for (const p of pages) for (const r of p) if (!by.has(r.id.toLowerCase())) by.set(r.id.toLowerCase(), r);
  return [...by.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** A list's refresh period: `live` while any of its rows is still in progress, else `idle`. */
export const listInterval = (rows: Pick<ActivityRow, 'outcome'>[], live: number, idle: number) => (rows.some((r) => r.outcome === 'pending') ? live : idle);

/** The token a step names, from the row's own sides (rows carry symbol and decimals, contract 5.7): stepViews' `token`. */
export const tokenMetaOf = (r: ActivityRow) => (chain: string | null, token: string | null) => {
  for (const x of [r.from, r.to, ...(r.refund ? [r.refund] : [])]) {
    if (x.chain === chain && x.token !== null && token !== null && x.token.toLowerCase() === token.toLowerCase() && x.symbol !== null && x.decimals !== null) {
      return { symbol: x.symbol, decimals: x.decimals };
    }
  }
  return null;
};
