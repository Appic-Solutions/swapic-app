import { describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { BASE_ACCOUNT_CONNECTOR_ID, holdsNoCode, judgeEvmWallet, signedByKey } from './guard';

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

describe('paying through Permit2: only a key with no code (SignatureVerification.verify takes ecrecover only at code length 0)', () => {
  it('holdsNoCode: no code at all; a delegation is code; a failed read is not "none"', () => {
    expect(holdsNoCode('0x')).toBe(true);
    expect(holdsNoCode('')).toBe(true);
    expect(holdsNoCode(`0xef0100${DELEGATE}`)).toBe(false);
    expect(holdsNoCode('0x6080604052')).toBe(false);
    expect(holdsNoCode(null)).toBe(false);
  });
  const td = {
    domain: { name: 'Permit2', chainId: 1, verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
    types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }], Mail: [{ name: 'body', type: 'string' }] },
    primaryType: 'Mail',
    message: { body: 'hello' },
  };
  const { EIP712Domain: _omit, ...types } = td.types;
  const key = privateKeyToAccount(generatePrivateKey());
  const sign = (k: typeof key, message = td.message) => k.signTypedData({ ...td, types, message } as never);
  it('signedByKey: the address\'s own key over this typed data, and nothing else', async () => {
    expect(await signedByKey(key.address, td, await sign(key))).toBe(true);
    expect(await signedByKey(key.address.toLowerCase(), td, await sign(key))).toBe(true);
    // another key, another message
    expect(await signedByKey(key.address, td, await sign(privateKeyToAccount(generatePrivateKey())))).toBe(false);
    expect(await signedByKey(key.address, td, await sign(key, { body: 'other' }))).toBe(false);
  });
  it('signedByKey: what an account with no code yet or a contract wallet answers instead', async () => {
    const good = await sign(key);
    expect(await signedByKey(key.address, td, '0x')).toBe(false);
    // an ERC-6492 wrapper, longer than a key's 65 bytes
    expect(await signedByKey(key.address, td, `${good}${'64'.repeat(32)}` as Hex)).toBe(false);
    expect(await signedByKey(key.address, td, `0x${'ab'.repeat(65)}`)).toBe(false);
  });
});
