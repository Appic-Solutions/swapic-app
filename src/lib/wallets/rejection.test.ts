import { describe, expect, it } from 'vitest';
import { SignerError } from '@icp-sdk/signer';
import { MethodNotFoundRpcError, MethodNotSupportedRpcError, UnsupportedProviderMethodError, UserRejectedRequestError } from 'viem';
import { isLostSignerAnswer, isUnsupportedSign, isUserRejection } from './rejection';

const signer = (code: number) => new SignerError({ code, message: 'from the wallet' });

describe('isUserRejection', () => {
  it('reads an EVM wallet saying no (EIP-1193 4001, viem, WalletConnect text)', () => {
    expect(isUserRejection(Object.assign(new Error('User rejected the request.'), { code: 4001 }))).toBe(true);
    expect(isUserRejection(new UserRejectedRequestError(new Error('no')))).toBe(true);
    expect(isUserRejection(new Error('Request cancelled by user'))).toBe(true);
    expect(isUserRejection({ cause: { code: 4001 } })).toBe(true);
  });
  it('reads an ICP signer saying no only from ICRC-25 3001', () => {
    expect(isUserRejection(signer(3001))).toBe(true);
    expect(isUserRejection(new Error('wrapped', { cause: signer(3001) }))).toBe(true);
  });
  it('reads Plug\'s no: ICRC-25 3000 with exactly "User rejected", and no other 3000', () => {
    expect(isUserRejection(new SignerError({ code: 3000, message: 'User rejected' }))).toBe(true);
    expect(isUserRejection(new Error('wrapped', { cause: new SignerError({ code: 3000, message: 'User rejected' }) }))).toBe(true);
    expect(isUserRejection(new SignerError({ code: 3000, message: 'Canister call failed' }))).toBe(false);
    expect(isUserRejection(new SignerError({ code: 3000, message: 'User rejected the transfer but it was sent' }))).toBe(false);
    expect(isLostSignerAnswer(new SignerError({ code: 3000, message: 'User rejected' }))).toBe(false);
  });
  it('never reads a closed signer channel or a signer network error as a no', () => {
    expect(isUserRejection(signer(4001))).toBe(false);
    expect(isUserRejection(signer(4000))).toBe(false);
    expect(isUserRejection(new SignerError({ code: 4001, message: 'The user closed the window, cancel' }))).toBe(false);
    expect(isUserRejection(new Error('wrapped', { cause: signer(4001) }))).toBe(false);
    expect(isUserRejection(new Error('boom'))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
  });
});

describe('isLostSignerAnswer', () => {
  it('a closed channel (4001) or a network error (4000) from the signer is a lost answer', () => {
    expect(isLostSignerAnswer(signer(4001))).toBe(true);
    expect(isLostSignerAnswer(signer(4000))).toBe(true);
    expect(isLostSignerAnswer(new Error('wrapped', { cause: signer(4001) }))).toBe(true);
  });
  it('a no, another signer error and an EVM 4001 are not lost answers', () => {
    expect(isLostSignerAnswer(signer(3001))).toBe(false);
    expect(isLostSignerAnswer(signer(1000))).toBe(false);
    expect(isLostSignerAnswer(Object.assign(new Error('User rejected the request.'), { code: 4001 }))).toBe(false);
  });
});

describe('isUnsupportedSign (a wallet with no way to sign typed data, never a person saying no)', () => {
  it('reads the method errors by their codes, wrapped or not', () => {
    expect(isUnsupportedSign(Object.assign(new Error('nope'), { code: 4200 }))).toBe(true);
    expect(isUnsupportedSign(Object.assign(new Error('nope'), { code: -32601 }))).toBe(true);
    expect(isUnsupportedSign(Object.assign(new Error('nope'), { code: -32004 }))).toBe(true);
    expect(isUnsupportedSign(new UnsupportedProviderMethodError(new Error('x')))).toBe(true);
    expect(isUnsupportedSign(new MethodNotFoundRpcError(new Error('x')))).toBe(true);
    expect(isUnsupportedSign(new MethodNotSupportedRpcError(new Error('x')))).toBe(true);
    expect(isUnsupportedSign(new Error('wrapped', { cause: { code: 4200 } }))).toBe(true);
  });
  it('reads a wallet or a device saying so in words', () => {
    expect(isUnsupportedSign(new Error('Missing or invalid. request() method: eth_signTypedData_v4.'))).toBe(true);
    expect(isUnsupportedSign(new Error('eth_signTypedData_v4 is not supported'))).toBe(true);
    expect(isUnsupportedSign(new Error('This device does not support EIP-712'))).toBe(true);
    expect(isUnsupportedSign(new Error('Method not implemented'))).toBe(true);
  });
  it('a person cancelling is never this, whatever else the text says', () => {
    expect(isUnsupportedSign(Object.assign(new Error('User rejected the request.'), { code: 4001 }))).toBe(false);
    expect(isUnsupportedSign(new UserRejectedRequestError(new Error('no')))).toBe(false);
    expect(isUnsupportedSign(new Error('Request cancelled by user: method not supported'))).toBe(false);
  });
  it('any other failure is not this', () => {
    expect(isUnsupportedSign(new Error('boom'))).toBe(false);
    expect(isUnsupportedSign(null)).toBe(false);
    expect(isUnsupportedSign(Object.assign(new Error('Provided chainId must match the active chainId'), { code: -32602 }))).toBe(false);
    expect(isUnsupportedSign(Object.assign(new Error('Unrecognized chain ID'), { code: 4902 }))).toBe(false);
    expect(isUnsupportedSign(new TypeError('fetch failed'))).toBe(false);
  });
});
