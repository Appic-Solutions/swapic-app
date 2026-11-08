// A Solana wallet as the swap sees it. The wallet signs bytes the guard already passed: it is handed exactly those, and what
// comes back must be the same message with the wallet's own signature in its slot, or it is not sent.
import { VersionedTransaction } from '@solana/web3.js';

export interface SolanaWalletProvider { signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction> }
export interface SolSigner {
  address: string;
  /** The wire form with its signature slots: answers the same, the wallet's slot filled. */
  signTransaction(wire: Uint8Array): Promise<Uint8Array>;
}

export function solSigner(address: string, provider: SolanaWalletProvider): SolSigner {
  return {
    address,
    signTransaction: async (wire) => {
      const signed = await provider.signTransaction(VersionedTransaction.deserialize(wire));
      return signed.serialize();
    },
  };
}
