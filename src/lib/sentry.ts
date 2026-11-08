// Design note (error reports, plan 1 Task 10).
// Must never happen: a wallet address, a principal, an order id or an amount in an event (spec section 14); Sentry
// loaded without a DSN; Sentry adding its sentry-trace or baggage headers to a call to the API host (that header is
// not in the edge's Access-Control-Allow-Headers: content-type, so every call would fail CORS and preflight GETs that
// are simple today).
// How the design proves it: beforeSend and beforeBreadcrumb pass every string through scrub(), which replaces 0x and
// 40 or 64 hex, principals, and runs of 6 or more digits, and drops the query string of every URL;
// sendDefaultPii: false; no tracing integration is added and tracePropagationTargets: [], so no request ever carries
// a trace header; the module does nothing when config.sentryDsn is null. scrub() and the options are unit tested, and
// plan 4 Task 6's CSP check also asserts that no request to the API host carries sentry-trace or baggage.
import * as Sentry from '@sentry/react';
import { config } from '@/config';
import { setUnknownErrorReporter } from '@/lib/api/errors';

export function scrub(text: string): string {
  return text
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1')
    .replace(/0x[0-9a-fA-F]{40,64}/g, '0x…')
    // Solana signatures and addresses, longest first; the set has no 0, O, I or l
    .replace(/\b[1-9A-HJ-NP-Za-km-z]{86,88}\b/g, '<signature>')
    .replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '<address>')
    .replace(/\b[a-z0-9]{5}(-[a-z0-9]{5}){3,}(-[a-z0-9]{1,5})?\b/g, '<principal>')
    .replace(/\d{6,}/g, '<n>');
}

const scrubAll = (v: unknown): unknown =>
  typeof v === 'string' ? scrub(v) : Array.isArray(v) ? v.map(scrubAll) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, scrubAll(x)])) : v;

let started = false;

/** No tracing integration and no trace propagation: a sentry-trace or baggage header on an API call fails CORS. */
export function sentryOptions(dsn: string, environment: string): Sentry.BrowserOptions {
  return {
    dsn,
    environment,
    sendDefaultPii: false,
    tracePropagationTargets: [],
    beforeSend: (event) => scrubAll(event) as typeof event,
    beforeBreadcrumb: (crumb) => scrubAll(crumb) as typeof crumb,
  };
}

export function initSentry(): void {
  if (started || !config.sentryDsn || typeof window === 'undefined') return;
  started = true;
  Sentry.init(sentryOptions(config.sentryDsn, config.env));
  setUnknownErrorReporter((e) => captureFailure(e, 'unknown error'));
}

export function captureFailure(e: unknown, where: string): void {
  if (!started) return;
  Sentry.captureException(e, { tags: { where } });
}
