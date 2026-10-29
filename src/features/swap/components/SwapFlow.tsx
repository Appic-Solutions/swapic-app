'use client';
// The Swap panel that changes in place (the approved prototype, design swap-flow.tsx, Jeff 2026-10-29): Swap, Review swap
// and Your swap share one frame (MorphFrame). Review swap: the routes not picked fade, the picked route card glides into
// its review spot; Back reverses. Sign: the button turns into "Confirm in your wallet" with the soft glow while the wallet
// asks and the step lights up; a "no" returns the button with "You cancelled in your wallet."; once the swap has started
// the same frame turns into Your swap (the card shrinks into the status circle) and every step, the ring and the end
// (Delivered or Refunded) follow the real tracking (useActivity). The motion never runs ahead of the data and never holds
// a money action: a click acts at once, the animation is decoration.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { UiToken } from '@/components/ui/token-types';
import type { SideView, StepView } from '@/components/orders/types';
import { Note } from '@/components/design/Note';
import { ClockIcon } from '@/components/icons';
import { MorphFrame } from '@/components/motion/parts';
import { AlertTriangle } from 'lucide-react';
import { getOrders, getQuote, submitGasless, type OrderStatusAnswer, type PayoutAnswer } from '@/lib/api';
import { tokenAmountText } from '@/lib/copy/format';
import { chainLogo, chainName } from '@/lib/explorer';
import { icpClient } from '@/lib/icp';
import { formatUsd, parseUnits, usdMicro } from '@/lib/money';
import { MS, useFirstRender, useReducedMotion } from '@/lib/motion';
import { useEvmSigner, useIcpCaller } from '@/lib/wallets';
import { useLogoFor } from '@/features/activity/logos';
import { useActivity } from '@/features/activity/track';
import { executeSwap, type ExecOutcome } from '../execute';
import { useSwapForm } from '../form';
import { reviewData } from '../review';
import { statusView, type StatusData } from '../status-view';
import { gasText, sumFees } from '../view';
import { ReviewPanel } from './ReviewPanel';
import { SwapPanel, type ReviewStart } from './SwapPanel';
import { SwapStatus } from './SwapStatus';

export type FlowView = 'swap' | 'review' | 'status';

/** How full the ring is at most while the swap moves (it closes only when the status says it ended). */
const RING_MOVING = 0.85;
const TOO_MANY = new Set(['Too many tries, wait a minute', 'Too many requests. Wait a minute and try again.']);

interface Review extends ReviewStart {
  from: UiToken; to: UiToken; recipient: string; recipientLabel: string; shownMin: bigint;
  data: ReturnType<typeof reviewData>;
  /** The price moved before signing: the minimum shown before, struck through. */
  wasMinText?: string;
}

const sideOf = (t: UiToken, amount: bigint, prefix = ''): SideView => {
  const usd = usdMicro(amount, t.decimals, t.priceUsd);
  return { symbol: t.symbol, logo: t.logo, chain: chainName(t.chain), chainLogo: chainLogo(t.chain), amountText: `${prefix}${tokenAmountText(amount, t.decimals, t.symbol)}`, usdText: usd === null ? '' : formatUsd(usd) };
};

export function SwapFlow({ view, setView, onPick }: { view: FlowView; setView: (v: FlowView) => void; onPick: (side: 'from' | 'to') => void }) {
  const router = useRouter();
  const f = useSwapForm();
  const signer = useEvmSigner();
  const caller = useIcpCaller();
  const logo = useLogoFor();
  const reduced = useReducedMotion();
  const first = useFirstRender();
  const [rv, setRv] = React.useState<Review | null>(null);
  const [states, setStates] = React.useState<StepView['state'][] | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: 'yellow' | 'blue'; text: string; clock?: boolean } | null>(null);
  const [resume, setResume] = React.useState<(() => Promise<ExecOutcome>) | null>(null);
  const [waitUntil, setWaitUntil] = React.useState<number | null>(null);
  const [activity, setActivity] = React.useState<{ id: string; startedSec: number } | null>(null);
  const [glide, setGlide] = React.useState(false);
  const [run, setRun] = React.useState(0);
  // The review's route card: Your swap shrinks a copy of it into the status circle.
  const routeRef = React.useRef<HTMLDivElement>(null);

  // a "too many tries" pause: the button comes back after a minute
  React.useEffect(() => {
    if (waitUntil === null) return;
    const t = setTimeout(() => { setWaitUntil(null); setNote(null); }, Math.max(0, waitUntil - Date.now()));
    return () => clearTimeout(t);
  }, [waitUntil]);

  const start = (s: ReviewStart) => {
    if (!f.from || !f.to || !s.query.recipient) return;
    const recipientLabel = f.recipient.show ? 'Wallet you entered' : f.to.chain_type === 'ICP' ? 'Your ICP wallet' : 'Your EVM wallet';
    const data = reviewData({ option: s.option, quote: s.quote, from: f.from, to: f.to, amountIn: s.amountIn, native: s.native, recipient: { label: recipientLabel, address: s.query.recipient, chain: f.to.chain } });
    setRv({ ...s, from: f.from, to: f.to, recipient: s.query.recipient, recipientLabel, shownMin: data.min, data });
    setStates(undefined);
    setCancelled(false);
    setNote(null);
    setResume(null);
    setView('review');
  };

  const handle = (out: ExecOutcome) => {
    setBusy(false);
    setResume(null);
    if (out.kind === 'started') {
      // a short hold for the last check to draw, then Your swap (the swap has started: nothing waits on this)
      const id = out.activityId;
      setTimeout(() => {
        setActivity({ id, startedSec: Math.floor(Date.now() / 1000) });
        setGlide(true);
        setRun((r) => r + 1);
        setView('status');
      }, MS.hold);
      return;
    }
    if (out.kind === 'rejected') {
      setStates((s) => s?.map((x) => (x === 'wait' ? 'todo' : x)));
      setCancelled(true);
      return;
    }
    if (out.kind === 'newPrice' && rv) {
      const data = reviewData({ option: out.option, quote: out.quote, from: rv.from, to: rv.to, amountIn: rv.amountIn, native: rv.native, recipient: rv.data.recipient });
      setRv({ ...rv, option: out.option, quote: out.quote, data, wasMinText: rv.data.minText });
      setStates(undefined);
      setNote({ tone: 'yellow', text: `The price moved. You now get at least ${data.minText}${data.minUsd ? ` (${data.minUsd})` : ''}.` });
      return;
    }
    if (out.kind === 'failed') {
      if (TOO_MANY.has(out.message)) {
        setWaitUntil(Date.now() + 60_000);
        // the design's TooManyTriesScreen: the steps as they were, the clock note, the button back in a minute
        setStates((s) => s?.map((x) => (x === 'fail' || x === 'wait' ? 'todo' : x)));
        setNote({ tone: 'yellow', text: 'Too many tries, wait a minute.', clock: true });
      } else setNote({ tone: 'yellow', text: out.message });
      return;
    }
    if (out.kind === 'unknown') {
      setNote({ tone: 'blue', text: out.message });
      if (out.resume) setResume(() => out.resume);
    }
  };

  const sign = async () => {
    if (!rv || busy || waitUntil !== null) return;
    setCancelled(false);
    setNote(null);
    setBusy(true);
    if (resume) { handle(await resume()); return; }
    // a new price accepted: the minimum on screen is the new one
    const shownMin = rv.wasMinText ? rv.data.min : rv.shownMin;
    if (rv.wasMinText) setRv({ ...rv, shownMin, wasMinText: undefined });
    setStates(rv.data.steps.map(() => 'todo'));
    handle(await executeSwap(
      {
        query: rv.query, tag: rv.option.tags[0]!, shownMin, amountIn: rv.amountIn, from: rv.from, to: rv.to, recipient: rv.recipient,
        evm: signer, icpCaller: caller,
        onStep: (i, st) => setStates((s) => (s ?? rv.data.steps.map(() => 'todo' as const)).map((x, j) => (j === i ? st : x))),
        onNote: (text) => setNote({ tone: 'blue', text }),
      },
      { getQuote, getOrders, submitGasless, icp: icpClient(), nowMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    ));
  };

  // Back to the Swap panel in place. After a swap (fresh) the tokens and amount stay and the first route is picked.
  const toSwap = (fresh: boolean) => {
    setStates(undefined);
    setCancelled(false);
    setNote(null);
    setResume(null);
    if (fresh) { f.set({ tag: 'Gasless' }); setActivity(null); setGlide(false); }
    setView('swap');
  };

  // Phones: a new view starts at the top of the page.
  const viewKey = view === 'status' ? `status-${run}` : view;
  React.useEffect(() => {
    if (first || typeof window === 'undefined' || window.scrollY === 0) return;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // the panel is wide once the route column shows (tokens and an amount), and on Review swap and Your swap
  let typed = false;
  try { typed = !!f.from && !!f.to && parseUnits(f.amountText, f.from.decimals) > 0n; } catch { typed = false; }
  const wide = view !== 'swap' || typed;
  const waiting = busy && !!states?.some((s) => s === 'wait');

  return (
    <MorphFrame view={viewKey} wide={wide}>
      {(v) =>
        v === 'swap' ? (
          <SwapPanel onPick={onPick} onReview={start} />
        ) : v === 'review' && rv ? (
          <ReviewPanel
            data={rv.data} pay={sideOf(rv.from, rv.amountIn)} get={sideOf(rv.to, rv.data.min)} toToken={{ symbol: rv.to.symbol, logo: rv.to.logo }}
            states={states} waiting={waiting || (busy && !note)} cancelled={cancelled} routeRef={routeRef}
            wasMinText={rv.wasMinText}
            disabled={waitUntil !== null}
            button={waitUntil !== null ? 'Try again in a minute' : rv.wasMinText ? 'Accept new price' : resume ? 'Try again' : undefined}
            note={note ? (
              <Note tone={note.tone} icon={note.tone === 'blue' || note.clock ? <ClockIcon width={18} height={18} /> : <AlertTriangle className="h-[18px] w-[18px]" />}>{note.text}</Note>
            ) : undefined}
            onBack={() => toSwap(false)}
            onSign={() => void sign()}
          />
        ) : v.startsWith('status') && rv && activity ? (
          <StatusView rv={rv} activity={activity} logo={logo} routeRef={glide ? routeRef : undefined} onNew={() => toSwap(true)} onHistory={() => router.push('/history')} />
        ) : null
      }
    </MorphFrame>
  );
}

/** Your swap, from the real tracking. */
function StatusView({ rv, activity, logo, routeRef, onNew, onHistory }: {
  rv: Review; activity: { id: string; startedSec: number }; logo: ReturnType<typeof useLogoFor>;
  routeRef?: React.RefObject<HTMLDivElement | null>; onNew: () => void; onHistory: () => void;
}) {
  const { status, steps } = useActivity(activity.id);
  const nowSec = Math.floor(Date.now() / 1000);
  const route = rv.option.route;
  const expected = route.icpSwap ? BigInt(route.icpSwap.planned.expectedOut) : BigInt(route.amountOut);
  const delivered = steps?.steps.find((s) => s.step === 'delivered' && s.amount !== null)?.amount ?? null;
  const ended = status && status.outcome !== 'pending';
  const get = ended && status.outcome === 'delivered' ? sideOf(rv.to, delivered !== null ? BigInt(delivered) : expected) : sideOf(rv.to, expected, '~');
  const pay = sideOf(rv.from, rv.amountIn);
  const gas = rv.option.mode === 'gasless' ? 'None, Swapic paid it' : rv.option.mode === 'icpPull' ? 'None' : gasText(rv.option, rv.native).replace('you pay it', 'you paid it');
  const fee = formatUsd(sumFees(route.fees));
  const token = (chain: string | null, address: string | null) => {
    for (const t of [rv.from, rv.to]) if (t.chain === chain && address !== null && t.address.toLowerCase() === address.toLowerCase()) return { symbol: t.symbol, decimals: t.decimals };
    return null;
  };
  const data: StatusData = status
    ? statusView({ status, steps, pay, get, nowSec, feeText: fee, gasText: gas, toWallet: rv.recipient, orderId: activity.id, token, logo })
    : {
        phase: 'progress', failed: false, pay, get, refundText: null, reason: null, refund: null, steps: [], when: '', title: 'On its way', text: 'Updating live',
        ringLogo: chainLogo(rv.from.chain), to: rv.recipient, fee, gas, orderId: activity.id, totalText: 'Updating live',
      };
  // the ring fills toward the real ETA, linear, and closes only when the status says the swap ended
  const etaAt = status ? ('etaAt' in status ? (status as OrderStatusAnswer).etaAt : (status as PayoutAnswer).queue?.etaAt ?? null) : null;
  const fillFor = React.useMemo(() => (etaAt ? Math.max(1, etaAt - Math.floor(Date.now() / 1000)) : 2.5), [etaAt]);
  const done = data.steps.filter((s) => s.state === 'done').length;
  const progress = etaAt ? RING_MOVING : data.steps.length ? 0.25 + ((RING_MOVING - 0.25) * done) / data.steps.length : 0.25;
  const refunding = data.steps.some((s) => s.state === 'fail') || status?.stage === 'refunding';
  return <SwapStatus data={data} ring={{ progress, fillFor, refunding, from: routeRef }} onNew={onNew} onHistory={onHistory} />;
}

