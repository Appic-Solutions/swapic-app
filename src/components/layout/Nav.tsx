// The four tab nav: the design's Shell.tsx Nav (sha e6bbba19b098) in the live Navbar's markup, with Next links.
// data-testid="tab-nav" lets the click-throughs find it (the design draws it as a div, not a <nav>).
import * as React from 'react';
import Link from 'next/link';
import { BlockchainIcon, HistoryIcon, ManageSearchIcon, PoolIcon } from '@/components/icons';

export type Tab = 'Swap' | 'Pool' | 'History' | 'Scanner';

const TABS: [Tab, string, React.ComponentType<React.SVGProps<SVGSVGElement>>][] = [
  ['Swap', '/', BlockchainIcon],
  ['Pool', '/pool', PoolIcon],
  ['History', '/history', HistoryIcon],
  ['Scanner', '/scanner', ManageSearchIcon],
];

export function Nav({ active }: { active: Tab }) {
  return (
    <div data-testid="tab-nav" className="fixed bottom-0 z-[99] w-full pb-5 xl:pb-0 h-max md:mx-auto xl:absolute xl:top-8 xl:max-w-[800px]">
      <ul className="flex items-center justify-center gap-x-6 xs:gap-x-8 lg:gap-x-1 bg-[radial-gradient(75.61%_136.07%_at_48.06%_0%,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0)_100%)] rounded-full border-2 border-white/30 text-white backdrop-blur-sm px-[4%] py-2 sm:px-3 mx-auto w-full max-w-[90%] md:max-w-[840px]">
        {TABS.map(([label, href, Icon]) => {
          const on = label === active;
          return (
            <li key={label} className={(on ? 'bg-[linear-gradient(81.4deg,#000000_-15.41%,#1D1D1D_113.98%)] ' : '') + 'flex-1 rounded-full'}>
              <Link href={href} className={'flex items-center justify-center gap-x-1 md:gap-x-1.5 sm:py-2.5 md:px-3 md:py-3' + (on ? ' max-md:px-4 max-sm:py-2.5' : '')}>
                <Icon width={24} height={24} className="min-h-5 min-w-5 md:min-h-6 md:min-w-6" />
                <span className={(on ? 'inline-flex' : 'hidden') + ' md:inline-flex whitespace-nowrap lg:font-bold'}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
