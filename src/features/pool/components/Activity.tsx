// Moved from the design's pool-screens.tsx Activity: stakes, withdrawals and what stakers earned from swaps (contract 5.4);
// each row opens the order in the Scanner.
import * as React from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { statCard } from '@/components/design/stat-card';
import { FireIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';
import { activityRows } from '../data';
import { USDC_LOGO } from '../usdc';

export function Activity({ rows }: { rows: ReturnType<typeof activityRows> }) {
  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-xl font-bold text-white md:text-2xl">Activity</p>
      <div className={statCard}>
        {rows.map((a) => (
          // a row lights up on hover (motion part 2); it opens the order in the Scanner
          <Link key={a.id} href={`/scanner?order=${encodeURIComponent(a.id)}`} className={cn('-mx-3 -my-1.5 flex items-center justify-between gap-3 rounded-xl px-3 py-1.5 hover:bg-white/5', tw.quick)}>
            <div className="flex min-w-0 items-center gap-x-3">
              {a.kind === 'premium' ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12B76A33] text-[#12b76a]">
                  <FireIcon width={18} height={18} />
                </div>
              ) : (
                <div className="relative shrink-0">
                  <Avatar src={USDC_LOGO} className="h-9 w-9" />
                  {a.chainLogo && <Avatar src={a.chainLogo} className="absolute -bottom-1 -right-1 h-4 w-4" />}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{a.title}</p>
                <p className="truncate text-xs text-[#898989]">{a.sub}</p>
              </div>
            </div>
            <p className={cn('shrink-0 text-sm font-bold', a.amount.startsWith('-') ? 'text-white/70' : a.kind === 'premium' ? 'text-[#12b76a]' : 'text-white')}>{a.amount}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
