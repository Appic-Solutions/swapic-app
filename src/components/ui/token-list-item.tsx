'use client';

import { LinkIcon } from '@/components/icons';
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
}: {
  token: UiToken;
  onClick: () => void;
  isSelected: boolean;
  /** The tick, or a flag (pill after the symbol, badge on the logo). */
  mark?: TokenMark;
}) => {
  const flag = mark === 'fake' || mark === 'unverified' ? mark : null;
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between rounded-md p-2 hover:bg-[#2A2A2A]',
        isSelected && 'bg-[#2A2A2A]',
      )}
    >
      <div
        className={cn('group flex min-w-0 flex-grow cursor-pointer items-center gap-x-5 duration-200')}
        onClick={onClick}
      >
        <div className="relative shrink-0">
          <Avatar src={token.logo} alt={token.name} className="h-12 w-12" />
          {flag && <LogoBadge mark={flag} />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex items-center gap-x-1.5 text-xl font-bold text-white">
            <span className="truncate">{token.symbol}</span>
            <MarkAfterSymbol mark={mark} symbol={token.symbol} chainName={token.chainName} />
          </p>
          <div className="h-5 overflow-hidden">
            <div className="flex flex-col transition-transform duration-300 group-hover:-translate-y-5">
              <p className="truncate text-sm font-semibold text-[#B5B3B3]">{token.name}</p>
              <p className="flex items-center gap-x-2 truncate text-sm font-semibold text-[#B5B3B3]">
                {token?.contractAddress?.slice(0, 14) || token?.canisterId?.slice(0, 14)}
                <Link
                  href={tokenLink(token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md p-0.5 hover:bg-white/10"
                >
                  <LinkIcon width={18} height={18} />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      {token.balanceText && (
        <div className="flex flex-col">
          <p className="truncate text-xl font-bold text-white">{token.balanceText}</p>
          <p className="flex items-center gap-x-2 truncate text-sm font-semibold text-[#B5B3B3]">
            {token.usdBalanceText}
          </p>
        </div>
      )}
    </div>
  );
};

export default TokenCard;
