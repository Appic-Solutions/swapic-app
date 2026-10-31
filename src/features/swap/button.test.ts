import { describe, expect, it } from 'vitest';
import { swapButton, type ButtonInput } from './button';

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
    expect(swapButton({ ...ok, recipientShown: true, recipientError: 'EVM Wallet Address is not valid' })).toEqual({ text: 'Enter Valid Address', enabled: false });
    expect(swapButton({ ...ok, fromWallet: false })).toEqual({ text: 'Connect wallet', enabled: true });
    expect(swapButton({ ...ok, recipient: false })).toEqual({ text: 'Enter Valid Address', enabled: false });
    expect(swapButton({ ...ok, overBalance: true })).toEqual({ text: 'Review swap', enabled: false });
    expect(swapButton(ok)).toEqual({ text: 'Review swap', enabled: true });
  });
});
