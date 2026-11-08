import Header from './Header';
import { Nav, type Tab } from './Nav';
import { PageFade } from './PageFade';

/** The live (panel)/layout.tsx markup with the four tab nav (design Shell.tsx). */
export function Shell({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  return (
    // Short windows (short: and tiny:, a laptop at 125%) take the compact frame: less padding, a lower header row with the
    // nav in it from 1024 px wide (globals.css --frame-top and --frame-bottom hold what it takes, per window size)
    <main className="!pointer-events-auto relative isolate flex min-h-screen flex-col items-center justify-center !select-auto !px-6 !py-3.5 md:!py-8 md:short:!py-4 md:tiny:!py-3">
      <Header />
      <div className="mb-24 flex w-full flex-1 md:items-center md:justify-center lg:short:mb-0 xl:mb-0">
        {/* the page fades in when its tab opens (the design's page fade; a route change leaves no time for a fade out) */}
        <PageFade key={tab}>{children}</PageFade>
      </div>
      <Nav active={tab} />
    </main>
  );
}
