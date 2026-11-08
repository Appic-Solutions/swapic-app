import { describe, expect, it } from 'vitest';
import { connectTakesOver, nextAsk, receiveItems, type AskEvent, type ConnectAsk } from './receive';

const run = (events: AskEvent[], from: ConnectAsk | null = null) => events.reduce(nextAsk, from);
const connect: AskEvent = { kind: 'connect', wallet: 'evm', toKey: 'eip155:137|wbtc', address: '' };
const field = (address: string, toKey = 'eip155:137|wbtc') => ({ toKey, show: true, address });
const PASTED = '0x3a9c2e07b5f81dc4be00aa6f6b9d2e45ca1189ac';

describe('receiveItems (the Receive at menu)', () => {
  it('a connected wallet that can receive, else Connect a wallet, then Paste an address', () => {
    expect(receiveItems({ own: '0xf00e', smart: false })).toEqual(['own', 'paste']);
    expect(receiveItems({ own: null, smart: false })).toEqual(['connect', 'paste']);
  });
  it('a smart wallet sending to another EVM chain is offered Paste an address alone, never a connect for the wallet it has', () => {
    expect(receiveItems({ own: null, smart: true })).toEqual(['paste']);
  });
});

describe('a wallet connecting takes the payout over only while Connect a wallet stands', () => {
  it('Connect a wallet, then the wallet connects: the field closes', () => {
    expect(connectTakesOver(run([connect]), field(''))).toBe(true);
  });
  it('the review scenario: Connect a wallet, the list closed, Paste an address, an address typed, a wallet connected later from the header: the pasted address stays', () => {
    const ask = run([connect, { kind: 'ended' }, { kind: 'paste' }, { kind: 'typed' }]);
    expect(ask).toBeNull();
    expect(connectTakesOver(ask, field(PASTED))).toBe(false);
  });
  it('Paste an address or Your wallet chosen after it ends it, even with the list still open', () => {
    expect(run([connect, { kind: 'paste' }])).toBeNull();
    expect(run([connect, { kind: 'own' }])).toBeNull();
  });
  it('an address typed after asking ends it (and the address check alone would hold too)', () => {
    expect(run([connect, { kind: 'typed' }])).toBeNull();
    expect(connectTakesOver(run([connect]), field(PASTED))).toBe(false);
  });
  it('another To token ends it; the same one keeps it', () => {
    expect(run([connect, { kind: 'toChanged', toKey: 'icp:x|ckbtc' }])).toBeNull();
    expect(run([connect, { kind: 'toChanged', toKey: null }])).toBeNull();
    expect(run([connect, { kind: 'toChanged', toKey: 'eip155:137|wbtc' }])).not.toBeNull();
    expect(connectTakesOver(run([connect]), field('', 'icp:x|ckbtc'))).toBe(false);
  });
  it('the connect flow ending without a wallet ends it', () => {
    expect(run([connect, { kind: 'ended' }])).toBeNull();
  });
  it('a field already closed has nothing to take over', () => {
    expect(connectTakesOver(run([connect]), { ...field(''), show: false })).toBe(false);
  });
  it('no ask: a wallet connecting changes nothing', () => {
    expect(connectTakesOver(null, field(''))).toBe(false);
  });
});
