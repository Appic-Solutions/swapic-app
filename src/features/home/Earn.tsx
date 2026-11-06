'use client';
// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The numbers are the pool's (contract 5.3); without a 7 day APY only the total staked shows, never a made up number.
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { SkeletonText } from '@/components/ui/skeleton';
import { ArrowRightIcon } from '@/components/icons';
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
          'flex flex-col gap-8 rounded-3xl border border-line bg-highlighted-card p-6 text-white md:flex-row md:items-center md:justify-between md:p-10',
        )}
      >
        <div className="flex max-w-[520px] flex-col gap-y-4">
          <div className="flex items-center">
            <Avatar src="/images/tokens/usdc.png" className="h-10 w-10" />
            <Avatar src={SWAPIC_LOGO} className="-ml-3 h-10 w-10 bg-[#0B0B0B] p-2 ring-1 ring-white/20" />
          </div>
          <p className="text-2xl font-semibold md:text-3xl">Earn with the Swapic Pool</p>
          <p className="text-sm leading-6 text-secondary md:text-base">
            Stake USDC from any chain. It earns from every swap that uses the pool, and you can withdraw anytime, with no exit fee.
          </p>
        </div>
        <div className="flex flex-col gap-5 md:items-end">
          <div className="flex gap-6 md:gap-10">
            {!n ? (
              <>
                <div><SkeletonText className="w-20 text-2xl font-semibold md:w-24 md:text-4xl" /><p className="text-xs text-secondary">APY, last 7 days</p></div>
                <div><SkeletonText className="w-24 text-2xl font-semibold md:w-32 md:text-4xl" /><p className="text-xs text-secondary">total staked</p></div>
              </>
            ) : (
              <>
                {n.apy !== null && <div><p className="text-2xl font-semibold md:text-4xl">{n.apy}</p><p className="text-xs text-secondary">APY, last 7 days</p></div>}
                <div><p className="text-2xl font-semibold md:text-4xl">{n.staked}</p><p className="text-xs text-secondary">total staked</p></div>
              </>
            )}
          </div>
          <Link href="/pool/stake" className="flex h-12 w-full cursor-pointer items-center justify-center gap-x-2 rounded-xl bg-primary-buttons px-6 font-medium text-white transition hover:opacity-85 active:scale-[0.97] md:w-auto">
            Stake USDC
            <ArrowRightIcon width={20} height={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
