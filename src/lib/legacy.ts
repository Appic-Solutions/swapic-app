const ROUTES = new Set(['/', '/pool', '/pool/stake', '/pool/withdraw', '/history', '/scanner']);
const OLD: [RegExp, string][] = [
  [/^\/(swap|bridge|advanced|auto-invest)(\/|$)/, '/'],
  [/^\/(positions|explore)(\/|$)/, '/pool'],
  [/^\/transactions-history(\/|$)/, '/history'],
];

/** Where an old platform-v2 link goes (spec section 4), or null when the path is one of ours. */
export function legacyTarget(pathname: string): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (ROUTES.has(p)) return null;
  for (const [re, to] of OLD) if (re.test(p)) return to;
  return '/';
}
