// "Receive on" for one stake: moved from the design's pool-screens.tsx ReceiveOnPicker, the token page narrowed to the
// chains that stake can pay to (an EVM stake on EVM chains, an ICP stake on ICP as ckUSDC), with the design's note.
import * as React from 'react';
import type { UiToken } from '@/components/ui/token-types';
import { short } from '@/lib/copy/format';
import { TokenSelect } from '@/features/swap/components/TokenSelect';
import type { MyStake } from '../data';

export function ReceiveOnPicker({ stake, tokens, selected, onBack, onSelect }: {
  stake: MyStake; tokens: UiToken[]; selected: UiToken; onBack: () => void; onSelect: (t: UiToken) => void;
}) {
  return (
    <TokenSelect
      title="Receive on"
      chain={selected.chain}
      chains={tokens.map((t) => t.chain)}
      fixedTokens={Object.fromEntries(tokens.map((t) => [t.chain, [t]]))}
      selected={selected}
      onBack={onBack}
      onSelect={onSelect}
      note={
        <p className="w-full text-sm text-secondary">
          {stake.kind === 'icp'
            ? `This stake came from ${short(stake.owner)} on ICP, so it pays out on ICP, as ckUSDC.`
            : `This stake came from ${short(stake.owner)}, so it pays out on EVM chains.`}
        </p>
      }
    />
  );
}
