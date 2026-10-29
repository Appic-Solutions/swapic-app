import type { Agent } from '@icp-sdk/core/agent';
import type { Principal } from '@icp-sdk/core/principal';
import type {
  _SERVICE, EvmWithdrawal, IcpSwapTerms, PayoutView, PoolAccount, StakeIcpArgs, WithdrawIcpArgs,
} from './declarations/swapic.did';

type Ok<K extends keyof _SERVICE> = Extract<Awaited<ReturnType<_SERVICE[K]>>, { Ok: unknown }>['Ok'];
export type SwapFromIcpOk = Ok<'swap_from_icp'>;
export type StakeIcpOk = Ok<'stake_icp'>;
export type WithdrawIcpOk = Ok<'withdraw_icp'>;
export type WithdrawEvmOk = Ok<'withdraw_evm'>;

export interface IcpCaller { agent: Agent; principal: Principal }
/** One chain's contracts as get_config names them (can.did EvmChainConfig): the only anchors plan 2's check trusts. */
export interface ChainView {
  swapic: `0x${string}`; usdc: `0x${string}`; runner: `0x${string}`; cctpReceiver: `0x${string}`; tokenMessenger: `0x${string}`;
}
export interface SwapicConfigView {
  poolChain: number | null;
  chains: Map<number, ChainView>;
  /** CCTP's own domain per chain id (get_config cctp_domains). */
  cctpDomains: Map<number, number>;
  /** Eco's Portal, the same on every chain (get_config eco_portal). */
  ecoPortal: `0x${string}` | null;
}

export interface IcpClient {
  getConfig(): Promise<SwapicConfigView>;
  /** get_flow_settings().eco_prover: the one prover an Eco intent may name (canister pool/eco check_intent). */
  ecoProver(): Promise<`0x${string}` | null>;
  canisterEvmAddress(): Promise<`0x${string}` | null>;
  poolState(): Promise<{ open: boolean; totalAssets: bigint; totalShares: bigint; tvlCap: bigint }>;
  poolAccount(owner: PoolAccount): Promise<{ shares: bigint; valueUsdc: bigint }>;
  payout(id: bigint): Promise<PayoutView | null>;
  ledgerFee(ledger: string): Promise<bigint>;
  balance(ledger: string, owner: Principal): Promise<bigint>;
  /** icrc2_allowance from `owner`'s default account to the Swapic canister's main account (0 when none or expired). */
  allowance(ledger: string, owner: Principal): Promise<bigint>;
  /** icrc2_approve of the Swapic canister's main account for exactly `amount`, expiring in 15 minutes. Answers the block. */
  approve(caller: IcpCaller, ledger: string, amount: bigint): Promise<bigint>;
  swapFromIcp(caller: IcpCaller, terms: IcpSwapTerms): Promise<SwapFromIcpOk>;
  stakeIcp(caller: IcpCaller, args: StakeIcpArgs): Promise<StakeIcpOk>;
  withdrawIcp(caller: IcpCaller, args: WithdrawIcpArgs): Promise<WithdrawIcpOk>;
  /** Anonymous call: the 65 byte signature proves the staker (can.did withdraw_evm). */
  withdrawEvm(record: EvmWithdrawal, signature: Uint8Array): Promise<WithdrawEvmOk>;
}
