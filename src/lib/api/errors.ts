import { ApiError } from './http';

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
  gaslessRefused: 'This swap cannot be gasless. Pick another option.',
  notGasless: 'This swap cannot be gasless. Pick another option.',
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
  payerIsContract: 'This route needs a regular wallet',
  saleToleranceTooWide: 'This token cannot go through the pool right now',
  badRecipient: 'Enter Valid Address',
};

export function routeReasonMessage(reason: string): string | null {
  return ROUTE_REASONS[reason] ?? null;
}

/** The plain sentence for any error; never the backend's own words. */
export function userMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'no_route') {
      for (const [reason, sentence] of Object.entries(ROUTE_REASONS)) if (e.message.includes(reason)) return sentence;
      if (/cap\b|above the per swap/i.test(e.message)) return 'The pool cannot take this swap now, try a smaller amount';
      if (/halt|paused/i.test(e.message)) return 'Swaps are paused right now';
      return SENTENCES.no_route!;
    }
    if (e.code === 'refused') return /halt/i.test(e.message) ? 'Swaps are paused right now' : 'Swapic refused this request. Get a new quote and try again.';
    const s = SENTENCES[e.code];
    if (s) return s;
  }
  report(e);
  return FALLBACK_MESSAGE;
}
