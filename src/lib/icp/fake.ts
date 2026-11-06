// e2e builds only, reached only through an inline env check. The marker below is a string the code uses at run
// time (a comment would be stripped by the minifier), so plan 4 Task 6's build check finds it if this file is bundled.
import { Principal } from '@icp-sdk/core/principal';
import configJson from '../../../tests/fixtures/derived/swapic-config.json';
import type { ChainView, IcpClient } from './client';

export const E2E_MARKER = 'E2E-FAKE-MARKER';

export function fakeIcpClient(): IcpClient {
  (globalThis as { __SWAPIC_E2E_MARKER__?: string }).__SWAPIC_E2E_MARKER__ = E2E_MARKER;
  const chains = new Map(Object.entries(configJson.chains).map(([id, c]) => [Number(id), c as ChainView]));
  let payoutStatus = 0;
  return {
    getConfig: async () => ({
      poolChain: configJson.poolChain, chains,
      cctpDomains: new Map(Object.entries(configJson.cctpDomains).map(([id, d]) => [Number(id), d])),
      ecoPortal: configJson.ecoPortal as `0x${string}`,
    }),
    ecoProver: async () => configJson.ecoProver as `0x${string}`,
    ckHelper: async () => configJson.ckHelper as `0x${string}`,
    canisterEvmAddress: async () => configJson.canisterEvmAddress as `0x${string}`,
    poolState: async () => ({ open: true, totalAssets: 8_420_550_000n, totalShares: 8_346_065_000_000_000_000_000n, tvlCap: 10_000_000_000n }),
    poolAccount: async () => ({ shares: 1_182_254_000_000_000_000_000n, valueUsdc: 1_192_805_102n }),
    payout: async (id) => ({
      id, kind: { IcpSwap: null }, planned: [], order_id: [], tx_hash: [], amount: [], received: [],
      terms: { dst_chain: 8453n, min_out: 601_110_000n, recipient: '0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC', deadline_ns: 0n, token_out: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
      status: payoutStatus++ < 2 ? { Signed: 7n } : { Paid: null },
    }),
    ledgerFee: async () => 10_000n,
    balance: async () => 640_120_000n,
    allowance: async () => 0n,
    approve: async () => 2_184_903n,
    swapFromIcp: async () => ({ id: 41n, status: { Signed: 7n } }),
    stakeIcp: async () => ({ shares: 495_000_000_000_000_000_000n }),
    withdrawIcp: async (_c, a) => ({ paid: a.usdc - 10_000n, burned: a.max_shares }),
    withdrawEvm: async () => ({ id: 41n, burned: 594_692_626_966_172_043_394n }),
  };
}

export const FAKE_PRINCIPAL = Principal.fromText('3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe');
