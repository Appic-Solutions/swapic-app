import { Card } from '@/components/ui/card';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';

/**
 * A route card while the quote loads (RouteOption.tsx, line for line): tags and chevron, the logo beside You get about, the
 * amount and the dollars, the time, the gas box. open: the details under it, as the top route starts open.
 */
const RouteOptionSkeleton = ({ open }: { open?: boolean }) => {
  return (
    <Card className="w-full cursor-auto flex-col items-start justify-between gap-3 overflow-hidden p-4 md:p-5">
      <div className="flex w-full flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-[72px]" />
        <div className="ml-auto flex shrink-0 items-center gap-x-2">
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-x-3">
        <div className="flex min-w-0 items-center gap-x-3">
          <Skeleton className="h-10 w-10 shrink-0 lg:h-12 lg:w-12" />
          <div className="flex min-w-0 flex-col">
            <SkeletonText className="w-20 text-xs" />
            <p className="flex min-w-0 items-baseline gap-x-1.5 whitespace-nowrap font-semibold leading-tight">
              <SkeletonText className="w-24 text-xl lg:w-40 lg:text-3xl" />
              <SkeletonText className="w-10 shrink-0 text-sm font-medium lg:text-lg" />
            </p>
            <SkeletonText className="w-24 text-xs" />
          </div>
        </div>
        <SkeletonText className="hidden w-14 text-sm md:flex" />
      </div>
      <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-inset px-3 py-2.5 text-xs md:px-4 md:text-sm">
        <SkeletonText className="w-20" />
        <SkeletonText className="w-16" />
      </div>
      {open && (
        <div className="w-full">
          <div className="space-y-2 border-t border-line pt-3 text-xs md:text-sm">
            <div className="flex items-center justify-between gap-3"><SkeletonText className="w-24" /><SkeletonText className="w-28" /></div>
            <div className="flex items-center justify-between gap-3"><SkeletonText className="w-12" /><SkeletonText className="w-20" /></div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default RouteOptionSkeleton;
