import { describe, expect, it } from 'vitest';
import { configFor } from '@/config';
import { redirectTarget } from './host-redirect';

const at = (host: string, pathname = '/pool', search = '?x=1', hash = '') => ({ host, pathname, search, hash });

describe('redirectTarget', () => {
  it('sends the raw prod canister URL to swapic.xyz, keeping the path', () => {
    expect(redirectTarget(at('dduc6-3yaaa-aaaal-ai63a-cai.icp0.io'), configFor('prod'))).toBe('https://swapic.xyz/pool?x=1');
  });
  it('sends the raw test canister URL to test.swapic.xyz', () => {
    expect(redirectTarget(at('ib67n-yiaaa-aaaao-qjwca-cai.raw.icp0.io', '/'), configFor('test'))).toBe('https://test.swapic.xyz/?x=1');
  });
  it('leaves the domains and localhost alone', () => {
    expect(redirectTarget(at('swapic.xyz'), configFor('prod'))).toBeNull();
    expect(redirectTarget(at('localhost:3000'), configFor('test'))).toBeNull();
  });
});
