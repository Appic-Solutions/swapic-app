import { describe, expect, it } from 'vitest';
import { scrub, sentryOptions } from './sentry';

describe('scrub', () => {
  it('removes addresses, hashes, principals, amounts and query strings', () => {
    const s = scrub(
      'GET https://api-test.swapic.xyz/v2/quote?payer=0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC&amount=250000000 failed for 3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe order 0xaf25d873eca00e1decace1ccb92b1c8cfb16a76b5abe211f38b8f3aecfe2c125 amount 250000000',
    );
    expect(s).not.toMatch(/0x[0-9a-fA-F]{8}/);
    expect(s).not.toMatch(/3yfhk/);
    expect(s).not.toMatch(/250000000/);
    expect(s).toContain('https://api-test.swapic.xyz/v2/quote');
    expect(s).not.toContain('?');
  });
  it('keeps plain words', () => {
    expect(scrub('the server did not answer')).toBe('the server did not answer');
  });
});

describe('sentryOptions', () => {
  it('never propagates trace headers and never sends personal data', () => {
    const o = sentryOptions('https://key@o0.ingest.sentry.io/1', 'test');
    expect(o.tracePropagationTargets).toEqual([]);
    expect(o.sendDefaultPii).toBe(false);
    expect(o.integrations).toBeUndefined();
    expect('tracesSampleRate' in o).toBe(false);
  });
});
