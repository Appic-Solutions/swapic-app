'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** An old platform-v2 route's page: sends the visitor to the matching tab. Renders nothing. */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}
