// Withdraw, first step when both wallets hold a stake: which one. Moved from the design's pool-screens.tsx WithdrawPick
// (cards in the route option look, a blue border when picked). A stake pays out where its wallet lives (contract section 2).
import * as React from 'react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import ActionButton from '@/components/ui/action-button';
import { short } from '@/lib/copy/format';
import { chainLogo } from '@/lib/explorer';
import { formatUsd } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { MyStake } from '../data';

const ICP_WALLET_LOGO = '/images/logo/wallet_logos/icp.svg';

/** "Base, Arbitrum, Ethereum or Polygon": the chain names joined, the last with "or". */
export const orList = (names: string[]) => names.join(', ').replace(/, ([^,]*)$/, ' or $1');

export function WithdrawPick({ stakes, picked, evmChains, onPick, onBack, onContinue }: {
  stakes: MyStake[]; picked: MyStake['kind']; evmChains: string[];
  onPick: (k: MyStake['kind']) => void; onBack: () => void; onContinue: () => void;
}) {
  const total = stakes.reduce((a, s) => a + s.valueUsdc, 0n);
  return (
    <Box className="flex flex-col gap-6 md:max-w-[537px]">
      <BoxHeader title="Withdraw" onBack={onBack} />
      <p className="w-full text-sm text-[#898989]">Your stake is in two wallets. Pick the one to withdraw from.</p>
      <div className="flex w-full flex-col gap-4">
        {stakes.map((st) => (
          <Card
            key={st.kind}
            onClick={() => onPick(st.kind)}
            className={cn(
              'cursor-pointer flex-col items-start gap-3 rounded-[20px] border bg-highlighted-card !py-4 px-4 transition duration-300 hover:-translate-y-0.5 active:scale-[0.99] md:rounded-[36px] md:px-6',
              picked === st.kind ? 'border-blue-600' : 'border-gray-700',
            )}
          >
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-x-3">
                <Avatar src={st.kind === 'icp' ? ICP_WALLET_LOGO : chainLogo('eip155:1')} className="h-10 w-10 lg:h-12 lg:w-12" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#898989]">Staked from</p>
                  <p className="truncate font-mono text-base lg:text-xl">{short(st.owner)}</p>
                </div>
              </div>
              <p className="shrink-0 text-base lg:text-xl">{formatUsd(st.valueUsdc)}</p>
            </div>
            <p className="text-xs font-normal text-[#898989]">Pays out on {st.kind === 'icp' ? 'ICP' : orList(evmChains)}</p>
          </Card>
        ))}
      </div>
      <div className="flex w-full justify-between text-sm text-white">
        <span className="text-muted">Your stake</span>
        <span className="font-semibold">{formatUsd(total)}</span>
      </div>
      <div className="w-full transition-transform duration-150 active:scale-[0.98]">
        <ActionButton isDisabled={false} onClick={onContinue}>Continue</ActionButton>
      </div>
    </Box>
  );
}
