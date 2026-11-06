'use client';
// Moved from the design's pool-screens.tsx: small pieces the pool screens share.
import * as React from 'react';
import { motion } from 'motion/react';
import { Avatar } from '@/components/ui/avatar';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { T } from '@/lib/motion';
import { USDC_LOGO } from '../usdc';

// A stake: USDC with the Swapic mark.
export const StakeAvatar = ({ className = 'h-12 w-12' }: { className?: string }) => (
  <div className="relative shrink-0">
    <Avatar src={USDC_LOGO} className={className} />
    <Avatar src={SWAPIC_LOGO} className="absolute -bottom-1 -right-1 h-5 w-5 bg-black p-0.5 shadow-[0_0_3px_0_rgba(255,255,255,0.5)]" />
  </div>
);

/** The active pill of the chart timeframes and the percent chips: one element that slides to the pill picked. */
export function SlidingPill({ id }: { id: string }) {
  return (
    <motion.span
      layoutId={id}
      className="absolute inset-0 rounded-full bg-white/[0.14]"
      style={{ borderRadius: 9999 }}
      transition={T.big}
    />
  );
}
