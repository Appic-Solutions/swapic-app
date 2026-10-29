'use client';
// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The numbers are the pool's (contract 5.3); without a 7 day APY only the total staked shows, never a made up number.
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import Skeleton from '@/components/ui/skeleton';
import { ArrowRightIcon } from '@/components/landing/icons';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { getPool } from '@/lib/api';
import { cn } from '@/lib/cn';
import { earnNumbers } from './stats';
import { section } from './Title';

export function Earn() {
  const pool = useQuery({ queryKey: ['pool'], queryFn: getPool, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const n = earnNumbers(pool.data);
  return (
    <section className={section}>
      <div
        className={cn(
          'flex flex-col gap-8 rounded-[36px] p-8 text-white md:flex-row md:items-center md:justify-between md:p-12',
          'bg-[linear-gradient(159.81deg,_#1343A0_-34.87%,rgba(19,67,160,_0.5)_151.64%)] drop-shadow-[0_3px_20px_5px_#651FFF33]',
        )}
      >
        <div className="flex max-w-[520px] flex-col gap-y-4">
          <div className="flex items-center">
            <Avatar src="/images/tokens/usdc.png" className="h-10 w-10" />
            <Avatar src={SWAPIC_LOGO} className="-ml-3 h-10 w-10 bg-[#0B0B0B] p-2 ring-1 ring-white/20" />
          </div>
          <p className="text-2xl font-bold md:text-4xl">Earn with the Swapic Pool</p>
          <p className="text-sm leading-6 text-white/80 md:text-base">
            Stake USDC from any chain. It earns from every swap that uses the pool, and you can withdraw anytime, with no exit fee.
          </p>
        </div>
        <div className="flex flex-col gap-5 md:items-end">
          <div className="flex gap-6 md:gap-10">
            {!n ? (
              <Skeleton className="h-12 w-40 md:h-16" />
            ) : (
              <>
                {n.apy !== null && <div><p className="text-3xl font-bold md:text-5xl">{n.apy}</p><p className="text-xs text-white/70">APY, last 7 days</p></div>}
                <div><p className="text-3xl font-bold md:text-5xl">{n.staked}</p><p className="text-xs text-white/70">total staked</p></div>
              </>
            )}
          </div>
          <Link href="/pool/stake" className="flex w-full cursor-pointer items-center justify-center gap-x-2 rounded-xl bg-white px-6 py-3 font-semibold text-[#1343A0] transition-all hover:opacity-90 active:scale-95 md:w-auto">
            Stake USDC
            <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
