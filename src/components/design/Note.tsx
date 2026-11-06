// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import { cn } from '@/lib/cn';
import { NOTE_BLUE, NOTE_YELLOW } from '@/components/ui/styles';

// Small dark note card used beside results (the live #222 stats card look);
// blue while something waits, yellow for a warning. calm: no slide in, it only fades with its view (the reviews and Your
// stake, motion row 68).
export const Note = ({ icon, children, tone = 'plain', calm }: { icon: React.ReactNode; children: React.ReactNode; tone?: 'plain' | 'blue' | 'yellow'; calm?: boolean }) => (
  <div className={cn('flex items-start gap-x-3 rounded-2xl p-4 text-sm text-white', !calm && 'animate-slide-in-from-top', tone === 'blue' ? NOTE_BLUE : tone === 'yellow' ? NOTE_YELLOW : 'bg-inset')}>
    <span className={cn('mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4', tone === 'yellow' ? 'text-warn' : tone === 'blue' ? 'text-blue-300' : 'text-secondary')}>{icon}</span>
    <p>{children}</p>
  </div>
);
