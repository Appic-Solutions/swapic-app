// "Can't find your swap?": a paid transaction the history does not show, asked for by chain and hash (POST
// /v2/deposits/find). The answer is told from its closed state only; the backend's own `why` is never shown.
import type { FindAnswer } from '@/lib/api';

export const isTxHash = (t: string) => /^0x[0-9a-fA-F]{64}$/.test(t.trim());

export function findSentence(a: Pick<FindAnswer, 'state' | 'orders'>): string {
  switch (a.state) {
    case 'queued': return 'Found it. Your swap shows here and in History in a few minutes.';
    case 'filed': return a.orders ? 'Found it. Search the transaction again to open your swap.' : 'We checked it: it holds no swap of ours.';
    case 'nothing': return 'We found no swap of ours in this transaction. Check the chain and the hash.';
    default: return 'We could not tell yet. Try again in a minute.';
  }
}
