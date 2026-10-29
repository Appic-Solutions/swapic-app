// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The live landing section title: gradient text.
import { cn } from '@/lib/cn';

export const titleText = cn(
  'max-w-fit bg-clip-text text-[28px] leading-[30px] text-transparent',
  'bg-[linear-gradient(90deg,#6E6E6E_0%,#FFFFFF_34.45%,#FFFFFF_51.67%,#6E6E6E_86.12%)]',
  'md:text-[34px] md:leading-[37px] xl:text-[49px] xl:leading-[54px]',
);

export const section = 'mx-auto flex w-full max-w-[1200px] scroll-mt-24 flex-col gap-y-10 px-0 pt-24 md:gap-y-14 md:pt-36';

export function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-y-3 text-center">
      <p className={titleText}>{title}</p>
      {sub && <p className="max-w-[620px] text-sm leading-6 text-[#898989] md:text-lg">{sub}</p>}
    </div>
  );
}
