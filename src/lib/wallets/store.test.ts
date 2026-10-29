import { beforeEach, describe, expect, it } from 'vitest';
import { useWallets } from './store';

beforeEach(() => useWallets.setState({ evm: null, icp: null }));

describe('wallet store', () => {
  it('keeps one EVM and one ICP wallet side by side, and drops each alone', () => {
    useWallets.getState().setEvm({ address: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac', chainId: 8453 });
    useWallets.getState().setIcp({ principal: '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe', signer: 'OISY' });
    useWallets.getState().setEvm(null);
    expect(useWallets.getState().evm).toBeNull();
    expect(useWallets.getState().icp?.signer).toBe('OISY');
  });
  it('never keeps the anonymous principal', () => {
    useWallets.getState().setIcp({ principal: '2vxsx-fae', signer: 'NFIDW' });
    expect(useWallets.getState().icp).toBeNull();
  });
  it('stores EVM addresses in lower case', () => {
    useWallets.getState().setEvm({ address: '0xF00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC' as `0x${string}`, chainId: 1 });
    expect(useWallets.getState().evm?.address).toBe('0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac');
  });
  it('keeps a smart wallet flag, and an unknown one as unknown (null, never read as regular)', () => {
    useWallets.getState().setEvm({ address: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac', chainId: 8453, smartWallet: null });
    expect(useWallets.getState().evm?.smartWallet).toBeNull();
    useWallets.getState().setEvm({ address: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac', chainId: 8453, smartWallet: true });
    expect(useWallets.getState().evm?.smartWallet).toBe(true);
    useWallets.getState().setEvm({ address: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac', chainId: 8453 });
    expect(useWallets.getState().evm?.smartWallet).toBe(false);
  });
});
