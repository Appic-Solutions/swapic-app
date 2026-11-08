/** A token as every copied component draws it. Built by plan 2 from GET /v2/tokens and /v2/chains. */
export interface UiToken {
  /** `${chain}|${address}`, unique across chains. */
  key: string;
  /** CAIP-2 id. */
  chain: string;
  /** The components' own numbering: an EVM chain id, 0 for ICP (design data.ts). */
  chainId: number;
  chainName: string;
  chainLogo: string;
  chain_type: 'EVM' | 'ICP' | 'SOLANA';
  /** EVM address (the zero address for the coin), ICP ledger principal, or Solana mint (base58, case exact). */
  address: string;
  contractAddress?: string;
  canisterId?: string;
  symbol: string;
  name: string;
  logo: string;
  decimals: number;
  /** Dollars a whole token, as the quoter writes it; null when not fresh. */
  priceUsd: string | null;
  verified: boolean;
  /** Smallest units. */
  balance?: bigint;
  balanceText?: string;
  usdBalanceText?: string;
}
