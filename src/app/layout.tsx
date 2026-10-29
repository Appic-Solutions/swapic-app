import '@/style/colors.css';
import '@/style/scrollbar.css';
import '@/style/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-rethink-sans relative bg-[#060607] md:h-full" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
