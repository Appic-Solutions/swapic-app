// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import type { SideView } from './types';

export function TokenAvatar({ side, size = 'h-12 w-12', badge = 'h-5 w-5', fly }: { side: SideView; size?: string; badge?: string; fly?: string }) {
  return (
    <div data-fly={fly} className="relative shrink-0">
      <Avatar src={side.logo} className={cn(size, side.logo === SWAPIC_LOGO && 'bg-[#0B0B0B] p-2 ring-1 ring-white/20')} />
      <Avatar src={side.chainLogo} className={cn('absolute -bottom-1 -right-1 shadow-[0_0_3px_0_rgba(255,255,255,0.5)]', side.chainLogo === SWAPIC_LOGO && 'bg-black p-0.5', badge)} />
    </div>
  );
}
