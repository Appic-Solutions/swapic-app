import { describe, expect, it } from 'vitest';
import { BASE_ACCOUNT_CONNECTOR_ID, judgeEvmWallet } from './guard';

const DELEGATE = '63c0c19a282a1b52b07dd5a65b58948a07dae32b';

describe('judgeEvmWallet', () => {
  it('refuses the Base Account connector whatever the code says', () => {
    expect(BASE_ACCOUNT_CONNECTOR_ID).toBe('baseAccount');
    expect(judgeEvmWallet('baseAccount', '0x')).toBe('refuse');
    expect(judgeEvmWallet('baseAccount', undefined)).toBe('refuse');
  });
  it('refuses an address with contract code on the connected chain', () => {
    expect(judgeEvmWallet('injected', '0x6080604052348015600f57600080fd5b50')).toBe('refuse');
  });
  it('allows an EIP-7702 delegated EOA (0xef0100 and a 20 byte address): it signs with its own key', () => {
    expect(judgeEvmWallet('io.metamask', `0xef0100${DELEGATE}`)).toBe('allow');
    // the designator prefix with the wrong length is not a delegation
    expect(judgeEvmWallet('io.metamask', `0xef0100${DELEGATE}00`)).toBe('refuse');
  });
  it('allows an address with no code, and leaves an unread one to the quoter (payerIsContract)', () => {
    expect(judgeEvmWallet('walletConnect', '0x')).toBe('allow');
    expect(judgeEvmWallet('walletConnect', undefined)).toBe('allow');
    expect(judgeEvmWallet(undefined, null)).toBe('allow');
  });
});
