'use client';
import { useEffect } from 'react';
import { initSentry } from '@/lib/sentry';

/** Starts Sentry once in the browser (it stays off while config.sentryDsn is null). Renders nothing. */
export function SentryInit() {
  useEffect(() => {
    initSentry();
  }, []);
  return null;
}
