'use client';
import { useEffect, useState } from 'react';

/** The page's query parameters, read once after mount (null before): no Suspense needed in a static export. */
export function useQueryOnce(): URLSearchParams | null {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  useEffect(() => setQ(new URLSearchParams(window.location.search)), []);
  return q;
}
