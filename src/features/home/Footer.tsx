// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The live footer: logo, Powered by Swapic Labs (Jeff, 2026-11-04), link columns. The three social icons are hidden and "Support on Discord" is plain
// text until Jeff gives the links (spec 5.1, my call); the App items open the four tabs.
import Link from 'next/link';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';

const APP: [string, string][] = [['Swap', '/'], ['Pool', '/pool'], ['History', '/history'], ['Scanner', '/scanner']];
const RESOURCES = ['Docs (coming soon)', 'Support on Discord', 'Brand kit (coming soon)'];

export function Footer() {
  return (
    <footer className="mx-auto mt-24 grid w-full max-w-[1200px] gap-x-10 gap-y-8 border-t border-line pb-32 pt-14 md:mt-36 md:grid-cols-2 lg:grid-cols-3 xl:pb-14">
      <div className="flex flex-col gap-y-5">
        <img src={SWAPIC_LOGO} alt="Swapic" width={52} height={43} />
        <p className="text-sm text-secondary">Powered by Swapic Labs</p>
      </div>
      <div className="flex flex-col gap-y-4">
        <p className="text-sm font-medium text-secondary">App</p>
        <ul className="flex flex-col gap-y-3 text-sm text-white">
          {APP.map(([label, href]) => (
            <li key={label} className="cursor-pointer transition-opacity hover:opacity-80"><Link href={href}>{label}</Link></li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-y-4">
        <p className="text-sm font-medium text-secondary">Resources</p>
        <ul className="flex flex-col gap-y-3 text-sm text-white">
          {RESOURCES.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
    </footer>
  );
}
