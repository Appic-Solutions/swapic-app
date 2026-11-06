import Skeleton, { SkeletonText } from '@/components/ui/skeleton';

/** A token row while the list loads (token-list-item.tsx): logo, symbol and name, and the balance when a wallet is connected. */
const TokenSkeleton = ({ balance }: { balance?: boolean }) => {
  return (
    <div className="flex w-full items-center justify-between rounded-xl p-2">
      <div className="flex min-w-0 flex-grow items-center gap-x-3">
        <Skeleton className="h-10 w-10 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col">
          <SkeletonText className="w-16 text-base" />
          <SkeletonText className="w-28 text-sm" />
        </div>
      </div>
      {balance && (
        <div className="flex shrink-0 flex-col items-end">
          <SkeletonText className="w-16 text-base" />
          <SkeletonText className="w-12 text-sm" />
        </div>
      )}
    </div>
  );
};

export default TokenSkeleton;
