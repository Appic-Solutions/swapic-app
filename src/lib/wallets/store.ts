import { create } from 'zustand';

export type IcpSignerId = 'OISY' | 'NFIDW' | 'InternetIdentity';
/** `smartWallet`: the address holds contract code on the connected chain (guard.ts); it may swap, never stake. */
export interface EvmWallet { address: `0x${string}`; chainId: number | null; smartWallet?: boolean }
export interface IcpWallet { principal: string; signer: IcpSignerId | null }

interface WalletState {
  evm: EvmWallet | null;
  icp: IcpWallet | null;
  setEvm(w: EvmWallet | null): void;
  setIcp(w: IcpWallet | null): void;
}

const ANONYMOUS = '2vxsx-fae';

export const useWallets = create<WalletState>()((set) => ({
  evm: null,
  icp: null,
  setEvm: (w) => set({ evm: w ? { address: w.address.toLowerCase() as `0x${string}`, chainId: w.chainId, smartWallet: w.smartWallet ?? false } : null }),
  setIcp: (w) => set({ icp: w && w.principal !== ANONYMOUS ? w : null }),
}));
