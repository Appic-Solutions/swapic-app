import type { Quote, Route } from '@/lib/api';

export type OptionTag = 'Gasless' | 'Fastest' | 'Best price';
export interface PickedOption { key: string; tags: OptionTag[]; mode: 'gasless' | 'userPays' | 'icpPull'; route: Route }

/** The least the route pays: what the canister's door takes on a route out of ICP, else the quote's. */
export const minOutOf = (o: PickedOption): bigint => (o.route.icpCkSwap ? BigInt(o.route.icpCkSwap.terms.minOut) : o.route.icpSwap ? BigInt(o.route.icpSwap.planned.minOut) : BigInt(o.route.amountOutMin));

/** Routes priced only: no wallet yet, or (since the quoter builds only a named route) not named. */
const WAITS_FOR_WALLET = new Set(['payerNotGiven', 'recipientNotGiven', 'routeNotNamed']);
const usable = (indicative: boolean) => (r: Route) => r.executable || (indicative && !!r.reason && WAITS_FOR_WALLET.has(r.reason));
const out = (r: Route) => BigInt(r.amountOut);
const byRank = (a: Route, b: Route) => a.rank - b.rank;
const fastest = (a: Route, b: Route) => a.etaSeconds - b.etaSeconds || (out(b) > out(a) ? 1 : out(b) < out(a) ? -1 : 0);
const richest = (a: Route, b: Route) => (out(b) > out(a) ? 1 : out(b) < out(a) ? -1 : 0) || a.etaSeconds - b.etaSeconds;
const keyOf = (mode: string, r: Route) => `${mode}:${r.routeId}:${r.rank}`;

function speedAndPrice(mode: PickedOption['mode'], routes: Route[]): PickedOption[] {
  if (!routes.length) return [];
  const f = [...routes].sort(fastest)[0]!;
  const b = [...routes].sort(richest)[0]!;
  if (f === b) return [{ key: keyOf(mode, f), tags: ['Fastest', 'Best price'], mode, route: f }];
  return [
    { key: keyOf(mode, f), tags: ['Fastest'], mode, route: f },
    { key: keyOf(mode, b), tags: ['Best price'], mode, route: b },
  ];
}

/** The cards, in the order the design shows them: Gasless, Fastest, Best price (spec 5.1). */
export function pickOptions(q: Quote, o: { indicative: boolean; accept?: (r: Route, mode: PickedOption['mode']) => boolean }): PickedOption[] {
  const base = usable(o.indicative);
  const ok = (mode: PickedOption['mode']) => (r: Route) => base(r) && (o.accept ? o.accept(r, mode) : true);
  if (q.icpPull) {
    const routes = q.icpPull.routes.filter(ok('icpPull')).sort(byRank);
    if (!routes.length) return [];
    const [best, ...rest] = routes;
    // the ck minter's route takes a network fee out of the swap: no gasless card
    const tags: OptionTag[] = best!.icpCkSwap ? [] : ['Gasless'];
    return [{ key: keyOf('icpPull', best!), tags, mode: 'icpPull', route: best! }, ...speedAndPrice('icpPull', rest)];
  }
  const cards: PickedOption[] = [];
  const g = q.gasless.allowed ? q.gasless.routes.filter(ok('gasless')).sort(byRank)[0] : undefined;
  if (g) cards.push({ key: keyOf('gasless', g), tags: ['Gasless'], mode: 'gasless', route: g });
  return [...cards, ...speedAndPrice('userPays', q.userPays.routes.filter(ok('userPays')))];
}

export const findByTag = (options: PickedOption[], tag: OptionTag) => options.find((x) => x.tags.includes(tag));

/** A card as Review swap asks for it again by name: its mode, its route's id, and its tags (which route of that id it is). */
export interface RoutePick { mode: PickedOption['mode']; routeId: string; tags: OptionTag[] }
export const pickOf = (o: PickedOption): RoutePick => ({ mode: o.mode, routeId: o.route.routeId, tags: o.tags });

/** The picked route in an answer asked by its name: of the executable routes with its id and mode, the one its card would
 *  take (the fastest, the richest, else the best ranked), keeping the tags it was picked with; none when it is gone. */
export function namedOption(q: Quote, p: RoutePick, accept?: (r: Route, mode: PickedOption['mode']) => boolean): PickedOption | undefined {
  const mode = p.mode === 'icpPull' ? q.icpPull : q[p.mode];
  if (!mode || (p.mode === 'gasless' && !mode.allowed)) return undefined;
  const routes = mode.routes.filter((r) => r.executable && r.routeId === p.routeId && (accept ? accept(r, p.mode) : true));
  const order = p.tags.includes('Fastest') ? fastest : p.tags.includes('Best price') ? richest : byRank;
  const r = [...routes].sort(order)[0];
  return r ? { key: keyOf(p.mode, r), tags: p.tags, mode: p.mode, route: r } : undefined;
}
