import { describe, expect, it } from 'vitest';
import { swapButton, swapHint, type ButtonInput } from './button';
import { HINTS } from '@/lib/copy/hints';

const ok: ButtonInput = { from: true, to: true, amount: 5_000_000n, amountError: null, overBalance: false, quote: 'ready', hasOptions: true, recipientShown: false, recipientError: null, fromWallet: true, recipient: true };

describe('swapButton (spec 5.1 texts)', () => {
  it('walks the states in order', () => {
    expect(swapButton({ ...ok, from: false })).toEqual({ text: 'Select tokens to swap', enabled: false });
    expect(swapButton({ ...ok, amount: null })).toEqual({ text: 'Set token amount to continue', enabled: false });
    expect(swapButton({ ...ok, quote: 'loading' })).toEqual({ text: undefined, enabled: false });
    expect(swapButton({ ...ok, quote: 'paused' })).toEqual({ text: 'Swaps are paused', enabled: false });
    expect(swapButton({ ...ok, quote: 'icpPaused' })).toEqual({ text: 'Paused for now', enabled: false });
    expect(swapButton({ ...ok, quote: 'empty', hasOptions: false })).toEqual({ text: 'No route found', enabled: false });
    expect(swapButton({ ...ok, quote: 'capped', hasOptions: false, cap: 100_000_000n })).toEqual({ text: 'Up to $100 right now', enabled: false });
    expect(swapButton({ ...ok, recipientShown: true, recipientError: 'EVM Wallet Address is not valid' })).toEqual({ text: 'Enter a valid address', enabled: false });
    expect(swapButton({ ...ok, fromWallet: false })).toEqual({ text: 'Connect wallet', enabled: true });
    expect(swapButton({ ...ok, recipient: false })).toEqual({ text: 'Enter a valid address', enabled: false });
    expect(swapButton({ ...ok, overBalance: true })).toEqual({ text: 'Review swap', enabled: false });
    expect(swapButton(ok)).toEqual({ text: 'Review swap', enabled: true });
  });
  it('a gasless card with no coin to approve asks for the coin, after everything else a person must fix', () => {
    expect(swapButton({ ...ok, needsCoin: 'POL' })).toEqual({ text: 'Add POL to continue', enabled: false });
    expect(swapButton({ ...ok, needsCoin: 'POL', fromWallet: false })).toEqual({ text: 'Connect wallet', enabled: true });
    expect(swapButton({ ...ok, needsCoin: 'POL', recipient: false })).toEqual({ text: 'Enter a valid address', enabled: false });
  });
});

describe('swapHint (the grey line under the button)', () => {
  it('follows the button, one line for every state', () => {
    expect(swapHint({ ...ok, from: false })).toBe(HINTS.swapPick);
    expect(swapHint({ ...ok, to: false })).toBe(HINTS.swapPick);
    expect(swapHint({ ...ok, amount: null })).toBe(HINTS.swapAmount);
    expect(swapHint({ ...ok, amount: 0n })).toBe(HINTS.swapAmount);
    expect(swapHint({ ...ok, quote: 'loading' })).toBe(HINTS.swapLoading);
    expect(swapHint({ ...ok, quote: 'paused' })).toBe(HINTS.swapPaused);
    expect(swapHint({ ...ok, quote: 'icpPaused' })).toBe(HINTS.swapPaused);
    expect(swapHint({ ...ok, quote: 'empty', hasOptions: false })).toBe(HINTS.swapNoRoute);
    expect(swapHint({ ...ok, quote: 'capped', hasOptions: false, cap: 100_000_000n })).toBe(HINTS.swapNoRoute);
    expect(swapHint({ ...ok, recipientShown: true, recipientError: 'EVM Wallet Address is not valid' })).toBe(HINTS.swapAddress);
    expect(swapHint({ ...ok, fromWallet: false })).toBe(HINTS.swapConnect);
    expect(swapHint({ ...ok, recipient: false })).toBe(HINTS.swapAddress);
    expect(swapHint({ ...ok, needsCoin: 'POL' })).toBe(HINTS.swapCoin);
    expect(swapHint({ ...ok, overBalance: true })).toBe(HINTS.swapBalance);
    expect(swapHint(ok)).toBe(HINTS.swapRoutes);
  });
  it('every line is short (under about 70 characters)', () => {
    for (const t of Object.values(HINTS)) expect(t.length).toBeLessThanOrEqual(70);
  });
});
