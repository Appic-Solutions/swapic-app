// A fake's "Use the real X": the listed token it imitates, from the rows on screen, else asked for by its address.
import type { TokensAnswer, ChainInfo } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { listedFor, markOf } from '@/lib/token-marks';
import { toUiToken } from './tokens';

/** The real token, or null when it is not listed, not on this chain's quoter list, or the ask failed. */
export async function findReal(t: UiToken, shown: UiToken[], chain: ChainInfo | undefined, ask: (chain: string, q: string) => Promise<TokensAnswer>): Promise<UiToken | null> {
  const real = listedFor(t)?.token;
  if (!real) return null;
  const here = shown.find((x) => markOf(x) === 'verified' && listedFor(x)?.token === real);
  if (here) return here;
  if (!chain) return null;
  const found = (await ask(t.chain, real.address).catch(() => null))?.tokens.find((x) => x.address.toLowerCase() === real.address.toLowerCase());
  return found ? toUiToken(found, chain) : null;
}
