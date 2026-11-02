import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@/lib/api';
import { namedOption, pickOf, pickOptions } from './options';

const load = (n: string): Quote => JSON.parse(readFileSync(`tests/fixtures/real/quote/${n}.json`, 'utf8'));
const cards = (q: Quote, indicative = false) => pickOptions(q, { indicative }).map((o) => `${o.tags.join('+')}:${o.mode}:${o.route.routeId}`);

describe('pickOptions on real quotes', () => {
  it('skips a better ranked route that cannot run (Review Focus 2)', () => {
    expect(cards(load('arb-usdc-to-pol-wbtc'))).toEqual(['Gasless:gasless:cctpFast', 'Fastest+Best price:userPays:cctpFast']);
  });
  it('shows one card with both tags when one route is both', () => {
    expect(cards(load('eth-usdc-to-base-usdc'))).toEqual(['Gasless:gasless:eco', 'Fastest+Best price:userPays:eco']);
    expect(cards(load('pol-wbtc-to-arb-usdc'))).toEqual(['Gasless:gasless:eco', 'Fastest+Best price:userPays:eco']);
  });
  it('splits Fastest and Best price when two routes differ, and drops Gasless when not allowed', () => {
    expect(cards(load('base-eth-to-arb-arb'))).toEqual(['Fastest:userPays:eco', 'Best price:userPays:cctpFast']);
  });
  it('takes the same chain routes', () => {
    expect(cards(load('base-usdc-to-base-eth'))).toEqual(['Gasless:gasless:sameChain', 'Fastest+Best price:userPays:sameChain']);
  });
  it('shows routes that only wait for a wallet in an indicative quote, never other refusals', () => {
    const q = load('eth-usdc-to-base-usdc');
    for (const m of [q.gasless, q.userPays]) for (const r of m.routes) { r.executable = false; r.reason = 'payerNotGiven'; }
    expect(cards(q, true)).toEqual(['Gasless:gasless:eco', 'Fastest+Best price:userPays:eco']);
    expect(cards(q, false)).toEqual([]);
    q.gasless.routes[0]!.reason = 'payerIsContract';
    expect(cards(q, true)[0]).toBe('Gasless:gasless:cctpFast');
  });
  it('shows routes priced only (not named) as cards while choosing', () => {
    const q = load('eth-usdc-to-base-usdc');
    for (const m of [q.gasless, q.userPays]) for (const r of m.routes) { r.executable = false; r.reason = 'routeNotNamed'; }
    expect(cards(q, true)).toEqual(['Gasless:gasless:eco', 'Fastest+Best price:userPays:eco']);
  });
  it('treats an ICP source by the ICP rule', () => {
    const q = load('base-eth-to-arb-arb');
    const icp = { ...q, gasless: { allowed: false, routes: [] }, userPays: { allowed: false, routes: [] }, icpPull: { allowed: true, routes: q.userPays.routes } };
    expect(cards(icp)).toEqual(['Gasless:icpPull:cctpFast', 'Fastest+Best price:icpPull:eco']);
  });
});

describe('namedOption: the picked route in the answer that names it', () => {
  it('finds the route by id and mode, keeping the tags it was picked with', () => {
    const q = load('base-eth-to-arb-arb');
    const [fastest, best] = pickOptions(q, { indicative: false });
    expect(namedOption(q, pickOf(fastest!))?.route).toBe(fastest!.route);
    const again = namedOption(q, pickOf(best!))!;
    expect(again.route).toBe(best!.route);
    expect(again.tags).toEqual(['Best price']);
  });
  it('an ICP route picked as Fastest is found again although it is the answer\'s only route', () => {
    const q = load('base-eth-to-arb-arb');
    const only = q.userPays.routes.find((r) => r.executable && r.routeId === 'eco')!;
    const icp = { ...q, gasless: { allowed: false, routes: [] }, userPays: { allowed: false, routes: [] }, icpPull: { allowed: true, routes: [only] } };
    expect(namedOption(icp, { mode: 'icpPull', routeId: 'eco', tags: ['Fastest'] })?.route).toBe(only);
  });
  it('finds nothing when the route is gone, cannot run, is refused, or gasless is not allowed', () => {
    const q = load('arb-usdc-to-pol-wbtc');
    expect(namedOption(q, { mode: 'userPays', routeId: 'eco', tags: ['Fastest'] })).toBeUndefined();
    expect(namedOption(q, { mode: 'userPays', routeId: 'cctpFast', tags: ['Fastest'] }, () => false)).toBeUndefined();
    const off = { ...q, gasless: { ...q.gasless, allowed: false } };
    expect(namedOption(off, { mode: 'gasless', routeId: 'cctpFast', tags: ['Gasless'] })).toBeUndefined();
    for (const r of q.userPays.routes) r.executable = false;
    expect(namedOption(q, { mode: 'userPays', routeId: 'cctpFast', tags: ['Fastest'] })).toBeUndefined();
  });
});
