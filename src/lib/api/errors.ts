import { ApiError } from './http';
import { dollarsToMicro, formatUsdWhole } from '@/lib/money';

export const FALLBACK_MESSAGE = 'Something went wrong, try again';

let report: (e: unknown) => void = () => {};
/** Sentry plugs in here (Task 10), so this file imports nothing heavy. */
export function setUnknownErrorReporter(fn: (e: unknown) => void): void {
  report = fn;
}

const SAME = {
  busy: 'The server is busy. Try again in a minute.',
  limited: 'Too many requests. Wait a minute and try again.',
  slow: 'The server took too long. Try again.',
  bad: 'Something in this request is not right. Check it and try again.',
  missing: 'We cannot find this.',
};

/** One sentence per meaning; quoter snake_case and watcher camelCase both (contract 1.4). */
const SENTENCES: Record<string, string> = {
  bad_request: SAME.bad, badRequest: SAME.bad, badAnswer: SAME.busy, httpError: FALLBACK_MESSAGE,
  sanctioned: 'This wallet cannot use Swapic.',
  not_found: SAME.missing, notFound: SAME.missing, unknownOrder: SAME.missing, unknownPayout: SAME.missing,
  timeout: SAME.slow, timedOut: SAME.slow,
  rate_limited: SAME.limited, rateLimited: SAME.limited, edgeLimited: SAME.limited,
  store: SAME.busy, unavailable: SAME.busy, edgeUnavailable: SAME.busy,
  network: 'The server did not answer. Check your connection and try again.',
  no_route: 'No route found for this amount',
  gaslessRefused: 'This swap needs you to pay a little gas. Pick that option.',
  notGasless: 'This swap needs you to pay a little gas. Pick that option.',
  gaslessPaused: 'Gasless swaps are paused right now. Pick another option.',
  payerBusy: 'You have a swap starting already. Wait for it, then try again.',
  expired: 'This quote expired. Get a new one.',
  reverts: 'This swap would fail right now. Get a new quote and try again.',
  unsupported: 'This is not supported yet.',
  unauthorized: 'This is not allowed.',
  tooLarge: 'This request is too large.',
};

/** Route reasons (order/mod.rs:38-100) the person can act on; every other reason means "no route". */
const ROUTE_REASONS: Record<string, string> = {
  payerIsContract: "This route doesn't work with smart wallets. Pick another option.",
  saleToleranceTooWide: "This token can't be swapped this way right now. Try another option.",
  badRecipient: 'Enter a valid address',
};

export function routeReasonMessage(reason: string): string | null {
  return ROUTE_REASONS[reason] ?? null;
}

/**
 * A swap or stake over the canister's per swap cap (422 no_route, reasonCode aboveSwapCap): the cap in micro USD from
 * `maxUsd`; null for any other error, or a `maxUsd` that is not a dollar amount.
 */
export function swapCapOf(e: unknown): bigint | null {
  if (!(e instanceof ApiError) || e.code !== 'no_route' || e.reasonCode !== 'aboveSwapCap' || e.maxUsd === undefined) return null;
  try {
    const cap = dollarsToMicro(e.maxUsd);
    return cap > 0n ? cap : null;
  } catch {
    return null;
  }
}

/**
 * What the pool can carry when the swap is too big for it, in micro USD: the quote's `poolCovers`, or the same field on a
 * 422 no_route when no route stood in; null when the pool did not refuse the size, or the field is not a dollar amount.
 */
export function poolCoversOf(quote: { poolCovers?: string } | undefined, e: unknown): bigint | null {
  const text = quote?.poolCovers ?? (e instanceof ApiError ? e.poolCovers : undefined);
  if (text === undefined) return null;
  try {
    const covers = dollarsToMicro(text);
    return covers > 0n ? covers : null;
  } catch {
    return null;
  }
}

/** The plain sentence for any error; never the backend's own words. */
export function userMessage(e: unknown): string {
  if (e instanceof ApiError) {
    // PROVISIONAL copy (Jeff's copy batch)
    const cap = swapCapOf(e);
    if (cap !== null) return `Swaps are limited to ${formatUsdWhole(cap)} for now. Try a smaller amount.`;
    if (e.code === 'no_route') {
      for (const [reason, sentence] of Object.entries(ROUTE_REASONS)) if (e.message.includes(reason)) return sentence;
      if (/cap\b|above the per swap/i.test(e.message)) return 'This swap is too large right now. Try a smaller amount.';
      if (/halt|paused/i.test(e.message)) return 'Swaps are paused right now';
      return SENTENCES.no_route!;
    }
    if (e.code === 'refused') return /halt/i.test(e.message) ? 'Swaps are paused right now' : "This swap can't start right now. Get a new quote and try again.";
    const s = SENTENCES[e.code];
    if (s) return s;
  }
  report(e);
  return FALLBACK_MESSAGE;
}
