'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { config } from '@/config';
import { redirectTarget } from '@/lib/host-redirect';
import { legacyTarget } from '@/lib/legacy';

/** The raw canister host goes to the domain (same principal every visit); an old link goes to its tab. Renders nothing. */
export function HostRedirect() {
  const router = useRouter();
  useEffect(() => {
    const to = redirectTarget(window.location, config);
    if (to) {
      window.location.replace(to);
      return;
    }
    const l = legacyTarget(window.location.pathname);
    if (l && l !== window.location.pathname) router.replace(l + window.location.search);
  }, [router]);
  return null;
}
