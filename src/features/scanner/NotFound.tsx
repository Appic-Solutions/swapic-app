// Moved from the design's scanner-screens.tsx NotFound: names only the short form of what was searched.
import * as React from 'react';
import { short } from '@/lib/copy/format';
import { FindSwap } from './FindSwap';

export function NotFound({ query }: { query: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-y-4 rounded-2xl bg-[#272727] px-6 py-12 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/empty.png" alt="" width={90} height={90} />
      <p className="text-xl font-bold">Nothing found for <span className="font-mono">{short(query)}</span></p>
      <p className="max-w-[460px] text-sm leading-6 text-[#898989]">
        Try a full EVM address (0x and 40 characters), an ICP principal, a Swapic order ID or the hash of a transaction on any chain.
      </p>
      <FindSwap query={query} />
    </div>
  );
}
