'use client';
// The interim connect menu: the live wallet-connect-buttons.tsx (Drawer below md, Popover above) and the
// avatar button of the live wallet-pop.tsx with only its header part (address, copy, Disconnect), wired to
// the one wallet store. Plan 1 Task 11 replaces it with the new chooser.
import { useState } from 'react';
import Image from 'next/image';
import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from '@/components/ui/drawer';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import WalletCard from '@/components/ui/wallet-card';
import { CloseIcon, CopyIcon } from '@/components/icons';
import { useDisconnectWallets, useEvmConnect, useIcpConnect, useWallets } from '@/lib/wallets';

export function ConnectMenu() {
  const { evm, icp } = useWallets();
  const connectIcp = useIcpConnect();
  const openEvmModal = useEvmConnect();
  const label = icp || evm ? 'Add Wallet' : 'Connect Wallet';
  const rows = (
    <div className="flex flex-col gap-4">
      {!icp && <WalletCard connectWallet={() => void connectIcp()} walletLogo="/images/logo/wallet_logos/icp.svg" walletTitle="Connect ICP Wallet" />}
      {!evm && <WalletCard connectWallet={() => void openEvmModal()} walletLogo="/images/logo/chains-logos/ethereum.svg" walletTitle="Connect EVM Wallet" />}
    </div>
  );
  return (
    <>
      {/* Mobile wallet connection */}
      <div className="md:hidden">
        <Drawer>
          <DrawerTrigger className="w-full px-3 py-2 text-sm font-medium text-white">{label}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>Select Wallet</DrawerHeader>
            {rows}
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop wallet connection */}
      <div className="hidden md:block">
        <Popover>
          <PopoverTrigger className="w-full px-3 py-2 text-sm font-medium text-white">{label}</PopoverTrigger>
          <PopoverContent className="flex w-72 translate-y-4 flex-col gap-y-4" align="end">
            <div className="flex items-center justify-center font-medium text-white">
              <PopoverClose className="absolute right-4 top-4">
                <CloseIcon width={20} height={20} />
              </PopoverClose>
              Select Wallet
            </div>
            {rows}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

const shortAddress = (address: string) => (address ? `${address.slice(0, 6)}...${address.slice(-6)}` : '');

export function WalletPill({ side, logo, address }: { side: 'evm' | 'icp'; logo: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const disconnect = useDisconnectWallets();
  const title = side === 'icp' ? 'Your ICP Wallet' : 'Your EVM Wallet';
  const copy = () => {
    navigator.clipboard.writeText(address).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => {},
    );
  };
  const body = (
    <>
      {/* address + copy */}
      <div className="flex items-center justify-center gap-x-2 text-sm text-white">
        <span>{shortAddress(address)}</span>
        <button className="relative" onClick={copy}>
          <CopyIcon width={20} height={20} />
          {copied && (
            <div className="absolute -left-5 -top-8 animate-fade rounded-lg border border-white/20 bg-[#1C1D1F] px-2 py-1">
              Copied!
            </div>
          )}
        </button>
      </div>
      <button
        onClick={() => void (side === 'icp' ? disconnect.icp() : disconnect.evm())}
        className="rounded-[10px] px-4 py-2 text-sm font-semibold text-fail duration-200 hover:bg-fail hover:text-white"
      >
        Disconnect
      </button>
    </>
  );
  return (
    <>
      {/* mobile */}
      <div className="flex items-center justify-center md:hidden">
        <Drawer>
          <DrawerTrigger>
            <Image src={logo} alt={title} width={24} height={24} className="min-h-6 min-w-6" />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="pl-10">{title}</DrawerHeader>
            {body}
          </DrawerContent>
        </Drawer>
      </div>

      {/* desktop */}
      <div className="hidden items-center justify-center text-primary md:flex">
        <Popover>
          <PopoverTrigger>
            <Image src={logo} alt={title} width={24} height={24} className="min-h-6 min-w-6" />
          </PopoverTrigger>
          <PopoverContent className="flex w-[360px] translate-y-4 flex-col gap-y-4 px-10" align="end">
            <div className="flex items-center justify-center font-medium text-white">
              <PopoverClose className="absolute right-4 top-4">
                <CloseIcon width={20} height={20} />
              </PopoverClose>
              {title}
            </div>
            {body}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
