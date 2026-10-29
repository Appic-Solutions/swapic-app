// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c).
import type * as React from 'react';
import { CustomCard } from '@/components/landing';
import { DiscountIcon, FireIcon, LockIcon } from '@/components/landing/icons';
import { ClockIcon } from '@/components/icons';
import { Title, section } from './Title';

const WHY: [string, string, React.ReactNode][] = [
  ['No gas needed', 'Pick Gasless and you only sign. Swapic sends the transaction and pays the gas.', <FireIcon key="f" width={20} height={20} />],
  ['All or nothing', 'You get everything you were quoted, or your money back as USDC. A swap never pays out half.', <LockIcon key="l" width={20} height={20} />],
  ['Fast', 'Most swaps arrive in seconds, and every step is tracked live.', <ClockIcon key="c" width={20} height={20} />],
  ['Clear prices', 'The total fee is shown before you sign. What you see is what you get.', <DiscountIcon key="d" width={20} height={20} />],
];

export function Why() {
  return (
    <section className={section}>
      <Title title="Why Swapic" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {WHY.map(([label, text, icon]) => <CustomCard key={label} label={label} description={text} icon={icon} className="h-full" />)}
      </div>
    </section>
  );
}
