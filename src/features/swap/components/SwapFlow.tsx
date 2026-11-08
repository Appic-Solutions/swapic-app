'use client';
// The Swap panel that changes in place (the approved prototype, design swap-flow.tsx, Jeff 2026-10-29): Swap, Review swap
// and Your swap share one frame (MorphFrame). Review swap: the routes not picked fade, the picked route card glides into
// its review spot; Back reverses. Sign: the button turns into "Confirm in your wallet" with the soft glow while the wallet
// asks and the step lights up; a "no" returns the button with "You cancelled in your wallet."; once the swap has started
// the same frame turns into Your swap (the card shrinks into the status circle) and every step, the ring and the end
// (Delivered or Refunded) follow the real tracking (useActivity). The motion never runs ahead of the data and never holds
// a money action: a click acts at once, the animation is decoration.
// Quote timer on Review swap (approved 2026-10-31, the countdown label Jeff picked): the label on the route card counts
// 20 s down from when the price on screen was fetched; at zero the same query is asked again in place ("Updating price")
// and the option with the same tag replaces the review: a least out at or above the "at least" on screen quietly (that
// one sits 0.05% under the quote's own least, shownMinOf), below it as a new price (reviewRefresh). While the wallet asks to sign (or the steps run) the label is hidden and no fresh quote loads, so the
// price never changes under a signature; after a cancel it comes back. Quotes stay valid 45 s.
// The executable quote (services 679b88e: the quoter builds and stores only the route a request names): the Swap panel's
// cards are priced only, with no wallet named; Review swap asks at once for the picked route alone, by its id and mode,
// for this payer and recipient, and every refresh and the signing ask the same. The review's numbers and wallet steps come
// from that answer (the same rule as a refresh: at or above the screen's minimum quietly, below it a new price); signing stays off
// until it has come, and a route no longer offered says so and is never signed.
// You pay gas through Permit2 (Jeff 2026-11-08). The named quote says what a token's swap asks, and only it: before it comes
// the priced route has no permit2Pay (no approval either), so a payer who may pay that way sees the wallet list wait, with no
// words that could turn out wrong (gasless has needsApproval for this; here nothing priced can say it, its allowance being
// a different one), for at most REVIEW_READ_MS of a slow code read. A payer who cannot (flagged a smart wallet, code on the
// From chain read with the named quote, a wallet that refused) has today's steps from the start, and a code not read has
// them as the safest for now, read again at the next refresh. A wallet that cannot sign comes back here with today's steps and
// a note: it sees the new approve before any wallet asks for it, and is not asked to sign again on this visit.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { UiToken } from '@/components/ui/token-types';
import type { SideView, StepView } from '@/components/orders/types';
import { Note } from '@/components/design/Note';
import { COMPACT_VIEW } from '@/components/design/fit';
import { ClockIcon, WarningIcon } from '@/components/icons';
import { MorphFrame } from '@/components/motion/parts';
import { getOrders, getQuote, submitGasless, userMessage, type OrderStatusAnswer, type PayoutAnswer, type Quote } from '@/lib/api';
import { tokenAmountText } from '@/lib/copy/format';
import { chainLogo, chainName, evmId } from '@/lib/explorer';
import { icpClient } from '@/lib/icp';
import { formatUsd, parseUnits, usdMicro } from '@/lib/money';
import { MS, useFirstRender, useReducedMotion } from '@/lib/motion';
import { useEvmSigner, useIcpCaller, useSolSigner, useWallets } from '@/lib/wallets';
import { useLogoFor } from '@/features/activity/logos';
import { useActivity } from '@/features/activity/track';
import { executeSwap, type ExecOutcome } from '../execute';
import { useSwapForm } from '../form';
import { isNative } from '../guards/abi';
import { routeOffered } from '../guards/evm';
import { forPayer, namedOption, pickOf, type PickedOption } from '../options';
import { namedQueryOf, useGuardContext } from '../quote';
import { reviewData, reviewRefresh, sameSteps } from '../review';
import { CountdownLabel, QUOTE_CYCLE_MS } from '@/components/ui/countdown-label';
import { NOT_SEEN_GRACE_S, ownSteps, statusView, whenText, type OwnSend, type StatusData } from '../status-view';
import { gasText, sumFees } from '../view';
import { ReviewPanel } from './ReviewPanel';
import { reviewMarks } from './ConfirmPick';
import { SwapPanel, type LinkLoading, type ReviewStart } from './SwapPanel';
import { SwapStatus } from './SwapStatus';

export type FlowView = 'swap' | 'review' | 'status';

/** How full the ring is at most while the swap moves (it closes only when the status says it ended). */
const RING_MOVING = 0.85;
const TOO_MANY = new Set(['Too many tries, wait a minute', 'Too many requests. Wait a minute and try again.']);
const GONE = 'This option is not available right now. Go back to pick another.';
const CANNOT_SIGN = "Your wallet can't sign this, so the steps changed. Check them and try again.";
const STEPS_CHANGED = 'The steps for this swap changed. Check them and try again.';
/** How long the payer's code may hold Review swap's steps back: past it the code counts as not read, for now. */
const REVIEW_READ_MS = 3_000;

/** The started swap Your swap follows: its id, when it started, its deadline while unseen, and the app's own send. */
interface Activity { id: string; startedSec: number; deadline: number | null; own: OwnSend | null }

interface Review extends ReviewStart {
  from: UiToken; to: UiToken; recipient: string; recipientLabel: string; shownMin: bigint;
  data: ReturnType<typeof reviewData>;
  /** The price moved before signing: the minimum shown before, struck through. */
  wasMinText?: string;
  /** The review comes from the picked route's own executable quote (until then it shows the priced card, unsigned). */
  named: boolean;
  /** This payer can sign through Permit2 on the From chain; null while its code is not read (today's steps until it is). */
  signs: boolean | null;
}

const sideOf = (t: UiToken, amount: bigint, prefix = ''): SideView => {
  const usd = usdMicro(amount, t.decimals, t.priceUsd);
  return { symbol: t.symbol, logo: t.logo, chain: chainName(t.chain), chainLogo: chainLogo(t.chain), amountText: `${prefix}${tokenAmountText(amount, t.decimals, t.symbol)}`, usdText: usd === null ? '' : formatUsd(usd) };
};

export function SwapFlow({ view, setView, onPick, linking }: { view: FlowView; setView: (v: FlowView) => void; onPick: (side: 'from' | 'to') => void; linking?: LinkLoading | null }) {
  const router = useRouter();
  const f = useSwapForm();
  const signer = useEvmSigner();
  const solSigner = useSolSigner();
  const wallet = useWallets((s) => s.evm);
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
  const [activity, setActivity] = React.useState<Activity | null>(null);
  // the swap's own transaction as the wallet sent it (you pay gas): Your swap shows it until Swapic records the order
  const sentTx = React.useRef<{ tx: string; atMs: number } | null>(null);
  // the wallet sent the swap: the review waits on the chain now ("Confirming"), not on the wallet
  const [confirming, setConfirming] = React.useState(false);
  // an approve was sent and waits for the network, not for the wallet
  const [approving, setApproving] = React.useState(false);
  const [glide, setGlide] = React.useState(false);
  const [run, setRun] = React.useState(0);
  // The review's route card: Your swap shrinks a copy of it into the status circle.
  const routeRef = React.useRef<HTMLDivElement>(null);
  const guard = useGuardContext();
  // when the price on Review swap was fetched (its ring starts there); a ref the refresh reads to drop a late answer
  const [rvAt, setRvAt] = React.useState(0);
  const signing = React.useRef(false);
  const refreshing = React.useRef(false);
  // a fresh price is loading on Review swap ("Updating price")
  const [updating, setUpdating] = React.useState(false);
  // the swap has started (the short hold before Your swap): its review never changes again
  const [started, setStarted] = React.useState(false);
  // the wallets that showed they cannot sign through Permit2: today's steps for them, for the rest of this visit
  const cannotSign = React.useRef(new Set<string>());
  /** Whether this route of this From token could go through Permit2 for this wallet, as far as is known before any read. */
  const mayPermit2 = (o: PickedOption, from: UiToken) => from.chain_type === 'EVM' && o.mode === 'userPays' && !isNative(from.address) && wallet?.smartWallet === false && !cannotSign.current.has(wallet.address);
  /** Whether this review's payer can sign through Permit2: an answer is kept for the review, a read that failed never is. */
  const readSigns = async (cur: Review): Promise<boolean | null> => {
    if (cur.signs !== null) return cur.signs;
    if (!signer || !mayPermit2(cur.option, cur.from)) return wallet?.smartWallet === null ? null : false;
    const read = await signer.payerOn(evmId(cur.from.chain), REVIEW_READ_MS);
    return read === 'plain' ? true : read === 'unread' ? null : false;
  };

  // a "too many tries" pause: the button comes back after a minute
  React.useEffect(() => {
    if (waitUntil === null) return;
    const t = setTimeout(() => { setWaitUntil(null); setNote(null); }, Math.max(0, waitUntil - Date.now()));
    return () => clearTimeout(t);
  }, [waitUntil]);

  const start = (s: ReviewStart) => {
    if (!f.from || !f.to || !s.query.recipient) return;
    const recipientLabel = f.recipient.show ? 'Wallet you entered' : f.to.chain_type === 'ICP' ? 'Your ICP wallet' : f.to.chain_type === 'SOLANA' ? 'Your Solana wallet' : 'Your EVM wallet';
    // a route already built says its steps; a priced one of a payer who may pay through Permit2 cannot yet
    const pending = !s.option.route.order && mayPermit2(s.option, f.from);
    const data = reviewData({ option: s.option, quote: s.quote, from: f.from, to: f.to, amountIn: s.amountIn, native: s.native, recipient: { label: recipientLabel, address: s.query.recipient, chain: f.to.chain }, pending });
    // from here on every ask names the picked route; the effect below asks for it at once
    setRv({ ...s, query: namedQueryOf(s.query, pickOf(s.option)), named: false, signs: null, from: f.from, to: f.to, recipient: s.query.recipient, recipientLabel, shownMin: data.min, data });
    setRvAt(s.quotedAt);
    setStarted(false);
    setStates(undefined);
    setConfirming(false);
    setApproving(false);
    sentTx.current = null;
    setCancelled(false);
    setNote(null);
    setResume(null);
    setView('review');
  };

  const handle = (out: ExecOutcome) => {
    setBusy(false);
    setResume(null);
    setConfirming(false);
    setApproving(false);
    if (out.kind === 'started') {
      // a short hold for the last check to draw, then Your swap (the swap has started: nothing waits on this)
      setStarted(true);
      const id = out.activityId;
      const deadline = out.deadline ?? null;
      // what the app saw of its own send: the transaction it sent, else the moment the signature or the ICP call went through
      const own: OwnSend | null = rv ? { chain: rv.from.chain, tx: sentTx.current?.tx ?? null, atMs: sentTx.current?.atMs ?? Date.now() } : null;
      setTimeout(() => {
        setActivity({ id, startedSec: Math.floor(Date.now() / 1000), deadline, own });
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
      newPrice(rv, out.quote, out.option);
      return;
    }
    if (out.kind === 'stepsChanged' && rv) {
      // the price stands: only the steps on screen change, with no struck through minimum and no "Accept new price"
      const data = reviewData({ option: out.option, quote: out.quote, from: rv.from, to: rv.to, amountIn: rv.amountIn, native: rv.native, recipient: rv.data.recipient });
      setRv((r) => r && { ...r, option: out.option, quote: out.quote, data, wasMinText: undefined, named: true, shownMin: data.min });
      setRvAt(Date.now());
      setStates(undefined);
      setNote({ tone: 'yellow', text: STEPS_CHANGED });
      return;
    }
    if (out.kind === 'tryAgain') {
      // nothing was sent and nothing is known against the wallet: the same steps, the same button
      setStates((s) => s?.map((x) => (x === 'wait' ? 'todo' : x)));
      setNote({ tone: 'yellow', text: out.message });
      return;
    }
    if (out.kind === 'noPermit2' && rv) {
      // today's steps on Review swap, for the person to see before any wallet asks again
      if (out.wallet && signer) cannotSign.current.add(signer.address);
      const option = forPayer(rv.option, false);
      const data = reviewData({ option, quote: rv.quote, from: rv.from, to: rv.to, amountIn: rv.amountIn, native: rv.native, recipient: rv.data.recipient });
      setRv((r) => r && { ...r, option, data, signs: false });
      setStates(undefined);
      setNote({ tone: 'yellow', text: CANNOT_SIGN });
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

  /** Less out than on screen: the struck through minimum, the yellow note and "Accept new price"; nothing signed. `at`: when
   *  that quote came. */
  const newPrice = (cur: Review, quote: Quote, option: PickedOption, at = Date.now()) => {
    const data = reviewData({ option, quote, from: cur.from, to: cur.to, amountIn: cur.amountIn, native: cur.native, recipient: cur.data.recipient });
    setRv({ ...cur, option, quote, data, wasMinText: cur.data.minText, named: true });
    setRvAt(at);
    setStates(undefined);
    setNote({ tone: 'yellow', text: `The price moved. You now get at least ${data.minText}${data.minUsd ? ` (${data.minUsd})` : ''}.` });
  };

  /** On opening, then each time the ring is full: the picked route asked again by name, decided by reviewRefresh. */
  const refresh = async () => {
    const cur = rv;
    if (!cur || signing.current || refreshing.current) return;
    refreshing.current = true;
    setUpdating(true);
    try {
      // the named quote says which steps the route asks, the payer's code on the From chain whether it may take them; its
      // timer starts when it came, not when the read ended
      const [{ quote, at }, signs] = await Promise.all([
        getQuote(cur.query).then((answer) => ({ quote: answer, at: Date.now() })),
        readSigns(cur),
      ]);
      // a signature started while it loaded: the price never changes under it
      if (signing.current) return;
      const accept = (r: Parameters<typeof routeOffered>[1], mode: PickedOption['mode']) => routeOffered(quote, r, mode, { payer: cur.query.payer, recipient: cur.query.recipient, guard });
      const offered = namedOption(quote, pickOf(cur.option), accept);
      const out = reviewRefresh(cur.data.min, offered && forPayer(offered, signs === true));
      if (out.kind === 'quiet') {
        // the minimum on screen follows the fresh quote, up or down: its cushion stands against the latest quote
        const data = reviewData({ option: out.option, quote, from: cur.from, to: cur.to, amountIn: cur.amountIn, native: cur.native, recipient: cur.data.recipient });
        // the numbers on screen are what a signature binds (after a new price not yet accepted, the old minimum stays bound)
        setRv((r) => (r === cur ? { ...cur, option: out.option, quote, data, named: true, signs, shownMin: cur.wasMinText ? cur.shownMin : data.min } : r));
        // the list's states go by position (after a cancel, an approve's done): other steps start over, so a row never shows another's
        if (!sameSteps(cur.data.steps, data.steps)) setStates(undefined);
        if (!cur.named) setNote(null);
        setRvAt(at);
      } else if (out.kind === 'newPrice') {
        newPrice({ ...cur, signs }, quote, out.option, at);
      } else {
        // the picked route is no longer offered: before its own quote came, nothing can be signed
        if (!cur.named) setNote({ tone: 'yellow', text: GONE });
        setRvAt(at);
      }
    } catch (e) {
      // no answer: the review stays as it is and the ring goes round again (before its own quote came, it says why)
      if (!cur.named) setNote({ tone: 'yellow', text: userMessage(e) });
      setRvAt(Date.now());
    } finally {
      refreshing.current = false;
      setUpdating(false);
    }
  };

  const sign = async () => {
    if (!rv || !rv.named || busy || waitUntil !== null) return;
    setCancelled(false);
    setNote(null);
    signing.current = true;
    setBusy(true);
    if (resume) { handle(await resume()); return; }
    sentTx.current = null;
    // a new price accepted: the minimum on screen is the new one
    const shownMin = rv.wasMinText ? rv.data.min : rv.shownMin;
    if (rv.wasMinText) setRv({ ...rv, shownMin, wasMinText: undefined });
    setStates(rv.data.steps.map(() => 'todo'));
    handle(await executeSwap(
      {
        query: rv.query, pick: pickOf(rv.option), shownMin, amountIn: rv.amountIn, from: rv.from, to: rv.to, recipient: rv.recipient,
        evm: signer, icpCaller: caller, sol: solSigner,
        permit2: rv.signs === true,
        shown: { permit2: !!rv.option.route.permit2Pay, approval: !!rv.option.route.permit2Pay?.approval },
        onStep: (i, st) => { if (st !== 'wait') setApproving(false); setStates((s) => (s ?? rv.data.steps.map(() => 'todo' as const)).map((x, j) => (j === i ? st : x))); },
        onSent: (_, tx) => { sentTx.current = { tx, atMs: Date.now() }; setConfirming(true); },
        onApproval: (_, on) => setApproving(on === 'network'),
        onNote: (text) => setNote({ tone: 'blue', text }),
      },
      { getQuote, getOrders, submitGasless, icp: icpClient(), nowMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    ));
  };

  // Back to the Swap panel in place. After a swap (fresh) the tokens and amount stay and the first route is picked.
  const toSwap = (fresh: boolean) => {
    setStates(undefined);
    setConfirming(false);
    setApproving(false);
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
  const wide = view !== 'swap' || typed || (!!linking?.from && linking.to && linking.amount);
  const waiting = busy && !!states?.some((s) => s === 'wait');
  // the wallet is asking (or the steps run): the ring holds and no fresh quote loads
  const holding = busy || started || !!states?.some((s) => s === 'wait');
  signing.current = holding;
  // at zero on Review swap: a fresh quote in place (never while the wallet asks; after a cancel, at once if it is due)
  const refreshNow = React.useRef(refresh);
  refreshNow.current = refresh;
  React.useEffect(() => {
    if (view !== 'review' || !rv || holding) return;
    const t = setTimeout(() => void refreshNow.current(), Math.max(0, rvAt + QUOTE_CYCLE_MS - Date.now()));
    return () => clearTimeout(t);
  }, [view, rvAt, holding, !!rv]); // eslint-disable-line react-hooks/exhaustive-deps
  // Review swap opened: the picked route's executable quote, asked at once
  const named = rv?.named ?? true;
  React.useEffect(() => {
    if (view === 'review' && !named && !holding) void refreshNow.current();
  }, [view, named, holding]);

  return (
    <MorphFrame view={viewKey} wide={wide} viewClass={COMPACT_VIEW}>
      {(v) =>
        v === 'swap' ? (
          <SwapPanel onPick={onPick} onReview={start} linking={linking} />
        ) : v === 'review' && rv ? (
          <ReviewPanel
            data={rv.data} pay={sideOf(rv.from, rv.amountIn)} get={sideOf(rv.to, rv.data.min)} toToken={{ symbol: rv.to.symbol, logo: rv.to.logo }}
            states={states} waiting={waiting || (busy && !note)} confirming={confirming} approving={approving} cancelled={cancelled} routeRef={routeRef}
            wasMinText={rv.wasMinText}
            disabled={waitUntil !== null || !rv.named || rv.data.blocked}
            button={waitUntil !== null ? 'Try again in a minute' : rv.wasMinText ? 'Accept new price' : resume ? 'Try again' : undefined}
            note={note ? (
              <Note tone={note.tone} icon={note.tone === 'blue' || note.clock ? <ClockIcon width={16} height={16} /> : <WarningIcon />}>{note.text}</Note>
            ) : undefined}
            onBack={() => toSwap(false)}
            timer={holding ? undefined : <CountdownLabel startedAt={rvAt} fetching={updating} />}
            marks={reviewMarks(rv.from, rv.to)}
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
  rv: Review; activity: Activity; logo: ReturnType<typeof useLogoFor>;
  routeRef?: React.RefObject<HTMLDivElement | null>; onNew: () => void; onHistory: () => void;
}) {
  const { status, steps } = useActivity(activity.id);
  const nowSec = Math.floor(Date.now() / 1000);
  // the tracking answers the same while nothing moves (no new render): one more render once an order the app did not see
  // start can read as never started (statusView neverStarted)
  const [, wake] = React.useReducer((n: number) => n + 1, 0);
  const notSeenAt = activity.deadline === null ? null : activity.deadline + NOT_SEEN_GRACE_S;
  React.useEffect(() => {
    if (notSeenAt === null) return;
    const t = setTimeout(wake, Math.max(0, notSeenAt * 1000 - Date.now()) + 1_000);
    return () => clearTimeout(t);
  }, [notSeenAt]);
  const route = rv.option.route;
  const expected = route.icpCkSwap ? BigInt(route.icpCkSwap.expectedOut) : route.icpSwap ? BigInt(route.icpSwap.planned.expectedOut) : BigInt(route.amountOut);
  const delivered = steps?.steps.find((s) => s.step === 'delivered' && s.amount !== null)?.amount ?? null;
  const ended = status && status.outcome !== 'pending';
  const get = ended && status.outcome === 'delivered' ? sideOf(rv.to, delivered !== null ? BigInt(delivered) : expected) : sideOf(rv.to, expected, '~');
  const pay = sideOf(rv.from, rv.amountIn);
  const gas = rv.option.mode === 'gasless' ? 'None, Swapic paid it' : rv.option.mode === 'icpPull' && !route.icpCkSwap ? 'None' : gasText(rv.option, rv.native).replace('you pay it', 'you paid it');
  const fee = formatUsd(sumFees(route.fees));
  const token = (chain: string | null, address: string | null) => {
    for (const t of [rv.from, rv.to]) if (t.chain === chain && address !== null && t.address.toLowerCase() === address.toLowerCase()) return { symbol: t.symbol, decimals: t.decimals };
    return null;
  };
  const gasMode = rv.option.mode === 'userPays' ? 'userPays' : 'gasless';
  const own = activity.own;
  // no status yet (Swapic has not recorded the order): the app's own send and a row that waits for Swapic, never empty
  const data: StatusData = status
    ? statusView({ status, steps, pay, get, nowSec, feeText: fee, gasText: gas, gasMode, toWallet: rv.recipient, orderId: activity.id, token, logo, deadline: activity.deadline, own })
    : {
        phase: 'progress', ending: 'pending', pay, get, refundText: null, reason: null, refund: null, steps: own ? ownSteps(own, gasMode) : [], early: !!own,
        when: own ? whenText(own.atMs, nowSec * 1000) : '', title: 'On its way', text: 'Updating live',
        ringLogo: chainLogo(rv.from.chain), to: rv.recipient, fee, gas, orderId: activity.id, totalText: 'Updating live',
      };
  // the ring fills toward the real ETA, linear, and closes only when the status says the swap ended
  const etaAt = status ? ('etaAt' in status ? (status as OrderStatusAnswer).etaAt : (status as PayoutAnswer).queue?.etaAt ?? null) : null;
  const fillFor = React.useMemo(() => (etaAt ? Math.max(1, etaAt - Math.floor(Date.now() / 1000)) : 2.5), [etaAt]);
  const done = data.steps.filter((s) => s.state === 'done').length;
  // the app's own steps are not Swapic's: the ring waits at its start until the real ones come
  const progress = etaAt ? RING_MOVING : data.steps.length && !data.early ? 0.25 + ((RING_MOVING - 0.25) * done) / data.steps.length : 0.25;
  const refunding = data.steps.some((s) => s.state === 'fail') || status?.stage === 'refunding';
  return <SwapStatus data={data} ring={{ progress, fillFor, refunding, from: routeRef }} onNew={onNew} onHistory={onHistory} />;
}

