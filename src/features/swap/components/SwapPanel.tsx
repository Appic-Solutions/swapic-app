'use client';
// The swap panel: moved from the design's swap-screens.tsx SwapPanel (the approved static look, as the design bundle
// built 2026-10-29 14:46 holds it; the motion pass comes later from one shared module), wired to the form, the quote,
// the balance and the wallets. Desktop: inputs left; the route column takes the left column's height and scrolls, so the
// panel ends at Review swap and grows when Send To Wallet opens. Phones: stacked, routes in a sideways row.
import * as React from 'react';
import Link from 'next/link';
import Box from '@/components/ui/box';
import { TokenCard } from '@/components/ui/token-card';
import ActionButton from '@/components/ui/action-button';
import WalletAddressInput from '@/components/ui/wallet-address-input';
import AmountCard from '@/components/design/AmountCard';
import RouteOptionsList from '@/components/design/RouteOptionsList';
import { ArrowsUpDownIcon, HistoryIcon, WalletIcon } from '@/components/icons';
import { formatAmount, formatUnits, formatUsd, maxIcp, maxNative, nativeReserve, parseUnits, usdMicro } from '@/lib/money';
import { icpClient } from '@/lib/icp';
import { useEvmConnect, useEvmSigner, useIcpConnect, useWallets } from '@/lib/wallets';
import { swapButton } from '../button';
import { recipientError, useSwapForm } from '../form';
import { ICP_PAUSED, useSwapQuote } from '../quote';
import { useBalance, useChains, useTokenList } from '../tokens';
import { isSameChainNoUsdc, routeView, type NativeCoin } from '../view';

const NO_ROUTE = 'No route found for this amount';
const PAUSED = 'Swaps are paused right now';
const PAUSED_TEXT = 'No new swap can start for now. Try again in a little while. Swaps you already started show in History.';
const ZERO = '0x0000000000000000000000000000000000000000';
/** The gas price Max falls back to when the wallet cannot tell: 50 gwei. */
const FALLBACK_FEE_PER_GAS = 50_000_000_000n;

export function SwapPanel({ onPick, onReview }: { onPick: (side: 'from' | 'to') => void; onReview: () => void }) {
  const f = useSwapForm();
  const { evm, icp } = useWallets();
  const signer = useEvmSigner();
  const openEvm = useEvmConnect();
  const openIcp = useIcpConnect();
  const { query, quote, state, options, picked, error } = useSwapQuote();
  const { from, to, recipient } = f;
  const both = !!from && !!to;
  const column = both && state !== 'none';
  const pickedCard = 'py-5 md:rounded-3xl md:py-5 max-h-min md:max-h-min md:px-6';

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
  const { balance, loading: balanceLoading } = useBalance(from);
  const overBalance = amount !== null && balance !== undefined && amount > balance;
  const fromWallet = from ? (from.chain_type === 'ICP' ? !!icp : !!evm) : false;
  const usd = from && amount !== null ? usdMicro(amount, from.decimals, from.priceUsd) : null;

  // the From chain's coin, priced by its row in the token list (the gas row of the route cards)
  const { chains } = useChains();
  const fromChain = chains.find((c) => c.chainId === from?.chain);
  const coinRow = useTokenList(from && from.chain_type === 'EVM' ? from.chain : '', '').tokens.find((t) => t.address === ZERO);
  const native: NativeCoin = {
    symbol: fromChain?.nativeToken.symbol ?? '',
    decimals: fromChain?.nativeToken.decimals ?? 18,
    priceUsd: coinRow?.priceUsd ?? null,
  };
  const sameChainNoUsdc = quote ? isSameChainNoUsdc(quote, fromChain?.usdc.address) : false;
  const views = from && to && amount !== null ? options.map((o) => routeView(o, { from, to, amountIn: amount!, sameChainNoUsdc, native })) : [];

  // the From side can pay but the To side has no wallet and no address yet: open Send To Wallet so the button asks for
  // one. With no From wallet, "Connect wallet" comes first (spec 5.1; plan 2 Task 12's no wallet test).
  const ownRecipient = to ? (to.chain_type === 'ICP' ? !!icp : !!evm) : true;
  React.useEffect(() => {
    if (fromWallet && to && !ownRecipient && !recipient.show && !recipient.address) {
      f.set({ recipient: { show: true, address: '', error: recipientError(to, '') } });
    }
  }, [fromWallet, to, ownRecipient, recipient.show, recipient.address, f]);

  const message = state === 'empty' ? NO_ROUTE : overBalance && from ? `Not enough ${from.symbol} in your wallet` : state === 'error' ? error ?? undefined : undefined;
  const button = swapButton({
    from: !!from, to: !!to, amount, amountError, overBalance, quote: state, hasOptions: options.length > 0,
    recipientShown: recipient.show, recipientError: recipient.show ? recipient.error || null : null, fromWallet, recipient: !!query?.recipient,
  });

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
    if (button.enabled) onReview();
  };

  const actions = (cls: string) => (
    <div className={'flex w-full items-center gap-x-2 ' + cls}>
      <div className="w-full transition-transform duration-150 active:scale-[0.98]">
        <ActionButton isDisabled={!button.enabled} onClick={button.enabled ? onButton : undefined}>
          {button.text}
        </ActionButton>
      </div>
      <div
        onClick={() => f.set({ recipient: { ...recipient, show: !recipient.show, error: recipientError(to, recipient.address) } })}
        className={'flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full bg-primary-buttons px-4 transition-all duration-300 ease-in-out hover:opacity-85 active:scale-90 ' + (recipient.show ? 'ring-2 ring-white/40' : '')}
      >
        <WalletIcon className="text-white" />
      </div>
    </div>
  );

  const paused = state === 'paused' ? { emptyTitle: PAUSED, emptyText: PAUSED_TEXT } : state === 'icpPaused' ? { emptyTitle: 'Paused for now', emptyText: ICP_PAUSED } : {};

  return (
    <Box className={'flex h-full flex-col gap-6 overflow-x-hidden transition-[max-width] duration-500 ease-in-out md:h-fit md:w-full md:max-w-[537px] ' + (column ? 'lg:max-w-[1060px]' : '')}>
      <div className="flex w-full items-center justify-between text-white">
        <h1 className="text-2xl font-bold md:text-3xl">Swap</h1>
        <Link href="/history" className="flex cursor-pointer items-center gap-x-2 text-sm transition-opacity hover:opacity-70">
          <HistoryIcon width={20} height={20} />
          History
        </Link>
      </div>
      <div className="flex w-full flex-1 flex-col justify-between gap-x-4 gap-y-6 lg:flex-row">
        <div data-testid="swap-left" className="flex w-full flex-col lg:max-w-[482px] lg:shrink-0">
          <div className={'relative flex w-full ' + (both ? 'flex-col gap-y-4 sm:flex-row sm:gap-x-4' : 'flex-col gap-y-4')}>
            <TokenCard token={from ?? undefined} customOnClick={() => onPick('from')} label="From" className={(from ? pickedCard : '') + ' active:scale-[0.98]'} />
            <div
              onClick={() => f.flip()}
              className={'group absolute inset-0 z-20 m-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-white/30 bg-[#0B0B0B] text-white transition-transform duration-300 active:scale-90 ' + (both ? 'hover:rotate-180 sm:rotate-90 sm:hover:-rotate-90' : 'hover:rotate-180')}
            >
              <ArrowsUpDownIcon width={20} height={20} />
            </div>
            <TokenCard token={to ?? undefined} customOnClick={() => onPick('to')} label="To" className={(to ? pickedCard : '') + ' active:scale-[0.98]'} />
          </div>
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
            />
          )}
          {both && (
            <WalletAddressInput
              token={to!}
              address={recipient.address}
              setAddress={(a) => f.set({ recipient: { ...recipient, address: a, error: recipientError(to, a) } })}
              validationError={recipient.show ? recipient.error || '' : ''}
              onValidationError={() => {}}
              show={recipient.show}
              avatar={to!.chainLogo}
            />
          )}
          {actions('mt-4 max-lg:hidden')}
        </div>
        {column && (
          <div data-testid="swap-routes" className="relative w-full lg:min-h-[300px] lg:flex-1">
            <div className="lg:absolute lg:inset-0">
              <RouteOptionsList
                key={state}
                state={state === 'loading' ? 'loading' : state === 'ready' ? 'ready' : 'empty'}
                options={views}
                toToken={{ symbol: to!.symbol, logo: to!.logo }}
                selectedKey={picked?.key ?? null}
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
      {actions('lg:hidden')}
    </Box>
  );
}
