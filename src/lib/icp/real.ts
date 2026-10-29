// Design note (ICP calls, plan 1 Task 6).
// Must never happen: an icrc2_approve whose spender is anything but the Swapic canister's main account, or whose
// amount is more than the call needs; a canister call made before the inputs were checked (the canister counts
// swap_from_icp and stake_icp against the 5 a minute limit before it validates); a Result variant read by a hand
// written name (Result_16 today, another number tomorrow); the fake client reaching a production build.
// How the design proves it: approve() takes no spender argument: it always names config.swapicCanisterId's main
// account, and its amount comes from the caller, who passes exactly amount_in + fee (plan 2 Task 1 checks it against
// the quote); every approval expires 15 minutes after it is given, so an unused allowance lapses and the canister can
// pull at most once; allowance() reads 0 for an expired approval too, so after a lost answer the app never reads 0
// as "pulled": plan 2 Task 7 and plan 3 Tasks 5 and 7 judge from the ledger balance and the canister's own records.
// Results are unwrapped through types inferred from the generated _SERVICE, never a Result_N name. The fake client
// is reached only through an inline `process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e'` check (index.ts); plan 4 Task 6
// greps the production build for its marker string. Anonymous reads use one shared HttpAgent on config.icpHost
// (never fetchRootKey: mainnet).
import { Actor, HttpAgent, type ActorSubclass, type Agent } from '@icp-sdk/core/agent';
import { IcrcLedgerCanister } from '@icp-sdk/canisters/ledger/icrc';
import { Principal } from '@icp-sdk/core/principal';
import { config } from '@/config';
import { idlFactory } from './declarations/swapic.did.js';
import type { _SERVICE } from './declarations/swapic.did';
import { PoolErrorFailure } from './errors';
import type { IcpClient, SwapicConfigView } from './client';

const APPROVAL_TTL_NS = 15n * 60n * 1_000_000_000n;
let anonymous: Promise<HttpAgent> | null = null;
const anon = () => (anonymous ??= HttpAgent.create({ host: config.icpHost }));

const swapic = (agent: Agent): ActorSubclass<_SERVICE> =>
  Actor.createActor<_SERVICE>(idlFactory, { agent, canisterId: config.swapicCanisterId });

function unwrap<T>(r: { Ok: T } | { Err: import('./declarations/swapic.did').PoolError }): T {
  if ('Err' in r) throw new PoolErrorFailure(r.Err);
  return r.Ok;
}

const hex = (t: string) => t.toLowerCase() as `0x${string}`;

export function realIcpClient(): IcpClient {
  return {
    async getConfig(): Promise<SwapicConfigView> {
      const c = await swapic(await anon()).get_config();
      const usdc = new Map(c.usdc_addresses.map(([id, a]) => [Number(id), hex(a)]));
      const chains = new Map(
        c.evm_chains.map(([id, ch]) => [Number(id), {
          swapic: hex(ch.swapic), usdc: usdc.get(Number(id)) ?? hex(ch.usdc), runner: hex(ch.runner),
          cctpReceiver: hex(ch.cctp_receiver), tokenMessenger: hex(ch.token_messenger),
        }]),
      );
      return {
        poolChain: c.pool_chain[0] === undefined ? null : Number(c.pool_chain[0]),
        chains,
        cctpDomains: new Map(c.cctp_domains.map(([id, d]) => [Number(id), Number(d)])),
        ecoPortal: c.eco_portal[0] ? hex(c.eco_portal[0]) : null,
      };
    },
    async ecoProver() {
      const f = await swapic(await anon()).get_flow_settings();
      return f.eco_prover[0] ? hex(f.eco_prover[0]) : null;
    },
    async canisterEvmAddress() {
      const a = await swapic(await anon()).evm_address();
      return a[0] ? hex(a[0]) : null;
    },
    async poolState() {
      const s = await swapic(await anon()).pool_state();
      return { open: s.open, totalAssets: s.total_assets, totalShares: s.total_shares, tvlCap: s.tvl_cap };
    },
    async poolAccount(owner) {
      const v = await swapic(await anon()).pool_account(owner);
      return { shares: v.shares, valueUsdc: v.value_usdc };
    },
    async payout(id) {
      const p = await swapic(await anon()).payout(id);
      return p[0] ?? null;
    },
    async ledgerFee(ledger) {
      return IcrcLedgerCanister.create({ agent: await anon(), canisterId: Principal.fromText(ledger) }).transactionFee({ certified: false });
    },
    async balance(ledger, owner) {
      return IcrcLedgerCanister.create({ agent: await anon(), canisterId: Principal.fromText(ledger) }).balance({ owner, certified: false });
    },
    async allowance(ledger, owner) {
      const a = await IcrcLedgerCanister.create({ agent: await anon(), canisterId: Principal.fromText(ledger) }).allowance({
        account: { owner, subaccount: [] },
        spender: { owner: Principal.fromText(config.swapicCanisterId), subaccount: [] },
        certified: false,
      });
      const nowNs = BigInt(Date.now()) * 1_000_000n;
      const expires = a.expires_at[0];
      return expires !== undefined && expires <= nowNs ? 0n : a.allowance;
    },
    async approve(caller, ledger, amount) {
      const nowNs = BigInt(Date.now()) * 1_000_000n;
      return IcrcLedgerCanister.create({ agent: caller.agent, canisterId: Principal.fromText(ledger) }).approve({
        spender: { owner: Principal.fromText(config.swapicCanisterId), subaccount: [] },
        amount,
        expires_at: nowNs + APPROVAL_TTL_NS,
      });
    },
    async swapFromIcp(caller, terms) {
      return unwrap(await swapic(caller.agent).swap_from_icp(terms));
    },
    async stakeIcp(caller, args) {
      return unwrap(await swapic(caller.agent).stake_icp(args));
    },
    async withdrawIcp(caller, args) {
      return unwrap(await swapic(caller.agent).withdraw_icp(args));
    },
    async withdrawEvm(record, signature) {
      return unwrap(await swapic(await anon()).withdraw_evm(record, signature));
    },
  };
}
