import { Shell } from '@/components/layout/Shell';
import { SwapHome } from '@/features/swap/components/SwapHome';

/** The Swap tab: the swap panel and the home page's info sections. */
export default function Home() {
  return (
    <Shell tab="Swap">
      <SwapHome />
    </Shell>
  );
}
