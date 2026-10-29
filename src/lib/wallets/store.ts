import { create } from 'zustand';

export type IcpSignerId = 'OISY' | 'NFIDW' | 'InternetIdentity';
export interface EvmWallet { address: `0x${string}`; chainId: number | null }
export interface IcpWallet { principal: string; signer: IcpSignerId | null }

interface WalletState {
  evm: EvmWallet | null;
  icp: IcpWallet | null;
  /** The last EVM wallet that connected was refused by the connect-time guard (guard.ts): the menu says why. */
  evmRefused: boolean;
  setEvm(w: EvmWallet | null): void;
  setIcp(w: IcpWallet | null): void;
  setEvmRefused(refused: boolean): void;
}

const ANONYMOUS = '2vxsx-fae';

export const useWallets = create<WalletState>()((set) => ({
  evm: null,
  icp: null,
  evmRefused: false,
  setEvm: (w) => set({ evm: w ? { address: w.address.toLowerCase() as `0x${string}`, chainId: w.chainId } : null }),
  setIcp: (w) => set({ icp: w && w.principal !== ANONYMOUS ? w : null }),
  setEvmRefused: (refused) => set({ evmRefused: refused }),
}));
