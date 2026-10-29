import { create } from 'zustand';

/** Whether the Header's wallet menu is open: a page's own "Connect wallet" (History, the empty states) opens the same menu. */
export const useWalletMenu = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));
