import type { Hex } from 'viem';
import type { IcpClient, SwapicConfigView } from '@/lib/icp';

/** The canister's own anchors: its config (contracts per chain, CCTP domains, Eco's Portal), Eco's prover, the ck minter's
 *  deposit helper, its EVM address. */
export interface GuardContext { config: SwapicConfigView; ecoProver: Hex | null; ckHelper: Hex | null; canisterEvm: Hex | null }

export async function loadGuardContext(icp: IcpClient): Promise<GuardContext> {
  const [config, ecoProver, ckHelper, canisterEvm] = await Promise.all([icp.getConfig(), icp.ecoProver(), icp.ckHelper(), icp.canisterEvmAddress()]);
  return { config, ecoProver, ckHelper, canisterEvm };
}
