import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './http';
import { FALLBACK_MESSAGE, routeReasonMessage, setUnknownErrorReporter, swapCapOf, userMessage } from './errors';

const e = (code: string, message = '', status = 400) => new ApiError(status, code, message, '/x');

describe('userMessage', () => {
  it('maps both spellings of one meaning to one sentence', () => {
    expect(userMessage(e('rate_limited'))).toBe(userMessage(e('rateLimited')));
    expect(userMessage(e('rateLimited'))).toBe(userMessage(e('edgeLimited')));
    expect(userMessage(e('timeout'))).toBe(userMessage(e('timedOut')));
  });
  it('reads the no route reasons the app must name (frontend-interface-2026-10-23.md section 3)', () => {
    expect(userMessage(e('no_route', 'no route could carry this swap: payerIsContract'))).toBe('This route needs a regular wallet');
    expect(userMessage(e('no_route', 'no route could carry this swap: saleToleranceTooWide'))).toBe('This token cannot go through the pool right now');
    expect(userMessage(e('no_route', 'no route could carry this swap: eco did not answer'))).toBe('No route found for this amount');
    expect(userMessage(e('no_route', 'no route could carry this swap: the canister is halted'))).toBe('Swaps are paused right now');
  });
  it('says plainly when a swap is over the canister\'s per swap cap (422 aboveSwapCap), with the cap from maxUsd', () => {
    const cap = new ApiError(422, 'no_route', '... above the 100 cap', '/v2/quote', { reasonCode: 'aboveSwapCap', maxUsd: '100' });
    expect(swapCapOf(cap)).toBe(100_000_000n);
    expect(userMessage(cap)).toBe('Swaps are limited to $100 for now. Try a smaller amount.');
    expect(userMessage(new ApiError(422, 'no_route', 'x', '/v2/stake/quote', { reasonCode: 'aboveSwapCap', maxUsd: '2500' }))).toBe('Swaps are limited to $2,500 for now. Try a smaller amount.');
    // no cap without its reason code, or with a maxUsd that is not dollars: the usual no route sentence
    expect(swapCapOf(e('no_route', '... above the 100 cap'))).toBeNull();
    expect(swapCapOf(new ApiError(422, 'no_route', 'x', '/v2/quote', { reasonCode: 'aboveSwapCap', maxUsd: 'lots' }))).toBeNull();
    expect(userMessage(new ApiError(422, 'no_route', 'no route could carry this swap: eco did not answer', '/v2/quote', { reasonCode: 'aboveSwapCap', maxUsd: 'lots' }))).toBe('No route found for this amount');
  });
  it('maps the recorded watcher refusals', () => {
    expect(userMessage(e('reverts', 'runFor reverts: CallFailed', 422))).toBe('This swap would fail right now. Get a new quote and try again.');
    expect(userMessage(e('refused', 'Halted', 422))).toBe('Swaps are paused right now');
  });
  it('never shows the backend text, and reports what it does not know', () => {
    const seen = vi.fn();
    setUnknownErrorReporter(seen);
    expect(userMessage(e('brandNew', 'eco said no'))).toBe(FALLBACK_MESSAGE);
    expect(userMessage(new Error('boom'))).toBe(FALLBACK_MESSAGE);
    expect(seen).toHaveBeenCalledTimes(2);
  });
  it('names a route reason only when it is one the user can act on', () => {
    expect(routeReasonMessage('payerIsContract')).toBe('This route needs a regular wallet');
    expect(routeReasonMessage('ecoFeeAboveQuote')).toBeNull();
  });
});
