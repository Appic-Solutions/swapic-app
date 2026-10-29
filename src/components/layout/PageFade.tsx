'use client';
import * as React from 'react';
import { motion } from 'motion/react';
import { fade } from '@/lib/motion';

/** Set once the app has hydrated: the page served first draws at once (its HTML must not start hidden), and every page
 *  opened from a tab after that fades in. */
let hydrated = false;

/** A tab's page fading in (250 ms, the entry easing); reduce motion keeps the fade. */
export function PageFade({ children }: { children: React.ReactNode }) {
  const [initial] = React.useState<false | 'hidden'>(() => (hydrated ? 'hidden' : false));
  React.useEffect(() => { hydrated = true; }, []);
  return (
    <motion.div variants={fade} initial={initial} animate="shown" className="flex w-full md:items-center md:justify-center">
      {children}
    </motion.div>
  );
}
