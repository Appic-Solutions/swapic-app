import { create } from 'zustand';

export type MenuStep = 'choose' | 'icp';

/**
 * Whether the Header's wallet menu is open, and the step it opens on: a page's own "Connect wallet" opens this same menu
 * (History, the empty states), and a page that needs an ICP wallet opens it on the ICP wallets.
 */
export const useWalletMenu = create<{
  open: boolean;
  step: MenuStep;
  setOpen: (open: boolean) => void;
  openAt: (step: MenuStep) => void;
}>((set) => ({
  open: false,
  step: 'choose',
  // a plain opening keeps the step it was asked for; closing goes back to the two choices
  setOpen: (open) => set(open ? { open } : { open, step: 'choose' }),
  openAt: (step) => set({ open: true, step }),
}));

/** Resolves when the menu closes, with a wallet connected or not. */
export const walletMenuClosed = () =>
  new Promise<void>((resolve) => {
    const stop = useWalletMenu.subscribe((state) => {
      if (state.open) return;
      stop();
      resolve();
    });
  });
