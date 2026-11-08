'use client';
// One short grey line under a panel's main button (or a list's heading): what can be done now (the texts:
// lib/copy/hints.ts). On a short window it hangs in the panel's bottom padding (its parent is relative), so it never makes
// the panel taller; a tiny window leaves it out and shows HintButton instead, a "?" where it costs no height (beside the
// main button, the search field or the heading) that shows the same line in a small popover. `hang={false}`: always in
// the flow (a column that scrolls inside anyway, the pool page's; or a place that hides it itself with its className).
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HelpIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';

export function Hint({ text, hang = true, className }: { text?: string | null; hang?: boolean; className?: string }) {
  if (!text) return null;
  return (
    <p data-testid="hint" className={cn('mt-2 text-center text-xs font-normal text-secondary', hang && 'md:short:absolute md:short:inset-x-0 md:short:top-full md:short:mt-1 md:tiny:hidden', className)}>
      {text}
    </p>
  );
}

/**
 * The hint on a tiny window (768 px wide or more, at most 560 px high), where the line is left out: a "?" that shows it in
 * a small popover. A click or a tap keeps it open until a second one, a click outside or Escape; a mouse over it or a
 * keyboard focus shows it while there. Taller windows and phones keep the line and never show this.
 */
export function HintButton({ text, className }: { text?: string | null; className?: string }) {
  const [pinned, setPinned] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  if (!text) return null;
  const open = pinned || hover || focus;
  const close = () => { setPinned(false); setHover(false); setFocus(false); };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <PopoverTrigger
        type="button"
        aria-label="Show hint"
        // the popover's own toggle is skipped: a click pins it (a mouse over it has opened it already) or closes it
        onClick={(e) => { e.preventDefault(); if (pinned) close(); else setPinned(true); }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(false); }}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFocus(true); }}
        onBlur={() => setFocus(false)}
        className={cn(
          'hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-secondary hover:bg-white/[0.06] hover:text-white md:tiny:inline-flex',
          tw.quick,
          tw.pressIcon,
          open && 'text-white',
          className,
        )}
      >
        <HelpIcon width={18} height={18} />
      </PopoverTrigger>
      <PopoverContent
        role="tooltip"
        side="top"
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-[260px] rounded-xl px-3 py-2 text-xs font-normal leading-4 text-white"
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
