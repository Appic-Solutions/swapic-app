'use client';
// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import { motion } from 'motion/react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import { PanelBox } from '@/components/motion/parts';
import { cn } from '@/lib/cn';
import { fade, tw } from '@/lib/motion';
import { useScrollFade } from '@/components/ui/use-scroll-fade';
import { BODY_FIT } from './fit';
import { Hint } from './Hint';

// Back link of the real BoxHeader: fades on hover, sinks a little when pressed (the approved motion).
const BACK = '[&_button]:transition [&_button]:duration-100 [&_button:hover]:opacity-70 [&_button:active]:scale-[0.97] motion-reduce:[&_button:active]:scale-100';
// Short windows (a laptop at 125%): the title one size smaller, Back at the compact panel's padding (MorphFrame's viewClass).
const COMPACT_HEADER = 'md:short:[&_p]:text-2xl md:short:[&_button]:left-6 md:tiny:[&_button]:left-5';

// Stake and Withdraw share the Swap panel layout: inputs left, outcome right
// (stacked on phones). The panel ends at the action button, and both columns
// end at the same height (the outcome card grows, its rows sit at the bottom).
// data-testid col-left and col-right let the click-throughs measure the two columns.
// inPlace (the Swap panel's Review swap and Your swap, approved motion 2026-10-29): inside a MorphFrame its Box is the
// frame's and its parts fade in place; the back link and the button answer hover and press. Without it the layout is the
// static one (the Pool's motion is not approved yet).
// longTitle (Review withdrawal): the title one size smaller on phones, so it clears Back.
// Short windows (inPlace): the body takes at most the window's height (fit.ts BODY_FIT) and scrolls inside, fading at an
// edge with more behind it: from lg each column on its own (the left one above its button, so the button always shows),
// below lg the whole body above the button. On a taller window nothing scrolls here and the wrappers add nothing.
export function TwoColumn({ title, onBack, left, right, action, inPlace, longTitle, hint }: { title: string; onBack?: () => void; left: React.ReactNode; right: React.ReactNode; action: React.ReactNode; inPlace?: boolean; longTitle?: boolean; /** One grey line under the button: what can be done now (Hint). */ hint?: string | null }) {
  const body = useScrollFade<HTMLDivElement>();
  const leftFade = useScrollFade<HTMLDivElement>();
  const rightFade = useScrollFade<HTMLDivElement>();
  if (inPlace) {
    return (
      <PanelBox className="flex h-full flex-col gap-6 overflow-x-hidden md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px]">
        <motion.div variants={fade} className={cn(BACK, COMPACT_HEADER, longTitle && 'max-md:[&_p]:text-xl')}><BoxHeader title={title} onBack={onBack} /></motion.div>
        <div ref={body.ref} className={cn('no-scrollbar flex w-full flex-col gap-x-4 gap-y-4 lg:flex-row lg:items-stretch', BODY_FIT, 'md:short:overflow-y-auto max-lg:short:[&>*]:shrink-0 lg:short:overflow-y-visible', body.fade)}>
          <div data-testid="col-left" className="flex w-full min-w-0 flex-col lg:max-w-[482px] lg:shrink-0 lg:short:min-h-0">
            {/* contents: on a taller window this wrapper is not there for the layout (its cards stay the column's own) */}
            <div ref={leftFade.ref} className={cn('no-scrollbar contents lg:short:flex lg:short:min-h-0 lg:short:flex-1 lg:short:flex-col lg:short:overflow-y-auto lg:short:[&>*]:shrink-0 lg:short:[&>*]:basis-auto', leftFade.fade)}>{left}</div>
            <motion.div variants={fade} className={cn('relative mt-4 w-full max-lg:hidden lg:mt-auto lg:pt-4 lg:short:shrink-0', tw.quick, tw.press)}>{action}<Hint text={hint} /></motion.div>
          </div>
          <div ref={rightFade.ref} data-testid="col-right" className={cn('no-scrollbar flex w-full min-w-0 flex-col gap-y-4 lg:short:min-h-0 lg:short:overflow-y-auto lg:short:[&>*]:shrink-0', rightFade.fade)}>{right}</div>
        </div>
        <motion.div variants={fade} className={cn('relative w-full lg:hidden', tw.quick, tw.press)}>{action}<Hint text={hint} /></motion.div>
      </PanelBox>
    );
  }
  return (
    <Box className="flex h-full flex-col gap-6 overflow-x-hidden md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px]">
      <BoxHeader title={title} onBack={onBack} />
      <div className="flex w-full flex-col gap-x-4 gap-y-4 lg:flex-row lg:items-stretch">
        <div data-testid="col-left" className="flex w-full min-w-0 flex-col lg:max-w-[482px] lg:shrink-0">
          {left}
          <div className="mt-4 w-full transition-transform duration-100 active:scale-[0.98] max-lg:hidden lg:mt-auto lg:pt-4">{action}</div>
        </div>
        <div data-testid="col-right" className="flex w-full min-w-0 flex-col gap-y-4">{right}</div>
      </div>
      <div className="w-full transition-transform duration-100 active:scale-[0.98] lg:hidden">{action}</div>
    </Box>
  );
}
