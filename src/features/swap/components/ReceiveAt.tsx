'use client';
// "Receive at" on the To card (as Relay does it, the tester's ask of 2026-11-08): a small control in the card's top right
// names where the swap pays out (your connected wallet, or the address pasted) and opens a menu of two: your wallet (or
// "Connect a wallet", the To chain's own connect flow, when none is connected) and "Paste an address" (the Send To Wallet
// field under the amount, with all its checks). It replaced the wallet button beside the main button. It sits over the
// card, so the card keeps its height: only the field, once asked for, opens under the amount.
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckIcon, ChevronDownIcon, CopyIcon, WalletIcon } from '@/components/icons';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';

export interface ReceiveAtProps {
  /** The connected wallet that can receive the To token (its kind, and not a smart wallet crossing chains), or null. */
  own: string | null;
  /** The address field is open: the swap pays out to the address typed there. */
  pasting: boolean;
  /** The address typed, and whether it passed the field's checks. */
  address: string;
  valid: boolean;
  /** Pay out to the connected wallet (closes the field). */
  onOwn: () => void;
  /** No wallet of the To side yet: its connect flow. */
  onConnect: () => void;
  /** Open the address field. */
  onPaste: () => void;
  className?: string;
}

const ITEM = cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-white hover:bg-white/[0.06]', tw.quick, tw.pressRow);

export function ReceiveAt({ own, pasting, address, valid, onOwn, onConnect, onPaste, className }: ReceiveAtProps) {
  const [open, setOpen] = React.useState(false);
  const showsAddress = pasting && valid;
  const value = showsAddress ? short(address) : pasting ? 'New address' : own ? 'Your wallet' : 'Not set';
  const pick = (go: () => void) => () => { setOpen(false); go(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Receive at: ${value}`}
        className={cn(
          'flex h-6 max-w-full select-none items-center gap-1 whitespace-nowrap rounded-full bg-white/[0.06] pl-2 pr-1.5 text-xs font-medium text-secondary hover:bg-white/10 hover:text-white',
          tw.quick,
          tw.press,
          className,
        )}
      >
        {/* the words fit beside a name; an address alone fills the chip (the card's narrow on a phone: the name alone) */}
        <span className={cn('max-md:hidden', showsAddress && 'hidden')}>Receive at</span>
        <span className="truncate text-white">{value}</span>
        <ChevronDownIcon width={14} height={14} className={cn('shrink-0 transition-transform', tw.panel, open && 'rotate-180')} />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="flex w-[248px] flex-col gap-1 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        {own ? (
          <button type="button" onClick={pick(onOwn)} className={cn(ITEM, !pasting && 'bg-white/[0.06]')}>
            <WalletIcon width={18} height={18} className="shrink-0 text-secondary" />
            <span className="flex min-w-0 flex-1 flex-col">
              Your wallet
              <span className="truncate font-mono text-xs font-normal text-secondary">{short(own)}</span>
            </span>
            {!pasting && <CheckIcon width={16} height={16} className="shrink-0 text-secondary" />}
          </button>
        ) : (
          <button type="button" onClick={pick(onConnect)} className={ITEM}>
            <WalletIcon width={18} height={18} className="shrink-0 text-secondary" />
            <span className="flex-1">Connect a wallet</span>
          </button>
        )}
        <button type="button" onClick={pick(onPaste)} className={cn(ITEM, pasting && 'bg-white/[0.06]')}>
          <CopyIcon width={18} height={18} className="shrink-0 text-secondary" />
          <span className="flex-1">Paste an address</span>
          {pasting && <CheckIcon width={16} height={16} className="shrink-0 text-secondary" />}
        </button>
      </PopoverContent>
    </Popover>
  );
}
