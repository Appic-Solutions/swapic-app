import { create } from 'zustand';
import { PLUG_UUID } from './plug';

export type IcpSignerId = 'OISY' | 'NFIDW' | 'InternetIdentity' | 'Plug';

/** The store's name for the signer IdentityKit reports: Plug's IdentityKit id is its ICRC-94 uuid (plug.ts). */
export function icpSignerOf(kitId: string | undefined): IcpSignerId | null {
  if (kitId === PLUG_UUID) return 'Plug';
  return kitId === 'OISY' || kitId === 'NFIDW' || kitId === 'InternetIdentity' ? kitId : null;
}
/** The id IdentityKit's connect() takes for a signer. */
export const kitIdOf = (s: IcpSignerId): string => (s === 'Plug' ? PLUG_UUID : s);
/** `smartWallet`: the address holds contract code on the connected chain (guard.ts): it may swap, never stake. null: its code
 *  could not be read (unknown: the recipient rule treats it as smart, Stake does not block on it). */
export interface EvmWallet { address: `0x${string}`; chainId: number | null; smartWallet?: boolean | null }
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
  setEvm: (w) => set({ evm: w ? { address: w.address.toLowerCase() as `0x${string}`, chainId: w.chainId, smartWallet: w.smartWallet === undefined ? false : w.smartWallet } : null }),
  setIcp: (w) => set({ icp: w && w.principal !== ANONYMOUS ? w : null }),
}));
