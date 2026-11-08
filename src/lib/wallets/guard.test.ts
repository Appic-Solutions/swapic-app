import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { BASE_ACCOUNT_CONNECTOR_ID, holdsNoCode, judgeEvmWallet, normalizedSignature, ownSignature, sessionLacksTypedData, within } from './guard';

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
  it('ownSignature: the address\'s own key over this typed data, and nothing else', async () => {
    const good = await sign(key);
    expect(await ownSignature(key.address, td, good)).toBe(good);
    expect(await ownSignature(key.address.toLowerCase(), td, good)).toBe(good);
    // another key, another message
    expect(await ownSignature(key.address, td, await sign(privateKeyToAccount(generatePrivateKey())))).toBeNull();
    expect(await ownSignature(key.address, td, await sign(key, { body: 'other' }))).toBeNull();
  });
  it('ownSignature: what an account with no code yet or a contract wallet answers instead', async () => {
    const good = await sign(key);
    expect(await ownSignature(key.address, td, '0x')).toBeNull();
    // an ERC-6492 wrapper, longer than a key's 65 bytes
    expect(await ownSignature(key.address, td, `${good}${'64'.repeat(32)}` as Hex)).toBeNull();
    expect(await ownSignature(key.address, td, `0x${'ab'.repeat(65)}`)).toBeNull();
  });
  it('a last byte of 0 or 1 becomes the 27 or 28 Permit2\'s ecrecover takes, then is checked as any other', async () => {
    const good = await sign(key);
    const low = `${good.slice(0, 130)}${good.endsWith('1b') ? '00' : '01'}` as Hex;
    expect(await ownSignature(key.address, td, low)).toBe(good);
    // the wrong recovery byte recovers to someone else: the old way, never sent
    const flipped = `${good.slice(0, 130)}${good.endsWith('1b') ? '01' : '00'}` as Hex;
    expect(await ownSignature(key.address, td, flipped)).toBeNull();
    expect(normalizedSignature(`0x${'11'.repeat(64)}00`)).toBe(`0x${'11'.repeat(64)}1b`);
    expect(normalizedSignature(`0x${'11'.repeat(64)}01`)).toBe(`0x${'11'.repeat(64)}1c`);
    expect(normalizedSignature(`0x${'11'.repeat(64)}1C`)).toBe(`0x${'11'.repeat(64)}1C`);
    expect(normalizedSignature(`0x${'11'.repeat(64)}02`)).toBeNull();
    expect(normalizedSignature(`0x${'11'.repeat(64)}`)).toBeNull();
  });
  it('sessionLacksTypedData: only a session that lists its methods without it', () => {
    const session = (methods: unknown) => ({ session: { namespaces: { eip155: { methods } } } });
    expect(sessionLacksTypedData(session(['eth_sendTransaction', 'personal_sign']))).toBe(true);
    expect(sessionLacksTypedData(session(['eth_sendTransaction', 'eth_signTypedData_v4']))).toBe(false);
    // an injected wallet, no session, or no list at all: it cannot say
    expect(sessionLacksTypedData({})).toBe(false);
    expect(sessionLacksTypedData(null)).toBe(false);
    expect(sessionLacksTypedData(undefined)).toBe(false);
    expect(sessionLacksTypedData(session(undefined))).toBe(false);
  });
  describe('within', () => {
    afterEach(() => { vi.useRealTimers(); });
    it('gives the answer that comes in time, null for a failure or a late one', async () => {
      expect(await within(50, async () => 7)).toBe(7);
      expect(await within(50, async () => { throw new Error('rpc down'); })).toBeNull();
      vi.useFakeTimers();
      const late = within(3_000, () => new Promise<number>(() => {}));
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await late).toBeNull();
    });
  });
});
