import { Suspense } from 'react';
import { Shell } from '@/components/layout/Shell';
import { ScannerPage } from '@/features/scanner/ScannerPage';
import { ScannerLoading } from '@/features/scanner/ScannerPanel';

/** The Scanner tab. Its body reads useSearchParams, which a static export allows only inside Suspense. */
export default function Page() {
  return (
    <Shell tab="Scanner">
      <Suspense fallback={<ScannerLoading />}>
        <ScannerPage />
      </Suspense>
    </Shell>
  );
}
