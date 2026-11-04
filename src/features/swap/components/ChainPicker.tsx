'use client';
// The token page's chain picker, in the layouts Jeff compares on the canvas (2026-11-04: eleven chains made today's grid
// three rows tall and left room for about two tokens). One component, one switch:
//   grid  today's five per row (the default, unchanged);
//   row   one row of smaller logos that scrolls sideways; "All chains" first; the picked chain shows its name;
//   menu  one button beside the search box opening a compact chain menu; every token row carries its chain badge;
//   column one column of logos down the left of the list; the list keeps the panel's full height.
import * as React from 'react';
import ChainItem from '@/components/ui/chain-item';
import { Avatar } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BlockchainIcon, ChevronDownIcon } from '@/components/icons';
import type { ChainInfo } from '@/lib/api';
import { chainLogo, chainName, chainNumber } from '@/lib/explorer';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';

export type ChainPickerKind = 'grid' | 'row' | 'menu' | 'column';
/** The token page's "chain" when every chain shows at once. */
export const ALL_CHAINS = 'all';

export interface ChainPickerProps {
  /** The chains to offer, in the table's order. */
  chains: ChainInfo[];
  /** The picked CAIP-2 chain, or ALL_CHAINS. */
  value: string;
  onChange: (chain: string) => void;
  /** Offer "All chains" first. */
  all: boolean;
}

const nameOf = (chain: string) => (chain === ALL_CHAINS ? 'All chains' : chainName(chain));

/** Today's grid: five logos a row, the name in a tooltip. */
export function ChainGrid({ chains, value, onChange }: ChainPickerProps) {
  return (
    <div className="grid w-full select-none grid-cols-5 place-items-center gap-5">
      {chains.map((c) => (
        <div key={c.chainId} className={cn('rounded-full hover:scale-[1.06] active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100', tw.quick)}>
          <ChainItem
            chain={{ chainId: chainNumber(c.chainId), name: c.name, logo: chainLogo(c.chainId) }}
            selectedId={value === ALL_CHAINS ? -1 : chainNumber(value)}
            onClick={() => onChange(c.chainId)}
          />
        </div>
      ))}
    </div>
  );
}

/** "All chains" as a logo sized round mark (the menu and the column). */
function AllMark({ size }: { size: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-white/15 text-white', size)}>
      <BlockchainIcon width={16} height={16} />
    </span>
  );
}

/** One logo button with its name in a tooltip (hover); picked: the selection ring the grid uses. */
function ChainDot({ chain, picked, onPick, side }: { chain: string; picked: boolean; onPick: () => void; side: 'bottom' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger
        data-chain-id={chain === ALL_CHAINS ? 'all' : chainNumber(chain)}
        aria-label={nameOf(chain)}
        aria-pressed={picked}
        onClick={onPick}
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:scale-[1.08] active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100', tw.quick, picked && 'ring-2 ring-offset-2 ring-offset-[#141414]')}
      >
        {chain === ALL_CHAINS ? <AllMark size="h-9 w-9" /> : <Avatar src={chainLogo(chain)} className="h-9 w-9" />}
      </TooltipTrigger>
      <TooltipContent side={side}>{nameOf(chain)}</TooltipContent>
    </Tooltip>
  );
}

/** Variant A: one row that scrolls sideways (the mouse wheel scrolls it too); "All chains" first; the picked chain is a
 *  pill with its name, so the name shows on a phone, where tooltips never open. The row fades at an edge with more. */
export function ChainRow({ chains, value, onChange, all }: ChainPickerProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });
  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  // the picked chain in view once the chains have come (the first time only); the edge fades follow the row
  const centered = React.useRef(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    const picked = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && picked && chains.length && !centered.current) {
      centered.current = true;
      // only when the picked chain would sit under the right edge's fade; "All chains" stays in view otherwise
      const right = picked.getBoundingClientRect().right - el.getBoundingClientRect().left;
      if (right > el.clientWidth - 36) el.scrollLeft = right - el.clientWidth + 48;
    }
    measure();
  }, [chains.length, value, measure]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  const fade = edges.start && edges.end
    ? '[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]'
    : edges.end ? '[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]'
      : edges.start ? '[mask-image:linear-gradient(to_right,transparent,black_28px)]' : '';
  const items = [...(all ? [ALL_CHAINS] : []), ...chains.map((c) => c.chainId)];
  return (
    <TooltipProvider>
      <div
        ref={ref}
        onScroll={measure}
        className={cn('-mx-1 -my-1.5 flex w-[calc(100%+0.5rem)] select-none items-center gap-3 overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', fade)}
      >
        {items.map((id) => (id === value ? (
          <button
            key={id}
            type="button"
            aria-pressed
            data-chain-id={id === ALL_CHAINS ? 'all' : chainNumber(id)}
            className={cn('flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/10 pr-4 text-sm font-semibold text-white ring-2', id === ALL_CHAINS ? 'pl-4' : 'pl-1', tw.quick, tw.press)}
          >
            {id !== ALL_CHAINS && <Avatar src={chainLogo(id)} className="h-7 w-7" />}
            <span className="whitespace-nowrap">{nameOf(id)}</span>
          </button>
        ) : id === ALL_CHAINS ? (
          <button
            key={id}
            type="button"
            aria-pressed={false}
            data-chain-id="all"
            onClick={() => onChange(id)}
            className={cn('flex h-9 shrink-0 items-center rounded-full bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15', tw.quick, tw.press)}
          >
            <span className="whitespace-nowrap">All chains</span>
          </button>
        ) : (
          <ChainDot key={id} chain={id} picked={false} onPick={() => onChange(id)} side="bottom" />
        )))}
      </div>
    </TooltipProvider>
  );
}

/** Variant B: a button the height of the search box, beside it, naming the picked chain; it opens the chain menu (two
 *  columns of logo and name). */
export function ChainMenu({ chains, value, onChange, all }: ChainPickerProps) {
  const [open, setOpen] = React.useState(false);
  const items = [...(all ? [ALL_CHAINS] : []), ...chains.map((c) => c.chainId)];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn('flex h-10 shrink-0 select-none items-center gap-2 rounded-md bg-white/30 pl-1.5 pr-3 text-white hover:bg-white/40', tw.quick, tw.press)}
        aria-label={`Chain: ${nameOf(value)}`}
      >
        {value === ALL_CHAINS ? <AllMark size="h-7 w-7" /> : <Avatar src={chainLogo(value)} className="h-7 w-7" />}
        <span className="max-w-[9rem] truncate whitespace-nowrap font-semibold max-md:max-w-[6.5rem]">{nameOf(value)}</span>
        <ChevronDownIcon width={12} height={7} className={cn('shrink-0 transition-transform', tw.panel, open && 'rotate-180')} />
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
            data-chain-id={id === ALL_CHAINS ? 'all' : chainNumber(id)}
            aria-pressed={id === value}
            onClick={() => { onChange(id); setOpen(false); }}
            className={cn('flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-semibold text-white hover:bg-[#2A2A2A]', tw.quick, tw.pressRow, id === value && 'bg-[#2A2A2A]')}
          >
            {id === ALL_CHAINS ? <AllMark size="h-7 w-7" /> : <Avatar src={chainLogo(id)} className="h-7 w-7" />}
            <span className="truncate">{nameOf(id)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Variant C: one column of logos down the list's left; "All chains" on top; names in tooltips (the search box names the
 *  picked chain, for phones). */
export function ChainColumn({ chains, value, onChange, all }: ChainPickerProps) {
  const items = [...(all ? [ALL_CHAINS] : []), ...chains.map((c) => c.chainId)];
  return (
    <TooltipProvider>
      <div className="flex w-11 shrink-0 select-none flex-col items-center gap-3 overflow-y-auto px-1 py-1 [scrollbar-width:none] md:h-full [&::-webkit-scrollbar]:hidden">
        {items.map((id) => <ChainDot key={id} chain={id} picked={id === value} onPick={() => onChange(id)} side="right" />)}
      </div>
    </TooltipProvider>
  );
}

/** The search box's placeholder in the new layouts: it names what the list shows. */
export const searchPlaceholder = (kind: ChainPickerKind, chain: string) =>
  kind === 'grid' ? 'Search token' : chain === ALL_CHAINS ? 'Search all chains' : `Search tokens on ${chainName(chain)}`;
