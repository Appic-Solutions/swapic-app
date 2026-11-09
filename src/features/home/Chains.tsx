// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c).
import { Avatar } from '@/components/ui/avatar';
import { SHOWN_CHAINS } from '@/lib/chains';
import { chainLogo } from '@/lib/explorer';
import { ICP_CHAIN } from '@/config';
import { Title, section } from './Title';

const TOKENS: [string, string][] = [['USDC', '/images/tokens/usdc.png'], ['USDT', '/images/tokens/usdt.png'], ['ETH', chainLogo('eip155:1')], ['BTC', '/images/tokens/btc.png'], ['ICP', chainLogo(ICP_CHAIN)]];

export function Chains() {
  return (
    <section className={section}>
      <Title title="Every chain, one swap" sub="Swap between any of these chains in one step. More chains are on the way." />
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
        {SHOWN_CHAINS.map(({ name, logo }) => (
          <div key={name} className="flex items-center gap-x-3 rounded-full border border-line bg-input-fields py-1.5 pl-1.5 pr-4 text-white md:py-2 md:pl-2 md:pr-5">
            <Avatar src={logo} className="h-8 w-8" />
            <span className="text-sm font-medium md:text-base">{name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-x-3 text-sm text-secondary">
        <div className="flex -space-x-2">
          {TOKENS.map(([s, logo]) => <Avatar key={s} src={logo} className="h-8 w-8 ring-2 ring-[#060607]" />)}
        </div>
        USDC, USDT, ETH, BTC, ICP and more
      </div>
    </section>
  );
}
