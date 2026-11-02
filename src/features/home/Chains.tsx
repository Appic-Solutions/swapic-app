// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c).
import { Avatar } from '@/components/ui/avatar';
import { CHAINS } from '@/lib/chains';
import { chainLogo } from '@/lib/explorer';
import { ICP_CHAIN } from '@/config';
import { Title, section } from './Title';

const TOKENS: [string, string][] = [['USDC', '/images/tokens/usdc.png'], ['USDT', '/images/tokens/usdt.png'], ['ETH', chainLogo('eip155:1')], ['BTC', '/images/tokens/btc.png'], ['ICP', chainLogo(ICP_CHAIN)]];

export function Chains() {
  return (
    <section className={section}>
      <Title title="Every chain, one swap" sub="Swap between any of these chains in one step. More chains are on the way." />
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
        {CHAINS.map(({ name, logo }) => (
          <div key={name} className="flex items-center gap-x-3 rounded-full bg-white/10 py-2 pl-2 pr-5 text-white ring-1 ring-white/10 transition-colors hover:bg-white/15 md:py-2.5 md:pl-2.5 md:pr-6">
            <Avatar src={logo} className="h-8 w-8 md:h-10 md:w-10" />
            <span className="font-semibold md:text-lg">{name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-x-3 text-sm text-[#898989]">
        <div className="flex -space-x-2">
          {TOKENS.map(([s, logo]) => <Avatar key={s} src={logo} className="h-8 w-8 ring-2 ring-[#0B0B0B]" />)}
        </div>
        USDC, USDT, ETH, BTC, ICP and more
      </div>
    </section>
  );
}
