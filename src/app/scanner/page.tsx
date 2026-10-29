import { Suspense } from 'react';
import { Shell } from '@/components/layout/Shell';

/** The Scanner tab. Its body will read useSearchParams, which a static export allows only inside Suspense (plan 4 fills it). */
export default function Page() {
  return (
    <Shell tab="Scanner">
      <Suspense>
        <div />
      </Suspense>
    </Shell>
  );
}
