// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';

const ICP_LOGO = '/images/tokens/icp.svg';

// Via Swapic, quiet text and the logo; or, for the slow route the user waited on, the ckETH minter with the ICP logo, as its
// route card named it.
export function ViaPill({ minter = false }: { minter?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-x-1 whitespace-nowrap text-xs font-normal text-secondary">
      via <span className="font-medium text-white">{minter ? 'ckETH minter' : 'Swapic'}</span>
      <img src={minter ? ICP_LOGO : SWAPIC_LOGO} alt="" width={14} height={14} className="h-3.5 w-3.5" />
    </span>
  );
}
