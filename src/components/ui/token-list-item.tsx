'use client';

import { ExternalLinkIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { tokenLink } from '@/lib/explorer';
import type { TokenMark } from '@/lib/token-marks';
import { LogoBadge, MarkAfterSymbol } from './token-marks';
import type { UiToken } from './token-types';
import Link from 'next/link';
const TokenCard = ({
  token,
  onClick,
  isSelected,
  mark = 'plain',
  chainBadge = false,
}: {
  token: UiToken;
  onClick: () => void;
  isSelected: boolean;
  /** The tick, or a flag (pill after the symbol, badge on the logo). */
  mark?: TokenMark;
  /** The token's chain as a small logo on its logo's bottom right (a list that mixes chains, or hides the chain picked). */
  chainBadge?: boolean;
}) => {
  const flag = mark === 'fake' || mark === 'unverified' ? mark : null;
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between rounded-xl p-2 hover:bg-white/[0.06]',
        isSelected && 'bg-white/[0.06]',
      )}
    >
      <div
        className={cn('group flex min-w-0 flex-grow cursor-pointer items-center gap-x-3 duration-150')}
        onClick={onClick}
      >
        <div className="relative shrink-0">
          <Avatar src={token.logo} alt={token.name} className="h-10 w-10" />
          {chainBadge && (
            <Avatar src={token.chainLogo} alt={token.chainName} className="absolute -bottom-1 -right-1 h-4 w-4 ring-2 ring-[#141416]" />
          )}
          {flag && <LogoBadge mark={flag} top={chainBadge} />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex items-center gap-x-1.5 text-base font-semibold text-white">
            <span className="truncate">{token.symbol}</span>
            <MarkAfterSymbol mark={mark} symbol={token.symbol} chainName={token.chainName} />
          </p>
          <div className="h-5 overflow-hidden">
            <div className="flex flex-col transition-transform duration-200 group-hover:-translate-y-5">
              <p className="truncate text-sm font-normal text-secondary">{token.name}</p>
              <p className="flex items-center gap-x-2 truncate text-sm font-normal text-secondary">
                {token?.contractAddress?.slice(0, 14) || token?.canisterId?.slice(0, 14)}
                <Link
                  href={tokenLink(token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-xl p-0.5 hover:bg-white/10"
                >
                  <ExternalLinkIcon width={16} height={16} />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      {token.balanceText && (
        <div className="flex shrink-0 flex-col items-end text-right">
          <p className="truncate text-base font-medium tabular-nums text-white">{token.balanceText}</p>
          <p className="flex items-center gap-x-2 truncate text-sm font-normal tabular-nums text-secondary">
            {token.usdBalanceText}
          </p>
        </div>
      )}
    </div>
  );
};

export default TokenCard;
