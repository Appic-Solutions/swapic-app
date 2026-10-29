import { describe, expect, it } from 'vitest';
import { BASE_ACCOUNT_CONNECTOR_ID, judgeEvmWallet } from './guard';

const DELEGATE = '63c0c19a282a1b52b07dd5a65b58948a07dae32b';

describe('judgeEvmWallet (smart wallets are flagged, never disconnected: Jeff, 2026-10-29, option B)', () => {
  it('flags the Base Account connector whatever the code says', () => {
    expect(BASE_ACCOUNT_CONNECTOR_ID).toBe('baseAccount');
    expect(judgeEvmWallet('baseAccount', '0x')).toBe('smart');
  });
  it('flags an address with contract code on the connected chain', () => {
    expect(judgeEvmWallet('injected', '0x6080604052348015600f57600080fd5b50')).toBe('smart');
  });
  it('reads an EIP-7702 delegated EOA (0xef0100 and a 20 byte address) as regular: it signs with its own key', () => {
    expect(judgeEvmWallet('io.metamask', `0xef0100${DELEGATE}`)).toBe('regular');
    // the designator prefix with the wrong length is not a delegation
    expect(judgeEvmWallet('io.metamask', `0xef0100${DELEGATE}00`)).toBe('smart');
  });
  it('reads an address with no code as regular, and code that could not be read as unknown (lead, 2026-10-29)', () => {
    expect(judgeEvmWallet('walletConnect', '0x')).toBe('regular');
    expect(judgeEvmWallet('walletConnect', '')).toBe('regular');
    expect(judgeEvmWallet('walletConnect', null)).toBe('unknown');
    expect(judgeEvmWallet(undefined, null)).toBe('unknown');
    // the Base Account connector is smart even when its code could not be read
    expect(judgeEvmWallet('baseAccount', null)).toBe('smart');
  });
});
