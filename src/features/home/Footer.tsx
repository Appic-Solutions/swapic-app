// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The live footer: logo, Built on ICP, link columns. The three social icons are hidden and "Support on Discord" is plain
// text until Jeff gives the links (spec 5.1, my call); the App items open the four tabs.
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';

const APP: [string, string][] = [['Swap', '/'], ['Pool', '/pool'], ['History', '/history'], ['Scanner', '/scanner']];
const RESOURCES = ['Docs (coming soon)', 'Support on Discord', 'Brand kit (coming soon)'];

export function Footer() {
  return (
    <footer className="mx-auto mt-24 grid w-full max-w-[1200px] gap-x-10 gap-y-8 border-t border-white/10 pb-32 pt-14 md:mt-36 md:grid-cols-2 lg:grid-cols-3 xl:pb-14">
      <div className="flex flex-col gap-y-5">
        <img src={SWAPIC_LOGO} alt="Swapic" width={52} height={43} />
        {/* a div, not the design's <p>: the Avatar's loading fallback is a div, which a <p> cannot hold (hydration) */}
        <div className="flex items-center gap-x-2 text-sm text-[#898989]"><Avatar src="/images/logo/chains-logos/icp.svg" className="h-5 w-5" />Built on the Internet Computer</div>
      </div>
      <div className="flex flex-col gap-y-4">
        <p className="text-[18px] font-bold text-[#3870DA]">App</p>
        <ul className="flex flex-col gap-y-3 text-white">
          {APP.map(([label, href]) => (
            <li key={label} className="cursor-pointer transition-opacity hover:opacity-80"><Link href={href}>{label}</Link></li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-y-4">
        <p className="text-[18px] font-bold text-[#3870DA]">Resources</p>
        <ul className="flex flex-col gap-y-3 text-white">
          {RESOURCES.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
    </footer>
  );
}
