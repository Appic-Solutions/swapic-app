'use client';
// Moved from the design's scanner-screens.tsx SearchBox: the search field in the live RHFInput look; wallets turn into chips.
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar } from '@/components/ui/avatar';
import { T, tw } from '@/lib/motion';
import { CloseIcon, ScannerIcon } from '@/components/icons';
import { config } from '@/config';
import { short } from '@/lib/copy/format';
import { FIELD } from '@/components/ui/styles';
import { chainLogo } from '@/lib/explorer';

export type Chip = { kind: 'evm' | 'icp'; value: string };

export function SearchBox({ chips, text, onText, onSubmit, onRemove }: { chips: Chip[]; text: string; onText: (s: string) => void; onSubmit: () => void; onRemove: (c: Chip) => void }) {
  return (
    <div className={'flex min-h-10 w-full flex-wrap items-center gap-1.5 px-3 py-1 md:max-w-[560px] ' + FIELD}>
      <ScannerIcon width={16} height={16} className="shrink-0 text-secondary" />
      {/* A wallet becomes a chip: it grows in; removed, it shrinks out and the rest close up (motion row 61). */}
      <AnimatePresence initial={false} mode="popLayout">
      {chips.map((c) => (
        <motion.span
          key={c.value}
          layout="position"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1, transition: T.enter }}
          exit={{ opacity: 0, scale: 0.9, transition: T.exit }}
          transition={{ layout: T.enter }}
          className="flex items-center gap-x-1.5 rounded-full bg-white/10 py-0.5 pl-0.5 pr-1.5 text-xs font-medium"
        >
          <Avatar src={c.kind === 'icp' ? chainLogo(config.icpChain) : chainLogo('eip155:1')} className="h-5 w-5" />
          <span className="font-mono">{short(c.value)}</span>
          <span onClick={() => onRemove(c)} className={'cursor-pointer rounded-full p-0.5 text-secondary hover:bg-white/10 hover:text-white ' + tw.quick + ' ' + tw.pressIcon}>
            <CloseIcon width={16} height={16} />
          </span>
        </motion.span>
      ))}
      </AnimatePresence>
      <input
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        placeholder={chips.length ? 'Add another wallet' : 'Search address, principal, order ID or tx hash'}
        className="h-7 min-w-[180px] flex-1 border-none bg-transparent text-sm text-white outline-none ring-0 placeholder:text-faint"
      />
    </div>
  );
}
