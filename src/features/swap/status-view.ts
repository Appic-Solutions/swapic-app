// Your swap's view (plan 2 Task 10): the phase, the steps and the words, all from the tracking answers (useActivity:
// the order or payout status and its public steps). The view never runs ahead of the data: Delivered only when the
// status says delivered, a step done only when the steps say so.
import type { OrderStatusAnswer, PayoutAnswer, StepsAnswer } from '@/lib/api';
import type { SideView, StepView } from '@/components/orders/types';
import { chainLogo, chainName } from '@/lib/explorer';
import { formatUsd } from '@/lib/money';
import { short, tokenAmountText } from '@/lib/copy/format';
import { clockText, dayText, endingOf, endSentence, endTitle, etaLeftText, neverRan, refundLine, stepViews, tookText, type Ending } from '@/lib/copy/status';

type Meta = (chain: string | null, token: string | null) => { symbol: string; decimals: number } | null;
/** The ring and the pill: moving, delivered (as USDC too), refunded, held by the canister for a check, or never ran. */
export type Phase = 'progress' | 'delivered' | 'refunded' | 'held' | 'stopped';
const PHASE: Record<Ending, Phase> = {
  pending: 'progress', queued: 'progress', delivered: 'delivered', deliveredAsUsdc: 'delivered', refunded: 'refunded', onHold: 'held', didntStart: 'stopped', notSent: 'stopped',
};
export interface StatusData {
  phase: Phase; ending: Ending; pay: SideView; get: SideView; refundText: string | null;
  /** The one sentence that says what happened (lib/copy/status endSentence). */
  reason: string | null;
  /** Where the refund went, drawn as a side (a refund with a chain; an undone withdrawal has none). */
  refund: (SideView & { toText: string }) | null;
  steps: StepView[]; when: string; title: string; text: string; ringLogo: string; to: string; fee: string; gas: string; orderId: string; totalText: string;
}

export function statusView(i: {
  status: OrderStatusAnswer | PayoutAnswer; steps: StepsAnswer | undefined; pay: SideView; get: SideView; nowSec: number;
  feeText: string; gasText: string; toWallet: string; orderId: string; token: Meta;
  /** Who paid the source's gas: the route's own mode (an ICP sale reads as gasless: the person pays no gas). */
  gasMode: 'gasless' | 'userPays';
  /** A token's logo (the refund side); defaults to the USDC logo. */
  logo?: (chain: string | null, token: string | null, symbol: string | null) => string;
}): StatusData {
  const s = i.status;
  const refund = s.refund ?? null;
  const gasMode = i.gasMode;
  const steps = i.steps ? stepViews(i.steps, { gasMode, refund, token: i.token, stage: s.stage }) : [];
  const rows = i.steps?.steps ?? [];
  const current = rows.findIndex((r) => r.state === 'wait');
  const at = rows.filter((r) => r.atMs !== null).map((r) => r.atMs!);
  // the closed word on the steps' end (contract 5.14); the status's own `reason` text is never read
  const word = rows.find((r) => r.step === 'failed' || r.step === 'refunded')?.reason ?? null;
  const ending = endingOf({ id: i.orderId, outcome: s.outcome, stage: s.stage, reasonCode: word, gasMode, onHold: s.onHold });
  const phase = PHASE[ending];
  const reason = endSentence(ending, { reasonCode: word, refund, toSymbol: i.get.symbol });
  const lastChain = rows[current >= 0 ? current : rows.length - 1]?.chain ?? null;
  // how long it took, from the chain (tookS, services d5e49ff); before chain times, from the steps' own times
  const chainTook = 'tookS' in s && typeof s.tookS === 'number' ? s.tookS : null;
  const total = chainTook !== null ? tookText(Math.max(chainTook, 0) * 1000) : at.length > 1 ? tookText(at[at.length - 1]! - at[0]!) : '';
  // when it started, by the chain when known
  const startedMs = 'startedAt' in s && typeof s.startedAt === 'number' ? s.startedAt * 1000 : at[0] ?? null;
  return {
    phase, ending, pay: i.pay, get: i.get,
    refundText: refund ? refundLine(refund) : null,
    refund: refund && refund.chain !== null && refund.amount !== null && refund.decimals !== null && refund.symbol !== null
      ? {
          symbol: refund.symbol, chain: chainName(refund.chain), chainLogo: chainLogo(refund.chain),
          logo: i.logo ? i.logo(refund.chain, refund.token, refund.symbol) : '/images/tokens/usdc.png',
          amountText: tokenAmountText(BigInt(refund.amount), refund.decimals, refund.symbol),
          usdText: /USD/.test(refund.symbol) ? formatUsd((BigInt(refund.amount) * 1_000_000n) / 10n ** BigInt(refund.decimals)) : '',
          toText: short(refund.receiver),
        }
      : null,
    reason,
    steps,
    when: startedMs ? `${dayText(startedMs, i.nowSec * 1000)}, ${clockText(startedMs).slice(0, 5)}` : '',
    title: phase === 'progress' ? steps[current]?.label ?? 'On its way' : endTitle(ending) ?? '',
    // under the ring: how long it took, where a refund went, or (held, never ran) what happened
    text: phase === 'delivered' ? `Arrived in ${total}` : phase === 'refunded' ? (refund ? refundLine(refund) : reason ?? '')
      : phase === 'progress' ? etaLeftText(('etaAt' in s ? s.etaAt : s.queue?.etaAt) ?? null, i.nowSec) ?? 'Updating live' : reason ?? '',
    ringLogo: lastChain ? chainLogo(lastChain) : '/images/landing/logo/swapic-logo.svg',
    to: i.toWallet, fee: neverRan(ending) ? 'None' : i.feeText, gas: i.gasText, orderId: i.orderId,
    totalText: phase === 'delivered' || phase === 'refunded' ? (total ? `${total} total` : '') : phase === 'progress' ? 'Updating live' : '',
  };
}
