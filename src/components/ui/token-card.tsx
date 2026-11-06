import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import { markOf } from '@/lib/token-marks';
import { LogoBadge, MarkAfterSymbol } from './token-marks';
import type { UiToken } from './token-types';

interface TokenCardProps {
  customOnClick: () => void;
  token: UiToken | undefined;
  label: string;
  className?: string;
  /** The token is known but its details have not answered yet: the card's shape, never "Select Token". */
  loading?: boolean;
}

export function TokenCard({ token, customOnClick, label, className, loading }: TokenCardProps) {
  const chainName = token?.chainName ?? '';
  const mark = token ? markOf(token) : null;
  // the card is narrow and the From card's right edge holds the switch button: a flag rides the logo's top right
  // (its bottom right holds the chain), only the tick follows the symbol
  const flag = mark === 'fake' || mark === 'unverified' ? mark : null;
  return (
    <Card
      className={cn(
        'max-h-[133px] cursor-pointer flex-col items-start justify-center gap-2 p-4 md:max-h-[155px] md:p-5',
        className,
      )}
      onClick={() => {
        customOnClick?.();
      }}
    >
      <p className="text-xs font-medium text-secondary md:text-sm">{label}</p>
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <div className="relative">
          <Avatar src={token?.logo} className="h-9 w-9 md:h-12 md:w-12" fallback={loading ? <Skeleton className="h-full w-full bg-transparent" /> : undefined} />
          <Avatar
            src={token?.chainLogo ?? ''}
            className="absolute -bottom-1 -right-1 h-4 w-4 ring-2 ring-[#18181a] md:h-5 md:w-5"
          />
          {flag && <LogoBadge mark={flag} top />}
          {flag && <span className="sr-only">{flag === 'fake' ? 'Fake' : 'Unverified'}</span>}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-x-1 text-base leading-6 md:gap-x-1.5 md:text-2xl md:leading-8">
            {loading ? <SkeletonText className="w-16 md:w-24" /> : <span className={token ? 'inline-block max-w-20 truncate align-bottom md:max-w-28' : 'text-nowrap'}>{token?.symbol || 'Select Token'}</span>}
            {token && mark === 'verified' && <MarkAfterSymbol mark={mark} symbol={token.symbol} chainName={chainName} size={16} />}
          </p>
          <p className={cn('text-xs font-normal leading-4 text-secondary md:text-sm', chainName.length > 3 && 'w-20 text-ellipsis')}>{loading ? <SkeletonText className="w-14" /> : chainName}</p>
        </div>
      </div>
    </Card>
  );
}
