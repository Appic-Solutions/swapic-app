'use client';
// The design has no 404 screen: the live empty state card (RouteOptionsList's empty card markup) with the
// live ActionButton taking the visitor to Swap.
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import ActionButton from '@/components/ui/action-button';

export function NotFoundBody() {
  const router = useRouter();
  return (
    <div className="flex w-full max-w-[482px] flex-col gap-4 md:mx-auto">
      <Card className="cursor-auto flex-col items-center justify-center gap-3 text-center hover:bg-[#000000]/0">
        <img src="/images/empty.png" alt="" width={80} height={80} />
        <p className="text-xl font-bold">Page not found</p>
      </Card>
      <ActionButton isDisabled={false} onClick={() => router.push('/')}>
        Go to Swap
      </ActionButton>
    </div>
  );
}
