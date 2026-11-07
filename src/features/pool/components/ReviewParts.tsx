'use client';
// Pieces Review stake, Review withdrawal and Your stake share (approved 2026-10-30, design pool-screens.tsx "review and
// status"): built from Review swap's pieces (its left card, the "In your wallet" steps, Send to's wallet row) and Your swap's
// details card. Inside these views everything only fades with its view (the calm fade, motion row 68): no rise, no slide.
import * as React from 'react';
import { motion } from 'motion/react';
import { Avatar } from '@/components/ui/avatar';
import { InfoRow } from '@/components/design/InfoRow';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { statCard } from '@/components/design/stat-card';
import { CopyButton, useCopied } from '@/components/orders/CopyButton';
import { Steps } from '@/components/orders/Steps';
import type { SideView, StepView } from '@/components/orders/types';
import type { UiToken } from '@/components/ui/token-types';
import { ArrowDownIcon } from '@/components/icons';
import { short, tokenAmountText } from '@/lib/copy/format';
import { chainLogo, chainName } from '@/lib/explorer';
import { formatUsd, usdMicro } from '@/lib/money';
import { cn } from '@/lib/cn';
import { fade } from '@/lib/motion';
import { USDC_LOGO } from '../usdc';
import type { WalletStep } from '../review';

/** Review swap's left card, class for class. */
export const REVIEW_CARD = 'cursor-auto flex-col items-start justify-between gap-4 lg:flex-1';

export const ArrowDown = () => (
  <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-secondary"><ArrowDownIcon width={16} height={16} /></div>
);

/** A token amount as a side (its chain's badge). USDC and ckUSDC count as dollars, as Stake and Withdraw show them. */
export const tokenSide = (t: UiToken, amount: bigint, prefix = ''): SideView => {
  const dollar = (t.symbol === 'USDC' || t.symbol === 'ckUSDC') && t.decimals === 6;
  const usd = dollar ? amount : usdMicro(amount, t.decimals, t.priceUsd);
  return { symbol: t.symbol, logo: t.logo, chain: chainName(t.chain), chainLogo: chainLogo(t.chain), amountText: `${prefix}${tokenAmountText(amount, t.decimals, t.symbol)}`, usdText: usd === null ? '' : formatUsd(usd) };
};

/** USDC in your stake, as a side (the Swapic mark on it). */
export const inPool = (usdc: bigint, prefix = '', chain = 'Swapic Pool'): SideView => ({
  symbol: 'USDC', logo: USDC_LOGO, chain, chainLogo: SWAPIC_LOGO, amountText: `${prefix}${tokenAmountText(usdc, 6, 'USDC')}`, usdText: formatUsd(usdc),
});

/** Fee and timing beside a review (Your swap's details card look). */
export function Details({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <motion.div variants={fade} className={cn(statCard, 'gap-y-2.5')}>
      {rows.map(([k, v]) => <InfoRow key={k} k={k}>{v}</InfoRow>)}
    </motion.div>
  );
}

/** Your wallet in a review (Review swap's "Send to" row): the chain, which wallet, shortened, copy. */
export function WalletRow({ k, icp, address, logo }: { k: string; icp: boolean; address: string; logo: string }) {
  const [copied, copy] = useCopied();
  return (
    <InfoRow k={k}>
      <Avatar src={logo} className="h-5 w-5" />
      <span className="max-sm:hidden">{icp ? 'Your ICP wallet' : 'Your EVM wallet'}</span>
      <span className="font-mono font-normal text-white">{short(address)}</span>
      <CopyButton id="to" copied={copied} onCopy={copy} text={address} />
    </InfoRow>
  );
}

/** The wallet steps with their state; the open one says "Check your wallet", or `waiting` once its transaction was sent
 *  and the network is awaited. */
export const walletSteps = (steps: WalletStep[], states?: StepView['state'][], waiting?: string): StepView[] =>
  steps.map((s, i) => { const state = states?.[i] ?? 'todo'; return { key: `w${i}`, label: s.label, sub: state === 'wait' ? waiting ?? 'Check your wallet' : s.sub, state }; });

/** "In your wallet": the steps ahead, numbered; each checks in as the wallet answers. */
export function WalletStepsCard({ steps }: { steps: StepView[] }) {
  return (
    <motion.div variants={fade} className={cn(statCard, 'gap-y-4 lg:flex-1')}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xl font-semibold text-white">In your wallet</p>
        <p className="text-sm text-secondary">{steps.length === 1 ? '1 step' : `${steps.length} steps`}</p>
      </div>
      <Steps steps={steps} numbered animated />
    </motion.div>
  );
}
