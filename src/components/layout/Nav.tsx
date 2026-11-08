'use client';
// The four tab nav: the design's Shell.tsx Nav in the live Navbar's markup, with Next links, and the approved motion
// (src/lib/motion.ts): the dark highlight is one element that slides from tab to tab (layoutId), tabs answer hover and
// press, and on phones (only the active tab shows its label) the tabs' content glides to its new place while the new
// label fades in. data-testid="tab-nav" lets the click-throughs find it.
import * as React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { HistoryIcon, PoolIcon, ScannerIcon, SwapIcon } from '@/components/icons';
import { T, press, useMounted, usePhone } from '@/lib/motion';
import { useNavTab } from '@/lib/nav-tab';

export type Tab = 'Swap' | 'Pool' | 'History' | 'Scanner';

const TABS: [Tab, string, React.ComponentType<React.SVGProps<SVGSVGElement>>][] = [
  ['Swap', '/', SwapIcon],
  ['Pool', '/pool', PoolIcon],
  ['History', '/history', HistoryIcon],
  ['Scanner', '/scanner', ScannerIcon],
];

const MotionLink = motion.create(Link);

export function Nav({ active: own }: { active: Tab }) {
  // a page showing another tab's page in place moves the highlight there (useNavTab)
  const override = useNavTab((s) => s.override);
  const reset = useNavTab((s) => s.reset);
  const active = override ?? own;
  const mounted = useMounted();
  const phone = usePhone();
  return (
    <div
      data-testid="tab-nav"
      className={
        'fixed bottom-0 z-[99] w-full bg-gradient-to-t from-[#060607] from-60% to-transparent pb-4 pt-6 xl:absolute xl:top-8 xl:h-max xl:max-w-[640px] xl:bg-none xl:p-0 md:mx-auto' +
        // short windows from 1024 px wide: in the header row, a little lower (beside the logo and the wallet button)
        ' lg:short:absolute lg:short:bottom-auto lg:short:top-4 lg:short:h-max lg:short:max-w-[520px] lg:short:bg-none lg:short:p-0 lg:tiny:top-3 xl:short:top-4 xl:short:max-w-[640px] xl:tiny:top-3'
      }
    >
      <ul className="mx-auto flex w-full max-w-[calc(100%-48px)] items-center justify-between gap-x-1 rounded-full border border-line bg-[#141416] p-1.5 text-white md:max-w-[640px] lg:short:p-1">
        {TABS.map(([label, href, Icon]) => {
          const on = label === active;
          return (
            <li key={label} className={'relative flex-1 rounded-full transition-colors duration-100 ' + (on ? '' : 'text-secondary hover:text-white')}>
              {/* The highlight: one element that slides from tab to tab. */}
              {on && (
                <motion.span
                  layoutId="nav-highlight"
                  className="absolute inset-0 rounded-full bg-white/10"
                  style={{ borderRadius: 9999 }}
                  transition={T.big}
                />
              )}
              <MotionLink
                href={href}
                // a click on the page's own tab takes its panel back to its first view (useNavReset)
                onClick={label === own ? () => reset(label) : undefined}
                layout="position"
                layoutDependency={active}
                transition={{ default: T.hover, layout: T.big }}
                whileTap={press}
                className="relative flex h-10 items-center justify-center gap-x-1.5 px-3 lg:short:h-9"
              >
                <Icon width={20} height={20} className="shrink-0" />
                <motion.span
                  // Phones: the label of the tab picked fades in after the highlight starts moving.
                  key={phone && on ? 'on' : 'label'}
                  initial={mounted && phone && on ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ ...T.enter, delay: on ? T.enter.duration * 0.4 : 0 }}
                  className={(on ? 'inline-flex' : 'hidden') + ' md:inline-flex whitespace-nowrap text-sm font-medium'}
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
