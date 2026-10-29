import type { Outcome, Refund, StepsAnswer } from '@/lib/api';
import type { StepView } from '@/components/orders/types';
import { chainName, icpBlockLink, txLink } from '@/lib/explorer';
import { formatUnits } from '@/lib/money';
import { clockText, etaLeftText, short, tokenAmountText, tookText } from './format';

export { short, tokenAmountText, tookText, clockText, etaLeftText } from './format';
export { dayText } from './format';

export function refundLine(r: Refund): string {
  if (r.chain === null) return 'Your stake is back';
  const where = `to ${short(r.receiver)} on ${chainName(r.chain)}`;
  if (r.amount === null || r.decimals === null || r.symbol === null) return `Refunded ${where}`;
  return `Refunded ${tokenAmountText(BigInt(r.amount), r.decimals, r.symbol)} ${r.symbol} ${where}`;
}

/** From the closed word only (a row's `reasonCode`, a step's `reason`; contract 5.7, 5.14); an unknown word reads as `other`. */
export function reasonSentence(code: string | null, ctx: { refundChain: string | null; fromChain: string | null }): string {
  switch (code) {
    case 'expired':
    case 'timedOut': return 'The swap ran out of time';
    case 'priceMoved': return 'The price moved past your limit';
    case 'notFilled': return 'The swap could not be filled';
    case 'poolShort': return 'The pool could not pay it right now';
    case 'stopped': return 'Stopped, our team is on it';
    default: return ctx.refundChain !== null && ctx.refundChain === ctx.fromChain ? 'The swap could not be filled' : 'The swap could not finish';
  }
}

export function pillOf(outcome: Outcome, stage: string): 'delivered' | 'pending' | 'queued' | 'refunded' | 'failed' {
  if (outcome === 'pending') return stage === 'queued' ? 'queued' : 'pending';
  return outcome;
}

type Meta = (chain: string | null, token: string | null) => { symbol: string; decimals: number } | null;

export function stepViews(a: StepsAnswer, ctx: { gasMode: 'gasless' | 'userPays' | null; refund: Refund | null; token: Meta }): StepView[] {
  let prev: number | null = null;
  const refundFollows = a.steps.some((s) => s.step === 'refunded');
  return a.steps.map((s, k) => {
    const where = s.chain ? chainName(s.chain) : '';
    const amount = () => {
      const m = ctx.token(s.chain, s.token);
      return s.amount && m ? `${tokenAmountText(BigInt(s.amount), m.decimals, m.symbol)} ${m.symbol}` : null;
    };
    const label =
      s.step === 'signed' ? (a.kind === 'withdraw' ? 'Withdrawal signed' : ctx.gasMode === 'gasless' ? 'Signed, no gas' : 'Signed')
      : s.step === 'sent' ? `Sent on ${where}`
      : s.step === 'onItsWay' ? `On its way to ${where}`
      : s.step === 'queued' ? 'Waiting in line'
      : s.step === 'paidOut' ? `Paid out on ${where}`
      : s.step === 'staked' ? `Staked ${amount() ?? 'USDC'}`
      : s.step === 'delivered' ? (amount() ? `Delivered ${amount()}` : 'Delivered')
      : s.step === 'refunded' ? (ctx.refund ? refundLine(ctx.refund) : 'Refunded')
      : refundFollows && s.reason !== 'stopped' ? `Not filled: ${reasonSentence(s.reason, { refundChain: ctx.refund?.chain ?? null, fromChain: a.steps[0]?.chain ?? null }).replace(/^The /, 'the ')}`
      : 'Stopped, our team is on it';
    const took = s.atMs !== null && prev !== null ? tookText(s.atMs - prev) : undefined;
    if (s.atMs !== null) prev = s.atMs;
    const tx = s.tx && s.chain ? { text: short(s.tx), href: txLink(s.chain, s.tx) }
      : s.block !== null && s.token ? { text: `block ${formatUnits(BigInt(s.block), 0)}`, href: icpBlockLink(s.token, s.block) } : undefined;
    return { key: `${k}-${s.step}`, label, state: s.state, at: s.atMs === null ? undefined : clockText(s.atMs), took: k === 0 ? undefined : took, tx };
  });
}

export function stageText(row: { kind: string; stage: string; etaAt: number | null; to: { chain: string | null } }, nowSec: number): string {
  const left = etaLeftText(row.etaAt, nowSec)?.replace(' left', '').replace('About', 'about');
  if (row.stage === 'queued') return left ? `In line, ${left}` : 'In line';
  if (row.stage === 'refunding') return 'Refunding';
  const to = row.to.chain ? ` to ${chainName(row.to.chain)}` : '';
  return left ? `On its way${to}, ${left}` : `On its way${to}`;
}
