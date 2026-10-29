// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import { cn } from '@/lib/cn';

// Small dark note card used beside results (the live #222 stats card look);
// blue while something waits, yellow for a warning.
export const Note = ({ icon, children, tone = 'plain' }: { icon: React.ReactNode; children: React.ReactNode; tone?: 'plain' | 'blue' | 'yellow' }) => (
  <div className={cn('flex animate-slide-in-from-top items-start gap-x-3 rounded-2xl p-4 text-sm text-white', tone === 'blue' ? 'bg-blue-600/35' : tone === 'yellow' ? 'bg-yellow-500/20' : 'bg-[#222222]')}>
    <span className={cn('mt-0.5 shrink-0', tone === 'yellow' && 'text-yellow-500')}>{icon}</span>
    <p>{children}</p>
  </div>
);
