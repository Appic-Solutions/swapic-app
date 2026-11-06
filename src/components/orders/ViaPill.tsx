// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';

// Via Swapic: quiet text and the logo. Every order shows Swapic as the provider, whatever runs behind it.
export function ViaPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-x-1 whitespace-nowrap text-xs font-normal text-secondary">
      via <span className="font-medium text-white">Swapic</span>
      <img src={SWAPIC_LOGO} alt="" width={14} height={14} className="h-3.5 w-3.5" />
    </span>
  );
}
