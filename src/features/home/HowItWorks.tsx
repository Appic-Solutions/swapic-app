'use client';
// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The number tiles read the Scanner's 24 hour numbers (contract 5.12).
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CustomCard } from '@/components/landing';
import { ArrowRightIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { QUIET } from '@/components/ui/styles';
import { SkeletonText } from '@/components/ui/skeleton';
import { getScannerStats } from '@/lib/api';
import { homeStats } from './stats';
import { Title, section } from './Title';

const STEPS = [
  ['1', 'Pick any token', 'From Ethereum, Base, Arbitrum, Polygon or ICP, to any of them. Sending to someone else? Paste their wallet.'],
  ['2', 'Sign once', 'Pick Gasless and you only sign: Swapic pays the network gas. The total fee is shown before you sign.'],
  ['3', 'It arrives', 'Most swaps land in seconds. You get all of it, or your money back as USDC. Never half.'],
];

export function HowItWorks() {
  const stats = useQuery({ queryKey: ['scanner-stats'], queryFn: getScannerStats, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const n = homeStats(stats.data);
  const tiles: [string | undefined, string][] = [[n?.swaps, 'swaps in 24 hours'], [n?.median, 'median swap time'], [n?.delivered, 'delivered in full']];
  return (
    <section id="how" className={section}>
      <Title title="How Swapic works" sub="One swap between any two chains. No bridges to pick and no extra steps." />
      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map(([k, label, text]) => (
          <CustomCard key={k} label={label!} description={text!} icon={<span className="flex h-5 w-5 items-center justify-center text-sm font-semibold">{k}</span>} className="h-full" />
        ))}
      </div>
      <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center">
        <div className="grid w-full grid-cols-3 gap-3 md:w-auto">
          {tiles.map(([value, label]) => (
            <div key={label} className="flex min-w-0 flex-col gap-y-1 rounded-3xl border border-line bg-input-fields p-4 text-white md:min-w-[170px] md:p-5">
              {value === undefined ? <SkeletonText className="w-16 max-w-full font-semibold md:text-xl" /> : <p className="font-semibold md:text-xl">{value}</p>}
              <p className="text-xs text-secondary">{label}</p>
            </div>
          ))}
        </div>
        <Link href="/scanner" className={cn(QUIET, 'h-12 cursor-pointer px-5 text-sm')}>
          See every swap live in the Scanner
          <ArrowRightIcon width={16} height={16} />
        </Link>
      </div>
    </section>
  );
}
