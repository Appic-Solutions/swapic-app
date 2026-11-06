'use client';
// "Can't find your swap? Paste the transaction", under Nothing found: the chain and the hash of a transaction that paid,
// sent to the find door (POST /v2/deposits/find), which files the swap it started; the answer in one plain sentence.
import * as React from 'react';
import ActionButton from '@/components/ui/action-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIELD } from '@/components/ui/styles';
import { findDeposit, userMessage } from '@/lib/api';
import { POOL_CHAIN } from '@/lib/chains';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';
import { useChains } from '@/features/swap/tokens';
import { findSentence, isTxHash } from './find';

export function FindSwap({ query }: { query: string }) {
  const { chains } = useChains();
  const evm = chains.filter((c) => c.chainId.startsWith('eip155:'));
  const [chain, setChain] = React.useState(POOL_CHAIN);
  const [tx, setTx] = React.useState(isTxHash(query) ? query.trim() : '');
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  const ok = isTxHash(tx);
  const find = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      setSaid(findSentence(await findDeposit({ chain, tx: tx.trim() })));
    } catch (e) {
      setSaid(userMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 flex w-full max-w-[460px] flex-col gap-y-3 rounded-2xl bg-inset p-4 text-left">
      <p className="text-base font-semibold">Can&apos;t find your swap? Paste the transaction</p>
      <p className="text-sm leading-6 text-secondary">If you paid and your swap shows nowhere, give us the chain and the hash of that transaction.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={chain} onValueChange={setChain}>
          <SelectTrigger className="border-line bg-white/[0.06] text-white outline-none ring-0 sm:max-w-[160px]">
            <SelectValue placeholder="Chain" />
          </SelectTrigger>
          <SelectContent className="border-line bg-[#1c1c1e] text-white outline-none ring-0">
            {evm.map((c) => <SelectItem key={c.chainId} value={c.chainId}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <input
          type="text"
          placeholder="0x… transaction hash"
          value={tx}
          onChange={(e) => { setTx(e.target.value); setSaid(null); }}
          className={'w-full px-3 py-2 font-mono text-sm ' + FIELD}
        />
      </div>
      {tx && !ok && <p className="text-xs text-warn">Enter the full hash: 0x and 64 characters.</p>}
      <div className={cn(tw.quick, ok && tw.press)}>
        <ActionButton isDisabled={!ok || busy} onClick={ok ? () => void find() : undefined}>{busy ? undefined : 'Find my swap'}</ActionButton>
      </div>
      {said && <p className="text-sm leading-6 text-white">{said}</p>}
    </div>
  );
}
