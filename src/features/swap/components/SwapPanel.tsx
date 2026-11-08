'use client';
// The swap panel: moved from the design's swap-screens.tsx SwapPanel (the approved static look, as the design bundle
// built 2026-10-29 14:46 holds it; the motion pass comes later from one shared module), wired to the form, the quote,
// the balance and the wallets. Desktop: inputs left; the route column takes the left column's height and scrolls, so the
// panel ends at Review swap and grows when Send To Wallet opens. Phones: stacked, routes in a sideways row.
import * as React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { PanelBox } from '@/components/motion/parts';
import { useScrollFade } from '@/components/ui/use-scroll-fade';
import { fade, openHeight, tw, useMounted, useReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { TokenCard } from '@/components/ui/token-card';
import ActionButton from '@/components/ui/action-button';
import WalletAddressInput from '@/components/ui/wallet-address-input';
import AmountCard from '@/components/design/AmountCard';
import RouteOptionsList from '@/components/design/RouteOptionsList';
import { CountdownLabel } from '@/components/ui/countdown-label';
import { ArrowsUpDownIcon, HistoryIcon } from '@/components/icons';
import { formatAmount, formatUnits, formatUsd, formatUsdWhole, maxIcp, maxNative, nativeReserve, parseUnits, usdMicro } from '@/lib/money';
import { icpClient } from '@/lib/icp';
import { useEvmConnect, useEvmSigner, useIcpConnect, useWallets } from '@/lib/wallets';
import { swapButton, swapHint } from '../button';
import { Hint } from '@/components/design/Hint';
import { HINTS } from '@/lib/copy/hints';
import { recipientError, useSwapForm } from '../form';
import { ICP_PAUSED, smartWalletTypesRecipient, useSwapQuote } from '../quote';
import { useBalance, useChains, useTokenList } from '../tokens';
import { approveState, isSameChainNoUsdc, routeView, type NativeCoin } from '../view';
import type { PickedOption } from '../options';
import { ReceiveAt } from './ReceiveAt';
import type { Quote, QuoteQuery } from '@/lib/api';

const NO_ROUTE = 'No route found for this amount';
const PAUSED = 'Swaps are paused right now';
const PAUSED_TEXT = 'No new swap can start for now. Try again in a little while. Swaps you already started show in History.';
const ZERO = '0x0000000000000000000000000000000000000000';
/** The gas price Max falls back to when the wallet cannot tell: 50 gwei. */
const FALLBACK_FEE_PER_GAS = 50_000_000_000n;

/** What Review swap takes from the panel: the option on screen, its quote and the query that asked it. */
/** `quotedAt`: when that quote was fetched (ms), so Review swap's timer goes on from where the Swap panel's was. */
export interface ReviewStart { option: PickedOption; quote: Quote; query: QuoteQuery; native: NativeCoin; amountIn: bigint; quotedAt: number }

/** A shared link whose tokens are still loading: the sides it names, and whether it carries an amount. */
export interface LinkLoading { from: boolean; to: boolean; amount: boolean }

export function SwapPanel({ onPick, onReview, linking }: { onPick: (side: 'from' | 'to') => void; onReview: (start: ReviewStart) => void; linking?: LinkLoading | null }) {
  const f = useSwapForm();
  const { evm, icp } = useWallets();
  const signer = useEvmSigner();
  const openEvm = useEvmConnect();
  const openIcp = useIcpConnect();
  const { query, quote, state, options, picked, error, cap, covers, refill, updatedAt, fetching, settling } = useSwapQuote();
  const { from, to, recipient } = f;
  const both = !!from && !!to;
  // a link's two tokens on their way: the two token layout now, so nothing moves when they arrive
  const linkBoth = !both && !!linking?.from && linking.to;
  const linkColumn = linkBoth && linking!.amount;
  const pickedCard = 'max-h-min md:max-h-min';
  // short windows: the token cards a little lower
  const compactCard = 'md:short:py-4 md:tiny:py-3';
  // Motion (approved 2026-10-29): token cards brighten their edge on hover and sink when pressed; inside the in place
  // panel (MorphFrame) the parts fade in place; Send To Wallet opens and closes at panel speed; the route column's first
  // cards fade up when quoting starts.
  const card = cn(tw.quick, tw.edge, tw.pressRow);
  const mounted = useMounted();
  const reduced = useReducedMotion();

  // the amount, as typed and as smallest units
  let amount: bigint | null = null;
  let amountError: string | null = null;
  if (from && f.amountText) {
    try {
      amount = parseUnits(f.amountText, from.decimals);
    } catch (e) {
      amountError = (e as Error).message;
    }
  }
  // The route column goes the moment the amount is cleared, as the panel narrows (SwapFlow's wide reads the amount as
  // typed); the quote's state alone changes 600 ms later, and the cards left in the narrowing panel showed at its edge.
  const column = both && state !== 'none' && amount !== null && amount > 0n;
  const { balance, loading: balanceLoading } = useBalance(from);
  const overBalance = amount !== null && balance !== undefined && amount > balance;
  const fromWallet = from ? (from.chain_type === 'ICP' ? !!icp : !!evm) : false;
  const usd = from && amount !== null ? usdMicro(amount, from.decimals, from.priceUsd) : null;

  // the From chain's coin, priced by its row in the token list (the gas row of the route cards)
  const { chains } = useChains();
  const fromChain = chains.find((c) => c.chainId === from?.chain);
  const coinRow = useTokenList(from && from.chain_type === 'EVM' ? from.chain : '', '').tokens.find((t) => t.address === ZERO);
  // the wallet's coin on the From chain: the gasless card says "You have no ETH on Arbitrum" when it is zero
  const { balance: coinBalance } = useBalance(coinRow ?? null);
  const native: NativeCoin = {
    symbol: fromChain?.nativeToken.symbol ?? '',
    decimals: fromChain?.nativeToken.decimals ?? 18,
    priceUsd: coinRow?.priceUsd ?? null,
    held: coinBalance === undefined ? null : coinBalance > 0n,
  };
  const sameChainNoUsdc = quote ? isSameChainNoUsdc(quote, fromChain?.usdc.address) : false;
  const views = from && to && amount !== null ? options.map((o) => routeView(o, { from, to, amountIn: amount!, sameChainNoUsdc, native })) : [];

  // the From side can pay but the To side has no wallet and no address yet: open Send To Wallet so the button asks for
  // one. With no From wallet, "Connect wallet" comes first (spec 5.1; plan 2 Task 12's no wallet test).
  // A smart wallet sending to another EVM chain: the field opens EMPTY and stays required (never its own address there).
  const smartTyped = smartWalletTypesRecipient(f, { evm, icp });
  const ownRecipient = to ? (to.chain_type === 'ICP' ? !!icp : !!evm && !smartTyped) : true;
  React.useEffect(() => {
    if (fromWallet && to && !ownRecipient && !recipient.show && (smartTyped || !recipient.address)) {
      f.set({ recipient: { show: true, address: recipient.address, error: recipientError(to, recipient.address) } });
    }
  }, [fromWallet, to, ownRecipient, smartTyped, recipient.show, recipient.address, f]);

  // Receive at (the To card's menu): the connected wallet that can receive, "Connect a wallet" (once it connects, the swap
  // pays out to it and the field closes) or "Paste an address" (the field opens, focused)
  const ownAddress = to ? (to.chain_type === 'ICP' ? icp?.principal ?? null : smartTyped ? null : evm?.address ?? null) : null;
  const wantOwn = React.useRef(false);
  React.useEffect(() => {
    if (!wantOwn.current || !ownRecipient) return;
    wantOwn.current = false;
    if (recipient.show) f.set({ recipient: { ...recipient, show: false } });
  }, [ownRecipient, recipient, f]);
  const field = React.useRef<HTMLDivElement>(null);
  // Paste an address: the field takes the focus once it has opened (focus scrolls it into view in a scrolling column)
  const focusField = React.useRef(false);
  const focusInput = () => field.current?.querySelector('input')?.focus();
  const pickOwn = () => f.set({ recipient: { ...recipient, show: false } });
  const connectTo = () => {
    wantOwn.current = true;
    if (to?.chain_type === 'ICP') void openIcp();
    else void openEvm();
  };
  const paste = () => {
    if (recipient.show) { focusInput(); return; }
    focusField.current = true;
    f.set({ recipient: { ...recipient, show: true, error: recipientError(to, recipient.address) } });
  };
  // short windows from lg: the cards above the button scroll inside once they are taller than the window allows (the
  // address field open), so the panel fits and the button always shows; elsewhere this wrapper adds nothing
  const cards = useScrollFade<HTMLDivElement>();

  const fastUpTo = covers !== null ? `Swap ${formatUsd(covers)} or less for the fast route` : undefined;
  const message = state === 'empty' ? fastUpTo ?? NO_ROUTE : overBalance && from ? `Not enough ${from.symbol} in your wallet` : state === 'error' || state === 'capped' ? error ?? undefined : fastUpTo;
  const buttonInput = {
    from: !!from, to: !!to, amount, amountError, overBalance, quote: settling ? 'loading' as const : state, hasOptions: options.length > 0,
    recipientShown: recipient.show, recipientError: recipient.show ? recipient.error || null : null, fromWallet, recipient: !!query?.recipient, cap,
    needsCoin: picked && approveState(picked, native) === 'noCoin' ? native.symbol : undefined,
  };
  const button = linkBoth ? { text: undefined, enabled: false } : swapButton(buttonInput);
  // the grey line under the button: what can be done now
  const hint = linkBoth ? HINTS.swapLoading : swapHint(buttonInput);

  const onMax = async () => {
    if (!from || balance === undefined) return;
    let max = balance;
    if (from.chain_type === 'ICP') {
      max = maxIcp(balance, await icpClient().ledgerFee(from.address));
    } else if (from.address === ZERO) {
      const feePerGas = signer ? await signer.maxFeePerGas(from.chainId).catch(() => FALLBACK_FEE_PER_GAS) : FALLBACK_FEE_PER_GAS;
      max = maxNative(balance, nativeReserve(feePerGas));
    }
    f.set({ amountText: formatUnits(max, from.decimals).replace(/,/g, '') });
  };
  const onButton = () => {
    if (button.text === 'Connect wallet') {
      if (from?.chain_type === 'ICP') void openIcp();
      else void openEvm();
      return;
    }
    if (button.enabled && picked && quote && query && amount !== null) onReview({ option: picked, quote, query, native, amountIn: amount, quotedAt: updatedAt });
  };

  const actions = (cls: string, fades: boolean) => (
    <motion.div variants={fades ? fade : undefined} className={'relative w-full ' + cls}>
      <div className={cn('w-full', tw.quick, button.enabled && tw.press)}>
        <ActionButton isDisabled={!button.enabled} onClick={button.enabled ? onButton : undefined}>
          {button.text}
        </ActionButton>
      </div>
      <Hint text={hint} />
    </motion.div>
  );

  // the route column's empty card says why, in the same words as the amount card (PROVISIONAL copy for the cap)
  const paused = state === 'paused' ? { emptyTitle: PAUSED, emptyText: PAUSED_TEXT } : state === 'icpPaused' ? { emptyTitle: 'Paused for now', emptyText: refill !== null ? `The pool is refilling. Back in about ${refill} minutes.` : ICP_PAUSED }
    : state === 'capped' && cap !== null ? { emptyTitle: `Swaps are limited to ${formatUsdWhole(cap)} for now`, emptyText: 'Try a smaller amount.' } : {};

  return (
    <PanelBox className={'flex h-full flex-col gap-6 overflow-x-hidden transition-[max-width] md:h-fit md:w-full md:max-w-[537px] ' + tw.big + ' ' + (column || linkColumn ? 'lg:max-w-[1060px]' : '')}>
      <motion.div variants={fade} className="flex w-full items-center justify-between text-white">
        <h1 className="text-2xl font-semibold md:text-3xl md:short:text-2xl md:tiny:text-xl">Swap</h1>
        <Link href="/history" className="flex cursor-pointer items-center gap-x-2 text-sm text-secondary transition-colors hover:text-white">
          <HistoryIcon width={16} height={16} />
          History
        </Link>
      </motion.div>
      <div className="flex w-full flex-1 flex-col justify-between gap-x-4 gap-y-6 lg:flex-row">
        <motion.div variants={fade} data-testid="swap-left" className="flex w-full flex-col lg:max-w-[482px] lg:shrink-0">
          {/* 156 = 48 padding + 32 title + 16 gap + 12 + 48 button; tiny 140 = 40 + 28 + 12 + 12 + 48 */}
          <div
            ref={cards.ref}
            className={cn(
              'no-scrollbar contents lg:short:block lg:short:overflow-y-auto',
              'lg:short:max-h-[calc(100dvh-var(--frame-top)-var(--frame-bottom)-var(--page-reserve,0px)-156px)] lg:tiny:max-h-[calc(100dvh-var(--frame-top)-var(--frame-bottom)-var(--page-reserve,0px)-140px)]',
              cards.fade,
            )}
          >
          <div className={'relative flex w-full ' + (both || linkBoth ? 'flex-row gap-x-3 md:gap-x-4' : 'flex-col gap-y-4 md:short:gap-y-3')}>
            <TokenCard token={from ?? undefined} loading={!!linking?.from && !from} customOnClick={() => onPick('from')} label="From" className={cn((from || linkBoth) && pickedCard, compactCard, card)} />
            <div
              onClick={() => f.flip()}
              className={cn(
                'group absolute inset-0 z-20 m-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-line bg-[#101012] text-white hover:border-line-strong md:h-10 md:w-10',
                'transition-[transform,border-color] active:scale-90 motion-reduce:transition-none',
                tw.panel,
                both || linkBoth ? 'rotate-90 hover:-rotate-90' : 'hover:rotate-180',
              )}
            >
              <ArrowsUpDownIcon width={20} height={20} />
            </div>
            {/* the To card, and over its top right corner (beside its label) the Receive at control once a To token is picked */}
            <div className="relative w-full min-w-0">
              <TokenCard token={to ?? undefined} loading={!!linking?.to && !to} customOnClick={() => onPick('to')} label="To" className={cn((to || linkBoth) && pickedCard, compactCard, card)} />
              {to && (
                <ReceiveAt
                  own={ownAddress} pasting={recipient.show} address={recipient.address} valid={!recipient.error}
                  onOwn={pickOwn} onConnect={connectTo} onPaste={paste}
                  className="absolute right-3 top-3 z-10 max-w-[calc(100%-56px)] md:right-4 md:top-[18px] md:short:top-[14px] md:tiny:top-[10px]"
                />
              )}
            </div>
          </div>
          {linkBoth && <AmountCard token={{ logo: '', chainLogo: '' }} amountText="" usdText={null} balanceLoading disabled reserveMessage />}
          {both && (
            <AmountCard
              token={{ logo: from!.logo, chainLogo: from!.chainLogo }}
              amountText={f.amountText}
              onAmountText={(t) => f.set({ amountText: t })}
              usdText={usd === null ? null : formatUsd(usd)}
              balanceText={fromWallet && balance !== undefined ? formatAmount(balance, from!.decimals) : undefined}
              onMax={() => void onMax()}
              balanceLoading={fromWallet && balanceLoading}
              message={message}
              reserveMessage
            />
          )}
          {both && (
            // Send To Wallet: the live card, opened and closed here at panel speed (the card itself stays "shown" so its
            // own slide stays out of the way).
            <motion.div
              ref={field}
              initial={false}
              animate={{ height: recipient.show ? 'auto' : 0, opacity: recipient.show ? 1 : 0 }}
              transition={openHeight(recipient.show, reduced)}
              // opened: it comes into view (a short window's cards scroll inside), and after Paste an address it takes the focus
              onAnimationComplete={() => {
                if (!recipient.show) return;
                field.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
                if (focusField.current) { focusField.current = false; focusInput(); }
              }}
              className="overflow-hidden"
            >
              <WalletAddressInput
                token={to!}
                address={recipient.address}
                setAddress={(a) => f.set({ recipient: { ...recipient, address: a, error: recipientError(to, a) } })}
                validationError={recipient.show ? recipient.error || '' : ''}
                onValidationError={() => {}}
                show
                avatar={to!.chainLogo}
              />
            </motion.div>
          )}
          {both && smartTyped && recipient.show && (
            // PROVISIONAL copy (plan 2 Smart wallets, awaiting Jeff)
            <p className="mt-2 px-2 text-xs text-warn">
              You are using a smart wallet. Type the address that should receive on {to!.chainName}, and make sure it is yours there.
            </p>
          )}
          </div>
          {actions('mt-3 max-lg:hidden md:mt-4 md:short:mt-3', false)}
        </motion.div>
        {(column || linkColumn) && (
          // The panel's height comes from the left column (Jeff 2026-11-05: no gap above the button); only Send To Wallet grows it.
          // A short window's left column is lower than 300 px: the floor follows, so the column never makes the panel taller.
          <div data-testid="swap-routes" className="relative w-full lg:min-h-[300px] lg:flex-1 lg:short:min-h-[240px]">
            <div className="lg:absolute lg:inset-0">
              <RouteOptionsList
                enter={mounted}
                state={linkColumn || state === 'loading' ? 'loading' : state === 'ready' ? 'ready' : 'empty'}
                options={views}
                toToken={{ symbol: to?.symbol ?? '', logo: to?.logo ?? '' }}
                selectedKey={picked?.key ?? null}
                // the quote timer: only while a price shows; it counts from the fetch and again with each 20 s refresh
                timer={state === 'ready' && picked ? <CountdownLabel startedAt={updatedAt} fetching={fetching} /> : undefined}
                onSelect={(key) => {
                  const o = options.find((x) => x.key === key);
                  if (o) f.set({ tag: o.tags[0]! });
                }}
                {...paused}
              />
            </div>
          </div>
        )}
      </div>
      {actions('lg:hidden', true)}
    </PanelBox>
  );
}
