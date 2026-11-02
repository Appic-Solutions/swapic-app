import { describe, expect, it } from 'vitest';
import { SignerError } from '@icp-sdk/signer';
import { UserRejectedRequestError } from 'viem';
import { isLostSignerAnswer, isUserRejection } from './rejection';

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
