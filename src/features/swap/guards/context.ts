import type { Hex } from 'viem';
import type { IcpClient, SwapicConfigView } from '@/lib/icp';

/** The canister's own anchors: its config (contracts per chain, CCTP domains, Eco's Portal), Eco's prover, its EVM address. */
export interface GuardContext { config: SwapicConfigView; ecoProver: Hex | null; canisterEvm: Hex | null }

export async function loadGuardContext(icp: IcpClient): Promise<GuardContext> {
  const [config, ecoProver, canisterEvm] = await Promise.all([icp.getConfig(), icp.ecoProver(), icp.canisterEvmAddress()]);
  return { config, ecoProver, canisterEvm };
}
