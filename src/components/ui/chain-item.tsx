import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';

type ChainItemChain = { chainId: number; name: string; logo: string };

export interface ChainItemProps {
  chain: ChainItemChain;
  selectedId: number;
  disabled?: boolean;
  onClick: (chain: ChainItemChain) => void;
}

export default function ChainItem({ chain, selectedId, disabled, onClick }: ChainItemProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          disabled={disabled}
          className={cn(
            'flex h-12 w-12 cursor-pointer select-none items-center justify-center rounded-full',
            selectedId === chain.chainId && 'ring-primary-buttons ring-4',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          onClick={() => {
            if (disabled) return;
            onClick(chain);
          }}
        >
          <Avatar src={chain.logo} className="h-12 w-12" />
        </TooltipTrigger>
        <TooltipContent side="bottom">{chain.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
