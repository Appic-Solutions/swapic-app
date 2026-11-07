// Your swap's view (plan 2 Task 10): the phase, the steps and the words, all from the tracking answers (useActivity:
// the order or payout status and its public steps). The view never runs ahead of the data: Delivered only when the
// status says delivered, a step done only when the steps say so. One reading of the app's own: an order the tracking never
// saw start (no source transaction, no relay, no step past signing) whose deadline passed two minutes ago, and whose start
// the app did not see either (`deadline` is given only then), never ran: Swapic refuses an order past its deadline. It
// reads as "Swap didn't start" from then on, the watcher's own failed answer (300 s past the deadline) included, so the
// words never change under the person.
import type { OrderStatusAnswer, PayoutAnswer, StepRow, StepsAnswer } from '@/lib/api';
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
  /** The order's deadline (unix seconds), given only while the app has not seen it start on chain (ExecOutcome started). */
  deadline?: number | null;
}): StatusData {
  const s = i.status;
  const refund = s.refund ?? null;
  const gasMode = i.gasMode;
  const unseen = neverStarted(s, i.steps, i.deadline ?? null, i.nowSec);
  // never ran: the steps it reached (signed, for a gasless order), then its end, as the watcher's failed answer has them
  const answer = unseen ? { ...(i.steps ?? { id: i.orderId, kind: 'swap' as const }), outcome: 'failed' as const, steps: [...(i.steps?.steps ?? []).filter((r) => r.state === 'done'), NEVER_RAN] } : i.steps;
  const steps = answer ? stepViews(answer, { gasMode, refund, token: i.token, stage: s.stage }) : [];
  const rows = answer?.steps ?? [];
  const current = rows.findIndex((r) => r.state === 'wait');
  const at = rows.filter((r) => r.atMs !== null).map((r) => r.atMs!);
  // the closed word on the steps' end (contract 5.14); the status's own `reason` text is never read
  const word = rows.find((r) => r.step === 'failed' || r.step === 'refunded')?.reason ?? null;
  const ending = unseen ? 'notSent' : endingOf({ id: i.orderId, outcome: s.outcome, stage: s.stage, reasonCode: word, gasMode, onHold: s.onHold });
  const phase = PHASE[ending];
  const reason = endSentence(ending, { reasonCode: word, refund, toSymbol: i.get.symbol, gasMode, paySymbol: i.pay.symbol });
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
    // the chain the swap leaves from, the badge its pay side shows
    ringLogo: i.pay.chainLogo,
    // a you pay gas swap that never ran spent no gas on the swap itself
    to: i.toWallet, fee: neverRan(ending) ? 'None' : i.feeText, gas: unseen && gasMode === 'userPays' ? 'None' : i.gasText, orderId: i.orderId,
    totalText: phase === 'delivered' || phase === 'refunded' ? (total ? `${total} total` : '') : phase === 'progress' ? 'Updating live' : '',
  };
}

/** How long past its deadline an order nothing was seen starting reads as never started: room for a source mined at the
 *  deadline to be read at depth (the watcher waits 300 s before it answers failed, api EXPIRY_GRACE_S). */
export const NOT_SEEN_GRACE_S = 120;
const NEVER_RAN: StepRow = { step: 'failed', state: 'fail', chain: null, atMs: null, tx: null, block: null, amount: null, token: null, reason: 'expired' };

/** The order never ran: the app did not see it start (`deadline` given), its deadline passed NOT_SEEN_GRACE_S ago, and the
 *  tracking has no source transaction, no relay, no hold and no step past signing; still pending, or the watcher's own
 *  failed answer for an order that never ran (no word, or `expired`). */
export function neverStarted(s: OrderStatusAnswer | PayoutAnswer, steps: StepsAnswer | undefined, deadline: number | null, nowSec: number): boolean {
  if (deadline === null || nowSec <= deadline + NOT_SEEN_GRACE_S) return false;
  if (!('srcTx' in s) || s.srcTx || s.signedTxId != null || s.onHold === true) return false;
  const rows = steps?.steps ?? [];
  const word = rows.find((r) => r.step === 'failed' || r.step === 'refunded')?.reason ?? null;
  if (s.outcome !== 'pending' && !(s.outcome === 'failed' && (word === null || word === 'expired'))) return false;
  return !rows.some((r) => r.step !== 'signed' && r.state === 'done');
}
