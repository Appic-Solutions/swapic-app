import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { markOf } from '@/lib/token-marks';
import { LogoBadge, MarkAfterSymbol } from './token-marks';
import type { UiToken } from './token-types';

interface TokenCardProps {
  customOnClick: () => void;
  token: UiToken | undefined;
  label: string;
  className?: string;
}

export function TokenCard({ token, customOnClick, label, className }: TokenCardProps) {
  const chainName = token?.chainName ?? '';
  const mark = token ? markOf(token) : null;
  // the card is narrow and the From card's right edge holds the switch button: a flag rides the logo's top right
  // (its bottom right holds the chain), only the tick follows the symbol
  const flag = mark === 'fake' || mark === 'unverified' ? mark : null;
  return (
    <Card
      className={cn(
        'max-h-[133px] cursor-pointer flex-col items-start justify-center gap-2 md:max-h-[155px]',
        className,
      )}
      onClick={() => {
        customOnClick?.();
      }}
    >
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar src={token?.logo} className="h-12 w-12" />
          <Avatar
            src={token?.chainLogo ?? ''}
            className="absolute -bottom-1 -right-1 h-5 w-5 shadow-[0_0_3px_0_rgba(255,255,255,0.5)]"
          />
          {flag && <LogoBadge mark={flag} top />}
          {flag && <span className="sr-only">{flag === 'fake' ? 'Fake' : 'Unverified'}</span>}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-x-1.5">
            <span className={token ? 'inline-block max-w-28 truncate align-bottom' : 'text-nowrap'}>{token?.symbol || 'Select Token'}</span>
            {token && mark === 'verified' && <MarkAfterSymbol mark={mark} symbol={token.symbol} chainName={chainName} size={18} />}
          </p>
          <p className={cn('text-sm', chainName.length > 3 && 'w-20 text-ellipsis')}>{chainName}</p>
        </div>
      </div>
    </Card>
  );
}
