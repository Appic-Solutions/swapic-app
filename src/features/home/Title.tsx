// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The live landing section title: gradient text.
import { cn } from '@/lib/cn';

export const titleText = cn(
  'max-w-fit text-2xl font-semibold leading-8 text-white md:text-3xl md:leading-10 xl:text-4xl xl:leading-[44px]',
);

export const section = 'mx-auto flex w-full max-w-[1200px] scroll-mt-24 flex-col gap-y-10 px-0 pt-24 md:gap-y-14 md:pt-36';

export function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-y-3 text-center">
      <p className={titleText}>{title}</p>
      {sub && <p className="max-w-[620px] text-sm leading-6 text-secondary md:text-base">{sub}</p>}
    </div>
  );
}
