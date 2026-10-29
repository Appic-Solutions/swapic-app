import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import type { UiToken } from './token-types';

interface TokenCardProps {
  customOnClick: () => void;
  token: UiToken | undefined;
  label: string;
  className?: string;
}

export function TokenCard({ token, customOnClick, label, className }: TokenCardProps) {
  const chainName = token?.chainName ?? '';
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
        </div>
        <div>
          <p
            className={cn(
              'text-nowrap',
              token?.symbol.length && token?.symbol.length > 7 && 'w-28 text-ellipsis',
            )}
          >
            {token?.symbol || 'Select Token'}
          </p>
          <p className={cn('text-sm', chainName.length > 3 && 'w-20 text-ellipsis')}>{chainName}</p>
        </div>
      </div>
    </Card>
  );
}
