'use client';
// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The number tiles read the Scanner's 24 hour numbers (contract 5.12).
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CustomCard } from '@/components/landing';
import { ArrowRightIcon } from '@/components/landing/icons';
import Skeleton from '@/components/ui/skeleton';
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
          <CustomCard key={k} label={label!} description={text!} icon={<span className="flex h-5 w-5 items-center justify-center text-sm font-bold">{k}</span>} className="h-full" />
        ))}
      </div>
      <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center">
        <div className="grid w-full grid-cols-3 gap-3 md:w-auto">
          {tiles.map(([value, label]) => (
            <div key={label} className="flex min-w-[120px] flex-col gap-y-1 rounded-2xl bg-white/15 px-5 py-4 text-white md:min-w-[170px]">
              {value === undefined ? <Skeleton className="h-6 w-16 md:h-8" /> : <p className="font-bold md:text-2xl">{value}</p>}
              <p className="text-xs text-[#898989]">{label}</p>
            </div>
          ))}
        </div>
        <Link href="/scanner" className="flex cursor-pointer items-center gap-x-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-95">
          See every swap live in the Scanner
          <ArrowRightIcon width={18} height={18} />
        </Link>
      </div>
    </section>
  );
}
