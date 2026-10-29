'use client';
// The four tab nav: the design's Shell.tsx Nav in the live Navbar's markup, with Next links, and the approved motion
// (src/lib/motion.ts): the dark highlight is one element that slides from tab to tab (layoutId), tabs answer hover and
// press, and on phones (only the active tab shows its label) the tabs' content glides to its new place while the new
// label fades in. data-testid="tab-nav" lets the click-throughs find it.
import * as React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { BlockchainIcon, HistoryIcon, ManageSearchIcon, PoolIcon } from '@/components/icons';
import { T, press, useMounted, usePhone } from '@/lib/motion';

export type Tab = 'Swap' | 'Pool' | 'History' | 'Scanner';

const TABS: [Tab, string, React.ComponentType<React.SVGProps<SVGSVGElement>>][] = [
  ['Swap', '/', BlockchainIcon],
  ['Pool', '/pool', PoolIcon],
  ['History', '/history', HistoryIcon],
  ['Scanner', '/scanner', ManageSearchIcon],
];

const MotionLink = motion.create(Link);

export function Nav({ active }: { active: Tab }) {
  const mounted = useMounted();
  const phone = usePhone();
  return (
    <div data-testid="tab-nav" className="fixed bottom-0 z-[99] w-full pb-5 xl:pb-0 h-max md:mx-auto xl:absolute xl:top-8 xl:max-w-[800px]">
      <ul className="flex items-center justify-center gap-x-6 xs:gap-x-8 lg:gap-x-1 bg-[radial-gradient(75.61%_136.07%_at_48.06%_0%,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0)_100%)] rounded-full border-2 border-white/30 text-white backdrop-blur-sm px-[4%] py-2 sm:px-3 mx-auto w-full max-w-[90%] md:max-w-[840px]">
        {TABS.map(([label, href, Icon]) => {
          const on = label === active;
          return (
            <li key={label} className={'relative flex-1 rounded-full ' + (on ? '' : 'lg:hover:bg-[linear-gradient(81.4deg,rgba(0,0,0,0.2)_-15.41%,rgba(29,29,29,0.2)_113.98%)]')}>
              {/* The highlight: one element that slides from tab to tab. */}
              {on && (
                <motion.span
                  layoutId="nav-highlight"
                  className="absolute inset-0 rounded-full bg-[linear-gradient(81.4deg,#000000_-15.41%,#1D1D1D_113.98%)]"
                  style={{ borderRadius: 9999 }}
                  transition={T.big}
                />
              )}
              <MotionLink
                href={href}
                layout="position"
                layoutDependency={active}
                transition={{ default: T.hover, layout: T.big }}
                whileTap={press}
                className={'relative flex items-center justify-center gap-x-1 md:gap-x-1.5 sm:py-2.5 md:px-3 md:py-3' + (on ? ' max-md:px-4 max-sm:py-2.5' : '')}
              >
                <Icon width={24} height={24} className="min-h-5 min-w-5 md:min-h-6 md:min-w-6" />
                <motion.span
                  // Phones: the label of the tab picked fades in after the highlight starts moving.
                  key={phone && on ? 'on' : 'label'}
                  initial={mounted && phone && on ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ ...T.enter, delay: on ? T.enter.duration * 0.4 : 0 }}
                  className={(on ? 'inline-flex' : 'hidden') + ' md:inline-flex whitespace-nowrap lg:font-bold'}
                >
                  {label}
                </motion.span>
              </MotionLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
