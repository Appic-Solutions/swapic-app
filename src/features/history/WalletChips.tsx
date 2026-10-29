// Moved from the design's history-screens.tsx WalletChips: the connected wallets the history covers (EVM and ICP together).
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { config } from '@/config';
import { short } from '@/lib/copy/format';
import { chainLogo } from '@/lib/explorer';

export function WalletChips({ wallets }: { wallets: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {wallets.map((a) => (
        <span key={a} className="flex items-center gap-x-1.5 rounded-full bg-white/10 py-1 pl-1 pr-2.5 text-xs font-semibold text-white">
          <Avatar src={a.startsWith('0x') ? chainLogo('eip155:1') : chainLogo(config.icpChain)} className="h-5 w-5" />
          <span className="font-mono">{short(a)}</span>
        </span>
      ))}
    </div>
  );
}
