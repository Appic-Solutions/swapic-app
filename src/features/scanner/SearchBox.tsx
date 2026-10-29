// Moved from the design's scanner-screens.tsx SearchBox: the search field in the live RHFInput look; wallets turn into chips.
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { CloseIcon, ManageSearchIcon } from '@/components/icons';
import { config } from '@/config';
import { short } from '@/lib/copy/format';
import { chainLogo } from '@/lib/explorer';

export type Chip = { kind: 'evm' | 'icp'; value: string };

export function SearchBox({ chips, text, onText, onSubmit, onRemove }: { chips: Chip[]; text: string; onText: (s: string) => void; onSubmit: () => void; onRemove: (c: Chip) => void }) {
  return (
    <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-lg bg-white/30 px-3 py-1.5 text-white transition-shadow duration-200 focus-within:ring-2 focus-within:ring-white/40 md:max-w-[560px]">
      <ManageSearchIcon width={20} height={20} className="shrink-0 text-white/70" />
      {chips.map((c) => (
        <span key={c.value} className="flex animate-slide-in-from-top items-center gap-x-1.5 rounded-full bg-black/40 py-0.5 pl-0.5 pr-1.5 text-xs font-semibold">
          <Avatar src={c.kind === 'icp' ? chainLogo(config.icpChain) : chainLogo('eip155:1')} className="h-5 w-5" />
          <span className="font-mono">{short(c.value)}</span>
          <span onClick={() => onRemove(c)} className="cursor-pointer rounded-full p-0.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <CloseIcon width={12} height={12} />
          </span>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        placeholder={chips.length ? 'Add another wallet' : 'Search address, principal, order ID or tx hash'}
        className="h-7 min-w-[180px] flex-1 border-none bg-transparent text-sm text-white outline-none ring-0 placeholder:text-white/50"
      />
    </div>
  );
}
