import type { Outcome, Refund, StepsAnswer } from '@/lib/api';
import type { StepView } from '@/components/orders/types';
import { chainName, icpBlockLink, txLink } from '@/lib/explorer';
import { formatUnits } from '@/lib/money';
import { clockText, etaLeftText, short, tokenAmountText, tookText } from './format';

export { short, tokenAmountText, tookText, clockText, etaLeftText } from './format';
export { dayText } from './format';

/** A wallet step whose transaction was sent and is mining: the network is awaited, the wallet asks nothing more. The
 *  approve's (swap and stake), the stake's own, and the swap's own (its button, and its step on the source chain). */
export const APPROVING = 'Approving, waiting for the network';
export const WAITING_CONFIRMATION = 'Waiting for confirmation';
export const CONFIRMING_SWAP = 'Confirming your swap';
export const confirmingOn = (chain: string) => `Confirming on ${chain}`;

export function refundLine(r: Refund): string {
  if (r.chain === null) return 'Stake back in the pool';
  const where = `to ${short(r.receiver)} on ${chainName(r.chain)}`;
  if (r.amount === null || r.decimals === null || r.symbol === null) return `Refunded ${where}`;
  return `Refunded ${tokenAmountText(BigInt(r.amount), r.decimals, r.symbol)} ${r.symbol} ${where}`;
}

/**
 * What an order's end means (the failure messages Jeff approved, 2026-11-01, in neutral words since 2026-11-08: anyone can
 * open a Scanner link to someone else's order, so nothing here says "you" or "your"): a refund names its amount and
 * chain and says why; an order that never ran "Didn't start" (nothing left the wallet, no fee); a gasless signature the
 * network never got in time "Swap didn't start"; money the canister holds for a person's check "On hold"; an arrival that
 * could not buy the token "Delivered as USDC". Red only where money is at risk, which none of these is.
 */
export type Ending = 'pending' | 'queued' | 'delivered' | 'deliveredAsUsdc' | 'refunded' | 'didntStart' | 'notSent' | 'onHold';
export type Pill = 'delivered' | 'pending' | 'queued' | 'refunded' | 'didntStart' | 'onHold';

export interface EndInput {
  /** The activity id: an order id, or `payout-<n>` for a canister payout. */
  id: string;
  outcome: Outcome; stage: string; reasonCode: string | null; gasMode: 'gasless' | 'userPays' | null;
  /** NOT FINAL (services task S11): the canister holds this order's money for a person to resolve. */
  onHold?: boolean | null;
}

export function endingOf(x: EndInput): Ending {
  if (x.onHold === true) return 'onHold';
  if (x.outcome === 'pending') return x.stage === 'queued' ? 'queued' : 'pending';
  if (x.outcome === 'delivered') return 'delivered';
  if (x.outcome === 'refunded') return x.reasonCode === 'deliveredAsUsdc' ? 'deliveredAsUsdc' : 'refunded';
  // failed: a payout stopped for a person (the canister holds its money), or a stop for a person; any other order never ran
  if (x.id.startsWith('payout-') || x.reasonCode === 'stopped') return 'onHold';
  return x.gasMode === 'gasless' && x.reasonCode === 'expired' ? 'notSent' : 'didntStart';
}

export const pillOf = (e: Ending): Pill => (e === 'deliveredAsUsdc' ? 'delivered' : e === 'notSent' ? 'didntStart' : e);
/** Nothing left the wallet: no fee and nothing received is shown. */
export const neverRan = (e: Ending) => e === 'didntStart' || e === 'notSent';

/** The end's title (an order still moving has none). */
export function endTitle(e: Ending): string | null {
  switch (e) {
    case 'delivered': return 'Delivered';
    case 'deliveredAsUsdc': return 'Delivered as USDC';
    case 'refunded': return 'Refunded';
    case 'didntStart': return "Didn't start";
    case 'notSent': return "Swap didn't start";
    case 'onHold': return 'On hold';
    default: return null;
  }
}

const amountOf = (r: Refund | null) =>
  r && r.amount !== null && r.decimals !== null && r.symbol !== null ? `${tokenAmountText(BigInt(r.amount), r.decimals, r.symbol)} ${r.symbol}` : null;

/** The one sentence that says what happened, from the closed word only (a row's `reasonCode`, contract 5.7, 5.14); an
 *  unknown word reads as `other`. `toSymbol`: the token the swap was buying. A swap whose sender pays gas that never ran
 *  (`notSent` on Your swap, an order never seen starting by its deadline; `didntStart` on History and Your swap) names the
 *  token kept, since "nothing left the wallet" and "no fee was charged" could be untrue there; Swapic's own fee is none.
 *  Its gas line follows `sourceTx` (the sender's own transaction is on the chain): that gas is spent; with none (dropped,
 *  replaced, never sent) the swap spent no gas. */
export function endSentence(e: Ending, x: { reasonCode: string | null; refund: Refund | null; toSymbol: string | null; gasMode?: 'gasless' | 'userPays' | null; paySymbol?: string | null; sourceTx?: boolean }): string | null {
  if (e === 'didntStart' && x.gasMode === 'userPays') {
    const kept = `The ${x.paySymbol ?? 'tokens'} never left the wallet`;
    return x.sourceTx
      ? `${kept} and Swapic charged no fee. The gas paid to the network is not refunded. Get a new quote to try again.`
      : `${kept}, Swapic charged no fee, and the swap spent no gas. Get a new quote to try again.`;
  }
  if (e === 'didntStart') return 'Nothing left the wallet and no fee was charged. Get a new quote to try again.';
  if (e === 'notSent' && x.gasMode === 'userPays') return `The swap wasn't confirmed on the network in time. The ${x.paySymbol ?? 'tokens'} never left the wallet.`;
  if (e === 'notSent') return "Swapic couldn't send the swap to the network in time. Nothing left the wallet and no fee was charged.";
  if (e === 'onHold') return "The money is safe. We're checking this swap and will finish or refund it.";
  const r = x.refund;
  const amount = amountOf(r);
  const where = r?.chain ? ` on ${chainName(r.chain)}` : '';
  if (e === 'deliveredAsUsdc') return `${x.toSymbol ?? 'The token'} couldn't be bought${where}, so ${amount ?? 'USDC'} was paid instead.`;
  if (e !== 'refunded') return null;
  // an undone withdrawal: its stake came back to the pool, nothing was paid out
  if (r && r.chain === null) return 'The stake is back in the pool.';
  const back = `${amount ?? 'the money'} was returned`;
  switch (x.reasonCode) {
    case 'expired':
    case 'timedOut': return `Took too long, so ${back}${where}.`;
    case 'priceMoved': return `The price moved more than the set limit, so ${back}${where}.`;
    case 'notFilled': return `This swap couldn't be filled, so ${back}${where}.`;
    case 'poolShort': return `Swapic couldn't complete this one right now, so ${back}.`;
    default: return `This swap couldn't finish, so ${back}${where}.`;
  }
}

/** A step's short word for why it stopped (the steps list). */
function stepReason(code: string | null): string {
  switch (code) {
    case 'expired':
    case 'timedOut': return 'Took too long';
    case 'priceMoved': return 'The price moved more than the set limit';
    case 'notFilled': return "Couldn't be filled";
    case 'poolShort': return "Swapic couldn't complete it right now";
    case 'deliveredAsUsdc': return "The token couldn't be bought";
    default: return "Couldn't finish";
  }
}

type Meta = (chain: string | null, token: string | null) => { symbol: string; decimals: number } | null;

/** A deposit into ICP past Ethereum: the money reached the ck side and the mint is what the user waits for. */
const MINTING = 'Minting ckUSDC on ICP';
/** Out of ICP through the ckETH minter: it pays the recipient on Ethereum, the real time measured on its own log. */
const WITHDRAWING = 'The ckETH minter is paying USDC on Ethereum';
const WITHDRAW_TIME = 'Usually 2 to 6 minutes';

/** The steps of a record that ended delivered: every one was done, though the tracking's copy has not read them all yet (their
 *  times and links fill in when it has). Any other record's steps as they are. */
export const stepsOfDelivered = <T extends StepsAnswer>(a: T, outcome: string): T =>
  outcome === 'delivered' && a.outcome === 'pending' ? { ...a, steps: a.steps.map((r) => ({ ...r, state: 'done' as const })) } : a;

/** The steps toward the destination: a row can come with no chain of its own (a payout's on its way, or a row not recorded yet). */
const TOWARD_DESTINATION = new Set<StepsAnswer['steps'][number]['step']>(['onItsWay', 'paidOut', 'delivered']);

/** `toChain`: where the swap goes, for a row toward it that names no chain. */
export function stepViews(a: StepsAnswer, ctx: { gasMode: 'gasless' | 'userPays' | null; refund: Refund | null; token: Meta; stage?: string; toChain?: string | null }): StepView[] {
  let prev: number | null = null;
  const refundFollows = a.steps.some((s) => s.step === 'refunded');
  return a.steps.map((s, k) => {
    const chain = s.chain ?? (TOWARD_DESTINATION.has(s.step) ? ctx.toChain ?? null : null);
    const where = chain ? chainName(chain) : '';
    const amount = () => {
      const m = ctx.token(s.chain, s.token);
      return s.amount && m ? `${tokenAmountText(BigInt(s.amount), m.decimals, m.symbol)} ${m.symbol}` : null;
    };
    const label =
      s.step === 'signed' ? (a.kind === 'withdraw' ? 'Withdrawal signed' : ctx.gasMode === 'gasless' ? 'Signed, no gas' : 'Signed')
      : s.step === 'sent' ? (where ? `Sent on ${where}` : 'Sent')
      : s.step === 'onItsWay' ? (ctx.stage === 'minting' && s.state === 'wait' ? MINTING : ctx.stage === 'withdrawing' && s.state === 'wait' ? WITHDRAWING : where ? `On its way to ${where}` : 'On its way')
      : s.step === 'queued' ? 'Waiting in line'
      : s.step === 'paidOut' ? (where ? `Paid out on ${where}` : 'Paid out')
      : s.step === 'staked' ? `Staked ${amount() ?? 'USDC'}`
      : s.step === 'delivered' ? (amount() ? `Delivered ${amount()}` : 'Delivered')
      : s.step === 'refunded' && s.reason === 'deliveredAsUsdc' ? (amount() ? `Delivered ${amount()} instead` : 'Delivered as USDC')
      : s.step === 'refunded' ? (ctx.refund ? refundLine(ctx.refund) : 'Refunded')
      : refundFollows && s.reason !== 'stopped' ? stepReason(s.reason)
      : s.reason === 'stopped' ? 'On hold, we are checking it'
      : "Didn't start";
    const took = s.atMs !== null && prev !== null ? tookText(s.atMs - prev) : undefined;
    if (s.atMs !== null) prev = s.atMs;
    const tx = s.tx && s.chain ? { text: short(s.tx), href: txLink(s.chain, s.tx) }
      : s.block !== null && s.token ? { text: `block ${formatUnits(BigInt(s.block), 0)}`, href: icpBlockLink(s.token, s.block) } : undefined;
    const sub = s.step === 'onItsWay' && s.state === 'wait' ? (ctx.stage === 'minting' ? 'Takes about 20 minutes' : ctx.stage === 'withdrawing' ? WITHDRAW_TIME : undefined) : undefined;
    return { key: `${k}-${s.step}`, label, ...(sub ? { sub } : {}), state: s.state, at: s.atMs === null ? undefined : clockText(s.atMs), took: k === 0 ? undefined : took, tx };
  });
}

export function stageText(row: { kind: string; stage: string; etaAt: number | null; to: { chain: string | null } }, nowSec: number): string {
  const left = etaLeftText(row.etaAt, nowSec)?.replace(' left', '').replace('About', 'about');
  if (row.stage === 'queued') return left ? `In line, ${left}` : 'In line';
  if (row.stage === 'refunding') return 'Refunding';
  if (row.stage === 'minting') return left ? `${MINTING}, ${left}` : MINTING;
  if (row.stage === 'withdrawing') return left ? `${WITHDRAWING}, ${left}` : WITHDRAWING;
  const to = row.to.chain ? ` to ${chainName(row.to.chain)}` : '';
  return left ? `On its way${to}, ${left}` : `On its way${to}`;
}
