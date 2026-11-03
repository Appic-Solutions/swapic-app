import { describe, expect, it } from 'vitest';
import { problems } from '../../../scripts/check-copy.mjs';
import { findSentence, isTxHash } from './find';

describe('find my swap', () => {
  it('tells each closed state in plain words, never the backend text', () => {
    expect(findSentence({ state: 'queued', orders: null })).toBe('Found it. Your swap shows here and in History in a few minutes.');
    expect(findSentence({ state: 'filed', orders: 1 })).toBe('Found it. Search the transaction again to open your swap.');
    expect(findSentence({ state: 'filed', orders: 0 })).toBe('We checked it: it holds no swap of ours.');
    expect(findSentence({ state: 'nothing', orders: 0 })).toBe('We found no swap of ours in this transaction. Check the chain and the hash.');
    expect(findSentence({ state: 'later', orders: null })).toBe('We could not tell yet. Try again in a minute.');
    expect(problems(['queued', 'filed', 'nothing'].map((state) => findSentence({ state, orders: 1 })))).toEqual([]);
  });
  it('takes only a full transaction hash', () => {
    expect(isTxHash(`0x${'ab'.repeat(32)}`)).toBe(true);
    expect(isTxHash('0xabc')).toBe(false);
  });
});
