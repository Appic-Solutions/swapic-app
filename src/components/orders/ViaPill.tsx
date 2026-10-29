// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';

// The "via" pill (white on dark). Every order shows Swapic as the provider,
// whatever runs behind it.
export function ViaPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-x-1 whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#0F0F0F]">
      via Swapic
      <img src={SWAPIC_LOGO} alt="" width={16} height={16} className="min-h-4 min-w-4 rounded-full bg-black p-0.5" />
    </span>
  );
}
