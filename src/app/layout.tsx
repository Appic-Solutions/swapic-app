import type { Metadata } from 'next';
import '@/style/colors.css';
import '@/style/scrollbar.css';
import '@/style/globals.css';
import { Providers } from '@/lib/wallets';
import { Backdrop } from '@/components/layout/Backdrop';
import { HostRedirect } from '@/components/layout/HostRedirect';
import { SentryInit } from '@/components/layout/SentryInit';
import { MotionRoot } from '@/lib/motion';

export const metadata: Metadata = {
  title: 'Swapic',
  description: 'Swap any token on one chain to any token on another.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-rethink-sans relative bg-[#060607] md:h-full" data-scroll-behavior="smooth">
      <body>
        <SentryInit />
        <Providers>
          <HostRedirect />
          {/* here, not in a page: a page change must not blink the coins or send them back to their start */}
          <Backdrop />
          {/* reduce motion follows the OS; the default transition is the entry one (src/lib/motion.ts) */}
          <MotionRoot>{children}</MotionRoot>
        </Providers>
      </body>
    </html>
  );
}
