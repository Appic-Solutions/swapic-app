'use client';
// Withdraw, first step when both wallets hold a stake: which one. Moved from the design's pool-screens.tsx WithdrawPick
// (cards in the route option look, a blue border when picked). A stake pays out where its wallet lives (contract section 2).
// Motion (part 2): a view of the Pool's in place panel; its parts fade in place.
import * as React from 'react';
import { motion } from 'motion/react';
import { PanelBox } from '@/components/motion/parts';
import BoxHeader from '@/components/ui/box-header';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import ActionButton from '@/components/ui/action-button';
import { short } from '@/lib/copy/format';
import { chainLogo } from '@/lib/explorer';
import { formatUsd } from '@/lib/money';
import { cn } from '@/lib/cn';
import { fade, tw } from '@/lib/motion';
import type { MyStake } from '../data';

const ICP_WALLET_LOGO = '/images/logo/wallet_logos/icp.svg';

// Back link of the real BoxHeader: fades on hover, sinks a little when pressed.
const BACK = '[&_button]:transition [&_button]:duration-150 [&_button:hover]:opacity-70 [&_button:active]:scale-[0.97] motion-reduce:[&_button:active]:scale-100';

/** "Base, Arbitrum, Ethereum or Polygon": the chain names joined, the last with "or". */
export const orList = (names: string[]) => names.join(', ').replace(/, ([^,]*)$/, ' or $1');

export function WithdrawPick({ stakes, picked, evmChains, onPick, onBack, onContinue }: {
  stakes: MyStake[]; picked: MyStake['kind']; evmChains: string[];
  onPick: (k: MyStake['kind']) => void; onBack: () => void; onContinue: () => void;
}) {
  const total = stakes.reduce((a, s) => a + s.valueUsdc, 0n);
  return (
    <PanelBox className="flex flex-col gap-6 md:max-w-[537px]">
      <motion.div variants={fade} className={BACK}><BoxHeader title="Withdraw" onBack={onBack} /></motion.div>
      <motion.p variants={fade} className="w-full text-sm text-secondary">Your stake is in two wallets. Pick the one to withdraw from.</motion.p>
      <motion.div variants={fade} className="flex w-full flex-col gap-4">
        {stakes.map((st) => (
          <Card
            key={st.kind}
            onClick={() => onPick(st.kind)}
            className={cn(
              'cursor-pointer flex-col items-start gap-3 bg-highlighted-card p-4 transition-colors duration-200 hover:border-line-strong active:scale-[0.99] md:p-5',
              picked === st.kind ? 'border-blue-600' : 'border-line',
            )}
          >
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-x-3">
                <Avatar src={st.kind === 'icp' ? ICP_WALLET_LOGO : chainLogo('eip155:1')} className="h-10 w-10 lg:h-12 lg:w-12" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-secondary">Staked from</p>
                  <p className="truncate font-mono text-base lg:text-xl">{short(st.owner)}</p>
                </div>
              </div>
              <p className="shrink-0 text-base lg:text-xl">{formatUsd(st.valueUsdc)}</p>
            </div>
            <p className="text-xs font-normal text-secondary">Pays out on {st.kind === 'icp' ? 'ICP' : orList(evmChains)}</p>
          </Card>
        ))}
      </motion.div>
      <motion.div variants={fade} className="flex w-full justify-between text-sm text-white">
        <span className="text-secondary">Your stake</span>
        <span className="font-semibold">{formatUsd(total)}</span>
      </motion.div>
      <motion.div variants={fade} className={cn('w-full', tw.quick, tw.press)}>
        <ActionButton isDisabled={false} onClick={onContinue}>Continue</ActionButton>
      </motion.div>
    </PanelBox>
  );
}
