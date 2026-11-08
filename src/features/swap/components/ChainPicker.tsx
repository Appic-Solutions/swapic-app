'use client';
// The token page's chain picker (Jeff chose layout B of the canvas, 2026-11-04: eleven chains made the old grid three rows
// tall and left room for about two tokens). One button the height of the search box, beside it, names the chain shown;
// it opens a compact menu (two columns of logo and name), "All chains" first. Every token row carries its chain badge.
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChainsIcon, ChevronDownIcon } from '@/components/icons';
import type { ChainInfo } from '@/lib/api';
import { chainLogo, chainName, chainNumber } from '@/lib/explorer';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';

/** The token page's "chain" when every chain shows at once. */
export const ALL_CHAINS = 'all';

const nameOf = (chain: string) => (chain === ALL_CHAINS ? 'All chains' : chainName(chain));

/** "All chains" as a logo sized round mark. */
function AllMark() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
      <ChainsIcon width={16} height={16} />
    </span>
  );
}

const Mark = ({ chain }: { chain: string }) => (chain === ALL_CHAINS ? <AllMark /> : <Avatar src={chainLogo(chain)} className="h-7 w-7" />);

export function ChainMenu({ chains, value, onChange }: {
  /** The chains to offer, in the table's order. */
  chains: ChainInfo[];
  /** The chain shown (CAIP-2), or ALL_CHAINS. */
  value: string;
  onChange: (chain: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const items = [ALL_CHAINS, ...chains.map((c) => c.chainId)];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn('flex h-10 shrink-0 select-none items-center gap-2 rounded-xl border border-line bg-white/[0.06] pl-1.5 pr-3 text-white hover:bg-white/10', tw.quick, tw.press)}
        aria-label={`Chain: ${nameOf(value)}`}
      >
        <Mark chain={value} />
        <span className="max-w-[9rem] truncate whitespace-nowrap font-semibold max-md:max-w-[6.5rem]">{nameOf(value)}</span>
        <ChevronDownIcon width={16} height={16} className={cn('shrink-0 text-secondary transition-transform', tw.panel, open && 'rotate-180')} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="grid w-[320px] grid-cols-2 gap-1 p-2 max-md:w-[calc(100vw-48px)] max-md:bg-[#141414]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {items.map((id) => (
          <button
            key={id}
            type="button"
            // a test hook, not a visible change
            data-chain-id={id === ALL_CHAINS ? 'all' : chainNumber(id) ?? id}
            aria-pressed={id === value}
            onClick={() => { onChange(id); setOpen(false); }}
            className={cn('flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm font-semibold text-white hover:bg-white/[0.06]', tw.quick, tw.pressRow, id === value && 'bg-white/[0.06]')}
          >
            <Mark chain={id} />
            <span className="truncate">{nameOf(id)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The search box's placeholder: it names what the list shows. */
export const searchPlaceholder = (chain: string) => (chain === ALL_CHAINS ? 'Search all chains' : `Search tokens on ${chainName(chain)}`);
