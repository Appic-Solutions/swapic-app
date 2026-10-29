import { Suspense } from 'react';
import { Shell } from '@/components/layout/Shell';
import { ScannerPage } from '@/features/scanner/ScannerPage';

/** The Scanner tab. Its body reads useSearchParams, which a static export allows only inside Suspense. */
export default function Page() {
  return (
    <Shell tab="Scanner">
      <Suspense>
        <ScannerPage />
      </Suspense>
    </Shell>
  );
}
