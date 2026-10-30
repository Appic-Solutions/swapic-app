'use client';
// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import { motion } from 'motion/react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import { PanelBox } from '@/components/motion/parts';
import { cn } from '@/lib/cn';
import { fade, tw } from '@/lib/motion';

// Back link of the real BoxHeader: fades on hover, sinks a little when pressed (the approved motion).
const BACK = '[&_button]:transition [&_button]:duration-150 [&_button:hover]:opacity-70 [&_button:active]:scale-[0.97] motion-reduce:[&_button:active]:scale-100';

// Stake and Withdraw share the Swap panel layout: inputs left, outcome right
// (stacked on phones). The panel ends at the action button, and both columns
// end at the same height (the outcome card grows, its rows sit at the bottom).
// data-testid col-left and col-right let the click-throughs measure the two columns.
// inPlace (the Swap panel's Review swap and Your swap, approved motion 2026-10-29): inside a MorphFrame its Box is the
// frame's and its parts fade in place; the back link and the button answer hover and press. Without it the layout is the
// static one (the Pool's motion is not approved yet).
// longTitle (Review withdrawal): the title one size smaller on phones, so it clears Back.
export function TwoColumn({ title, onBack, left, right, action, inPlace, longTitle }: { title: string; onBack?: () => void; left: React.ReactNode; right: React.ReactNode; action: React.ReactNode; inPlace?: boolean; longTitle?: boolean }) {
  if (inPlace) {
    return (
      <PanelBox className="flex h-full flex-col gap-6 overflow-x-hidden md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px]">
        <motion.div variants={fade} className={cn(BACK, longTitle && 'max-md:[&_p]:text-xl')}><BoxHeader title={title} onBack={onBack} /></motion.div>
        <div className="flex w-full flex-col gap-x-4 gap-y-4 lg:flex-row lg:items-stretch">
          <div data-testid="col-left" className="flex w-full flex-col lg:max-w-[482px] lg:shrink-0">
            {left}
            <motion.div variants={fade} className={cn('mt-4 w-full max-lg:hidden lg:mt-auto lg:pt-4', tw.quick, tw.press)}>{action}</motion.div>
          </div>
          <div data-testid="col-right" className="flex w-full flex-col gap-y-4">{right}</div>
        </div>
        <motion.div variants={fade} className={cn('w-full lg:hidden', tw.quick, tw.press)}>{action}</motion.div>
      </PanelBox>
    );
  }
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
