// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';

// Stake and Withdraw share the Swap panel layout: inputs left, outcome right
// (stacked on phones). The panel ends at the action button, and both columns
// end at the same height (the outcome card grows, its rows sit at the bottom).
// data-testid col-left and col-right let the click-throughs measure the two columns.
export function TwoColumn({ title, onBack, left, right, action }: { title: string; onBack?: () => void; left: React.ReactNode; right: React.ReactNode; action: React.ReactNode }) {
  return (
    <Box className="flex h-full flex-col gap-6 overflow-x-hidden md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px]">
      <BoxHeader title={title} onBack={onBack} />
      <div className="flex w-full flex-col gap-x-4 gap-y-4 lg:flex-row lg:items-stretch">
        <div data-testid="col-left" className="flex w-full flex-col lg:max-w-[482px] lg:shrink-0">
          {left}
          <div className="mt-4 w-full transition-transform duration-150 active:scale-[0.98] max-lg:hidden lg:mt-auto lg:pt-4">{action}</div>
        </div>
        <div data-testid="col-right" className="flex w-full flex-col gap-y-4">{right}</div>
      </div>
      <div className="w-full transition-transform duration-150 active:scale-[0.98] lg:hidden">{action}</div>
    </Box>
  );
}
