import Header from './Header';
import Shapes from './Shapes';
import { Nav, type Tab } from './Nav';

/** The live (panel)/layout.tsx markup with the four tab nav (design Shell.tsx). */
export function Shell({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  return (
    <main className="!pointer-events-auto relative isolate flex min-h-screen flex-col items-center justify-center !select-auto !px-6 !py-3.5 md:!py-8">
      <Header />
      <Shapes />
      <div className="mb-28 flex w-full flex-1 md:items-center md:justify-center xl:mb-0">{children}</div>
      <Nav active={tab} />
    </main>
  );
}
